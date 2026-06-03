const Database = require("better-sqlite3");
const path     = require("path");
const crypto   = require("crypto");

const DB_PATH = process.env.DFS_DB_PATH || path.join(__dirname, "dfs.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS nodes (
    name      TEXT PRIMARY KEY,
    url       TEXT NOT NULL,
    user_id   INTEGER,
    last_seen INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Files belong to a group. Identified by a unique id (so same-name files in
  -- different groups never collide), with a UNIQUE(group_id, filename) so a name
  -- is unique *within* a group.
  CREATE TABLE IF NOT EXISTS files (
    id          TEXT PRIMARY KEY,
    group_id    TEXT    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    filename    TEXT    NOT NULL,
    uploaded_at TEXT    NOT NULL DEFAULT (datetime('now')),
    total_size  INTEGER NOT NULL DEFAULT 0,
    uploaded_by INTEGER REFERENCES users(id),
    UNIQUE(group_id, filename)
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id  TEXT    NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    chunk_id INTEGER NOT NULL,
    hash     TEXT    NOT NULL,
    size     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(file_id, chunk_id)
  );

  CREATE TABLE IF NOT EXISTS chunk_nodes (
    chunk_pk  INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    node_name TEXT    NOT NULL,
    PRIMARY KEY (chunk_pk, node_name)
  );

  -- ── Groups ──────────────────────────────────────────────────────────────
  -- A group is a private, isolated namespace of members + files. Deliberately
  -- NO encryption-key column: the group key lives only on members' devices
  -- (carried via the invite). The coordinator never stores it.
  CREATE TABLE IF NOT EXISTS groups (
    id          TEXT PRIMARY KEY,
    name        TEXT    NOT NULL,
    created_by  INTEGER REFERENCES users(id),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    replication TEXT    NOT NULL DEFAULT 'balanced'
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id  TEXT    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role      TEXT    NOT NULL DEFAULT 'member',
    joined_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS invites (
    code       TEXT PRIMARY KEY,
    group_id   TEXT    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    revoked    INTEGER NOT NULL DEFAULT 0
  );
`);

// Back-fill the user_id column on databases created before node↔user identity.
try { db.exec(`ALTER TABLE nodes ADD COLUMN user_id INTEGER`); } catch { /* already present */ }
// Optional per-group identity (custom avatar). Null = auto (deterministic color
// + first letter of the name).
try { db.exec(`ALTER TABLE groups ADD COLUMN emoji TEXT`); } catch { /* already present */ }
try { db.exec(`ALTER TABLE groups ADD COLUMN color TEXT`); } catch { /* already present */ }

// ── Nodes ─────────────────────────────────────────────────────────────────────

const stmts = {
  upsertNode:   db.prepare(`INSERT INTO nodes (name, url, user_id, last_seen) VALUES (?, ?, ?, unixepoch())
                             ON CONFLICT(name) DO UPDATE SET url = excluded.url, user_id = excluded.user_id, last_seen = unixepoch()`),
  heartbeat:    db.prepare(`UPDATE nodes SET last_seen = unixepoch() WHERE name = ?`),
  getNodes:     db.prepare(`SELECT name, url FROM nodes`),
  deleteNode:   db.prepare(`DELETE FROM nodes WHERE name = ?`),
  staleNodes:   db.prepare(`SELECT name FROM nodes WHERE last_seen < unixepoch() - ?`),

  // Files (group-scoped, unique id)
  insertFile:       db.prepare(`INSERT INTO files (id, group_id, filename, uploaded_at, total_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`),
  deleteFileByName: db.prepare(`DELETE FROM files WHERE group_id = ? AND filename = ?`),
  deleteFileById:   db.prepare(`DELETE FROM files WHERE id = ?`),
  getFileByName:    db.prepare(`SELECT * FROM files WHERE group_id = ? AND filename = ?`),
  groupFiles:       db.prepare(`SELECT f.*, u.username AS uploaded_by_name,
                                       (SELECT COUNT(*) FROM chunks c WHERE c.file_id = f.id) AS chunk_count
                                  FROM files f LEFT JOIN users u ON u.id = f.uploaded_by
                                 WHERE f.group_id = ? ORDER BY f.uploaded_at DESC`),
  allFiles:         db.prepare(`SELECT * FROM files ORDER BY uploaded_at DESC`),

  // Chunks
  insertChunk:  db.prepare(`INSERT OR REPLACE INTO chunks (file_id, chunk_id, hash, size) VALUES (?, ?, ?, ?)`),
  getChunks:    db.prepare(`SELECT id, chunk_id, hash, size FROM chunks WHERE file_id = ? ORDER BY chunk_id ASC`),
  getChunkPk:   db.prepare(`SELECT id FROM chunks WHERE file_id = ? AND chunk_id = ?`),

  // Chunk nodes
  insertChunkNode: db.prepare(`INSERT OR IGNORE INTO chunk_nodes (chunk_pk, node_name) VALUES (?, ?)`),
  getChunkNodes:   db.prepare(`SELECT node_name FROM chunk_nodes WHERE chunk_pk = ?`),

  // Users
  createUser:       db.prepare(`INSERT INTO users (username, password_hash) VALUES (?, ?)`),
  getUserByName:    db.prepare(`SELECT * FROM users WHERE username = ?`),

  // Groups
  insertGroup:      db.prepare(`INSERT INTO groups (id, name, created_by, replication, emoji, color) VALUES (?, ?, ?, ?, ?, ?)`),
  getGroupById:     db.prepare(`SELECT * FROM groups WHERE id = ?`),
  deleteGroupById:  db.prepare(`DELETE FROM groups WHERE id = ?`),
  renameGroupById:  db.prepare(`UPDATE groups SET name = ? WHERE id = ?`),
  updateGroupMeta:  db.prepare(`UPDATE groups SET name = ?, emoji = ?, color = ? WHERE id = ?`),
  setReplication:   db.prepare(`UPDATE groups SET replication = ? WHERE id = ?`),
  userGroups:       db.prepare(`SELECT g.* FROM groups g
                                  JOIN group_members m ON m.group_id = g.id
                                 WHERE m.user_id = ?
                                 ORDER BY g.created_at`),

  // Group members
  addMember:        db.prepare(`INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`),
  getMember:        db.prepare(`SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`),
  getMemberRole:    db.prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`),
  setMemberRole:    db.prepare(`UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`),
  removeMemberRow:  db.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`),
  listMembers:      db.prepare(`SELECT m.user_id, m.role, m.joined_at, u.username
                                  FROM group_members m JOIN users u ON u.id = m.user_id
                                 WHERE m.group_id = ? ORDER BY m.joined_at`),

  // Invites
  insertInvite:     db.prepare(`INSERT INTO invites (code, group_id, created_by, expires_at) VALUES (?, ?, ?, ?)`),
  getInviteByCode:  db.prepare(`SELECT * FROM invites WHERE code = ?`),
  revokeInviteCode: db.prepare(`UPDATE invites SET revoked = 1 WHERE code = ?`),
};

// ── Node helpers ──────────────────────────────────────────────────────────────

function registerNode(name, url, userId = null) {
  stmts.upsertNode.run(name, url, userId ?? null);
}

// name→url map of nodes owned by any of the given users (a group's members).
function getMemberNodeMap(userIds) {
  if (!userIds || !userIds.length) return {};
  const ph   = userIds.map(() => "?").join(",");
  const rows = db.prepare(`SELECT name, url FROM nodes WHERE user_id IN (${ph})`).all(...userIds);
  return Object.fromEntries(rows.map((r) => [r.name, r.url]));
}

function heartbeatNode(name) {
  stmts.heartbeat.run(name);
}

function getNodeMap() {
  const rows = stmts.getNodes.all();
  return Object.fromEntries(rows.map((r) => [r.name, r.url]));
}

function deregisterNode(name) {
  stmts.deleteNode.run(name);
}

function deregisterStaleNodes(timeoutSeconds) {
  const stale = stmts.staleNodes.all(timeoutSeconds);
  for (const { name } of stale) stmts.deleteNode.run(name);
  return stale.map((r) => r.name);
}

// ── File helpers ──────────────────────────────────────────────────────────────

function chunksOf(fileId) {
  return stmts.getChunks.all(fileId).map((c) => ({
    chunkId: c.chunk_id,
    hash:    c.hash,
    size:    c.size,
    users:   stmts.getChunkNodes.all(c.id).map((r) => r.node_name),
  }));
}

// Persists a file under a group. Replaces any existing file with the same name
// in that group (cascade clears its old chunk rows). chunks: [{ chunkId, hash,
// size, users: [nodeName, ...] }]
const saveFile = db.transaction((fileId, groupId, filename, uploadedBy, uploadedAt, chunks) => {
  const totalSize = chunks.reduce((s, c) => s + c.size, 0);
  stmts.deleteFileByName.run(groupId, filename);
  stmts.insertFile.run(fileId, groupId, filename, uploadedAt, totalSize, uploadedBy);

  for (const chunk of chunks) {
    stmts.insertChunk.run(fileId, chunk.chunkId, chunk.hash, chunk.size);
    const row = stmts.getChunkPk.get(fileId, chunk.chunkId);
    for (const nodeName of chunk.users) stmts.insertChunkNode.run(row.id, nodeName);
  }
});

// Files in a group, with chunk_count, for listing.
function getGroupFiles(groupId) {
  return stmts.groupFiles.all(groupId);
}

// A single file in a group (by name) with its full chunk → node map.
function getGroupFileByName(groupId, filename) {
  const file = stmts.getFileByName.get(groupId, filename);
  if (!file) return null;
  return { ...file, chunks: chunksOf(file.id) };
}

// All files across all groups with chunks — used by the global health endpoint.
function getAllFilesWithChunks() {
  return stmts.allFiles.all().map((f) => ({ ...f, chunks: chunksOf(f.id) }));
}

function deleteFileRecord(fileId) {
  stmts.deleteFileById.run(fileId); // cascades to chunks + chunk_nodes
}

// ── User helpers ──────────────────────────────────────────────────────────────

function createUser(username, passwordHash) {
  stmts.createUser.run(username, passwordHash);
}

function getUserByUsername(username) {
  return stmts.getUserByName.get(username);
}

// ── Group helpers ─────────────────────────────────────────────────────────────

const REPLICATION_PRESETS = ["minimal", "balanced", "max"];

// Creates a group and adds its creator as the 'owner' member, atomically.
// Normalize optional group-identity inputs. Emoji: trim + cap length (a couple
// codepoints). Color: only accept #rrggbb, else null.
function normEmoji(e) {
  if (e == null) return null;
  const s = String(e).trim();
  if (!s) return null;
  return Array.from(s).slice(0, 4).join("");
}
function normColor(c) {
  if (c == null) return null;
  const s = String(c).trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

const createGroup = db.transaction((name, createdByUserId, replication = "balanced", emoji = null, color = null) => {
  const preset = REPLICATION_PRESETS.includes(replication) ? replication : "balanced";
  const id = crypto.randomUUID();
  const em  = normEmoji(emoji);
  const col = normColor(color);
  stmts.insertGroup.run(id, name, createdByUserId, preset, em, col);
  stmts.addMember.run(id, createdByUserId, "owner");
  return { id, name, created_by: createdByUserId, replication: preset, emoji: em, color: col };
});

function getGroup(id) {
  return stmts.getGroupById.get(id) || null;
}

// Update name (+ optionally emoji/color). `undefined` fields are left unchanged;
// pass null or "" to clear emoji/color back to auto.
function updateGroup(groupId, { name, emoji, color } = {}) {
  const cur = stmts.getGroupById.get(groupId);
  if (!cur) return null;
  const nm  = (name != null && String(name).trim()) ? String(name).trim() : cur.name;
  const em  = emoji === undefined ? cur.emoji : normEmoji(emoji);
  const col = color === undefined ? cur.color : normColor(color);
  stmts.updateGroupMeta.run(nm, em, col, groupId);
  return getGroup(groupId);
}

function setGroupReplication(groupId, replication) {
  if (!REPLICATION_PRESETS.includes(replication)) return false;
  stmts.setReplication.run(replication, groupId);
  return true;
}

function renameGroup(groupId, name) {
  stmts.renameGroupById.run(name, groupId);
}

function getUserGroups(userId) {
  return stmts.userGroups.all(userId);
}

function isMember(groupId, userId) {
  return !!stmts.getMember.get(groupId, userId);
}

// Returns the user's role in the group ('owner' | 'member'), or null if not a member.
function getMemberRole(groupId, userId) {
  const row = stmts.getMemberRole.get(groupId, userId);
  return row ? row.role : null;
}

function addMember(groupId, userId, role = "member") {
  stmts.addMember.run(groupId, userId, role);
}

function removeMember(groupId, userId) {
  stmts.removeMemberRow.run(groupId, userId);
}

// Hands ownership to another member: the current owner becomes a member and the
// target becomes the owner, atomically.
const transferOwnership = db.transaction((groupId, fromUserId, toUserId) => {
  stmts.setMemberRole.run("member", groupId, fromUserId);
  stmts.setMemberRole.run("owner", groupId, toUserId);
});

function getGroupMembers(groupId) {
  return stmts.listMembers.all(groupId);
}

function deleteGroup(id) {
  stmts.deleteGroupById.run(id); // cascades to members, invites
}

// ── Invite helpers ────────────────────────────────────────────────────────────

function createInvite(groupId, createdByUserId, expiresAt = null) {
  const code = crypto.randomBytes(9).toString("base64url"); // ~12 url-safe chars
  stmts.insertInvite.run(code, groupId, createdByUserId, expiresAt);
  return code;
}

// Returns the invite row only if it exists, is not revoked, and not expired.
function getValidInvite(code) {
  const row = stmts.getInviteByCode.get(code);
  if (!row || row.revoked) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  return row;
}

function revokeInvite(code) {
  stmts.revokeInviteCode.run(code);
}

module.exports = {
  db,
  registerNode,
  heartbeatNode,
  getNodeMap,
  getMemberNodeMap,
  deregisterNode,
  deregisterStaleNodes,
  saveFile,
  getGroupFiles,
  getGroupFileByName,
  getAllFilesWithChunks,
  deleteFileRecord,
  createUser,
  getUserByUsername,
  // groups
  createGroup,
  getGroup,
  setGroupReplication,
  renameGroup,
  updateGroup,
  getUserGroups,
  isMember,
  getMemberRole,
  addMember,
  removeMember,
  transferOwnership,
  getGroupMembers,
  deleteGroup,
  // invites
  createInvite,
  getValidInvite,
  revokeInvite,
};
