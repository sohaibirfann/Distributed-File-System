const Database = require("better-sqlite3");
const path     = require("path");

const db = new Database(path.join(__dirname, "dfs.db"));

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
};
