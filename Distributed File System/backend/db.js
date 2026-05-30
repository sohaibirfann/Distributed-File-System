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
    last_seen INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    filename    TEXT PRIMARY KEY,
    uploaded_at TEXT    NOT NULL DEFAULT (datetime('now')),
    total_size  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT    NOT NULL REFERENCES files(filename) ON DELETE CASCADE,
    chunk_id INTEGER NOT NULL,
    hash     TEXT    NOT NULL,
    size     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(filename, chunk_id)
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
    id         TEXT PRIMARY KEY,
    name       TEXT    NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
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

// ── Nodes ─────────────────────────────────────────────────────────────────────

const stmts = {
  upsertNode:   db.prepare(`INSERT INTO nodes (name, url, last_seen) VALUES (?, ?, unixepoch())
                             ON CONFLICT(name) DO UPDATE SET url = excluded.url, last_seen = unixepoch()`),
  heartbeat:    db.prepare(`UPDATE nodes SET last_seen = unixepoch() WHERE name = ?`),
  getNodes:     db.prepare(`SELECT name, url FROM nodes`),
  deleteNode:   db.prepare(`DELETE FROM nodes WHERE name = ?`),
  staleNodes:   db.prepare(`SELECT name FROM nodes WHERE last_seen < unixepoch() - ?`),

  // Files
  upsertFile:   db.prepare(`INSERT INTO files (filename, uploaded_at, total_size) VALUES (?, ?, ?)
                             ON CONFLICT(filename) DO UPDATE SET uploaded_at = excluded.uploaded_at, total_size = excluded.total_size`),
  getFile:      db.prepare(`SELECT * FROM files WHERE filename = ?`),
  getAllFiles:  db.prepare(`SELECT * FROM files ORDER BY uploaded_at DESC`),
  deleteFile:   db.prepare(`DELETE FROM files WHERE filename = ?`),

  // Chunks
  insertChunk:  db.prepare(`INSERT OR REPLACE INTO chunks (filename, chunk_id, hash, size) VALUES (?, ?, ?, ?)`),
  getChunks:    db.prepare(`SELECT id, chunk_id, hash, size FROM chunks WHERE filename = ? ORDER BY chunk_id ASC`),
  deleteChunks: db.prepare(`DELETE FROM chunks WHERE filename = ?`),

  // Chunk nodes
  insertChunkNode: db.prepare(`INSERT OR IGNORE INTO chunk_nodes (chunk_pk, node_name) VALUES (?, ?)`),
  getChunkNodes:   db.prepare(`SELECT node_name FROM chunk_nodes WHERE chunk_pk = ?`),

  // Users
  createUser:       db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`),
  getUserByName:    db.prepare(`SELECT * FROM users WHERE username = ?`),
  countAdmins:      db.prepare(`SELECT COUNT(*) as n FROM users WHERE role = 'admin'`),

  // Groups
  insertGroup:      db.prepare(`INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)`),
  getGroupById:     db.prepare(`SELECT * FROM groups WHERE id = ?`),
  deleteGroupById:  db.prepare(`DELETE FROM groups WHERE id = ?`),
  userGroups:       db.prepare(`SELECT g.* FROM groups g
                                  JOIN group_members m ON m.group_id = g.id
                                 WHERE m.user_id = ?
                                 ORDER BY g.created_at`),

  // Group members
  addMember:        db.prepare(`INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`),
  getMember:        db.prepare(`SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`),
  listMembers:      db.prepare(`SELECT m.user_id, m.role, m.joined_at, u.username
                                  FROM group_members m JOIN users u ON u.id = m.user_id
                                 WHERE m.group_id = ? ORDER BY m.joined_at`),

  // Invites
  insertInvite:     db.prepare(`INSERT INTO invites (code, group_id, created_by, expires_at) VALUES (?, ?, ?, ?)`),
  getInviteByCode:  db.prepare(`SELECT * FROM invites WHERE code = ?`),
  revokeInviteCode: db.prepare(`UPDATE invites SET revoked = 1 WHERE code = ?`),
};

// ── Node helpers ──────────────────────────────────────────────────────────────

function registerNode(name, url) {
  stmts.upsertNode.run(name, url);
}

function heartbeatNode(name) {
  stmts.heartbeat.run(name);
}

function getNodeMap() {
  const rows = stmts.getNodes.all();
  return Object.fromEntries(rows.map((r) => [r.name, r.url]));
}

function deregisterStaleNodes(timeoutSeconds) {
  const stale = stmts.staleNodes.all(timeoutSeconds);
  for (const { name } of stale) stmts.deleteNode.run(name);
  return stale.map((r) => r.name);
}

// ── File helpers ──────────────────────────────────────────────────────────────

// chunks: [{ chunkId, hash, size, users: [nodeName, ...] }]
const saveFile = db.transaction((filename, uploadedAt, chunks) => {
  const totalSize = chunks.reduce((s, c) => s + c.size, 0);
  stmts.upsertFile.run(filename, uploadedAt, totalSize);
  stmts.deleteChunks.run(filename);

  for (const chunk of chunks) {
    stmts.insertChunk.run(filename, chunk.chunkId, chunk.hash, chunk.size);
    const row = db.prepare(`SELECT id FROM chunks WHERE filename = ? AND chunk_id = ?`).get(filename, chunk.chunkId);
    for (const nodeName of chunk.users) {
      stmts.insertChunkNode.run(row.id, nodeName);
    }
  }
});

function getFileWithChunks(filename) {
  const file = stmts.getFile.get(filename);
  if (!file) return null;
  const chunks = stmts.getChunks.all(filename).map((c) => ({
    chunkId: c.chunk_id,
    hash:    c.hash,
    size:    c.size,
    users:   stmts.getChunkNodes.all(c.id).map((r) => r.node_name),
  }));
  return { ...file, chunks };
}

function getAllFilesWithChunks() {
  const files = stmts.getAllFiles.all();
  return files.map((f) => {
    const chunks = stmts.getChunks.all(f.filename).map((c) => ({
      chunkId: c.chunk_id,
      hash:    c.hash,
      size:    c.size,
      users:   stmts.getChunkNodes.all(c.id).map((r) => r.node_name),
    }));
    return { ...f, chunks };
  });
}

function deleteFileRecord(filename) {
  stmts.deleteFile.run(filename); // cascades to chunks + chunk_nodes
}

// ── User helpers ──────────────────────────────────────────────────────────────

function createUser(username, passwordHash, role = "user") {
  stmts.createUser.run(username, passwordHash, role);
}

function getUserByUsername(username) {
  return stmts.getUserByName.get(username);
}

function adminExists() {
  return stmts.countAdmins.get().n > 0;
}

// ── Group helpers ─────────────────────────────────────────────────────────────

// Creates a group and adds its creator as the 'owner' member, atomically.
const createGroup = db.transaction((name, createdByUserId) => {
  const id = crypto.randomUUID();
  stmts.insertGroup.run(id, name, createdByUserId);
  stmts.addMember.run(id, createdByUserId, "owner");
  return { id, name, created_by: createdByUserId };
});

function getGroup(id) {
  return stmts.getGroupById.get(id) || null;
}

function getUserGroups(userId) {
  return stmts.userGroups.all(userId);
}

function isMember(groupId, userId) {
  return !!stmts.getMember.get(groupId, userId);
}

function addMember(groupId, userId, role = "member") {
  stmts.addMember.run(groupId, userId, role);
}

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
  deregisterStaleNodes,
  saveFile,
  getFileWithChunks,
  getAllFilesWithChunks,
  deleteFileRecord,
  createUser,
  getUserByUsername,
  adminExists,
  // groups
  createGroup,
  getGroup,
  getUserGroups,
  isMember,
  addMember,
  getGroupMembers,
  deleteGroup,
  // invites
  createInvite,
  getValidInvite,
  revokeInvite,
};
