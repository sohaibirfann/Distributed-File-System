// In-process storage node for the desktop app.
//
// When the user enables "Contribute storage", the app runs this tiny HTTP node
// so the coordinator can push/pull encrypted chunks to/from this machine — the
// same role the standalone backend/nodeServer.js plays, but embedded in the
// desktop client. It only ever sees ciphertext; the group key never leaves the
// renderer.
//
// Transport is HTTP for now, so it only works on the same network as the
// coordinator. The planned WebRTC transport will swap these endpoints for
// peer-to-peer data channels and make it cross-network.

const http = require("http");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const net of ifaces) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

function dirSize(dir) {
  let total = 0;
  try {
    for (const name of fs.readdirSync(dir)) {
      try { total += fs.statSync(path.join(dir, name)).size; } catch { /* skip */ }
    }
  } catch { /* dir missing yet */ }
  return total;
}

function readJson(req, limit = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("payload too large")); req.destroy(); return; }
      parts.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(parts).toString() || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const chunkPath = (dir, fileId, chunkId) => path.join(dir, `${fileId}_chunk_${chunkId}`);

class StorageNode {
  constructor({ name, port, storageDir, quotaBytes, coordUrl, token, secret, userId }) {
    this.name       = name;
    this.port       = port;
    this.storageDir = storageDir;
    this.quotaBytes = quotaBytes;
    this.coordUrl   = coordUrl;
    this.token      = token ?? null;   // member JWT — primary auth to the coordinator
    this.secret     = secret;          // shared-secret fallback (dev/standalone)
    this.userId     = userId ?? null;
    this.server     = null;
    this.heartbeat  = null;
    this.registered = false;
  }

  // Coordinator auth: the member's JWT if we have one, plus the secret/userId in
  // the body as a fallback (the coordinator tries the token first).
  _headers() {
    const h = { "Content-Type": "application/json" };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  async start() {
    fs.mkdirSync(this.storageDir, { recursive: true });
    this.server = http.createServer((req, res) => this._handle(req, res));
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, "0.0.0.0", resolve);
    });
    await this._register();
    this.heartbeat = setInterval(() => this._heartbeat(), 15_000);
    return { url: this._url() };
  }

  async stop() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    // Tell the coordinator we're leaving so it drops us from the pool at once
    // (otherwise we linger until the heartbeat-timeout sweep).
    try {
      await fetch(`${this.coordUrl}/api/nodes/deregister`, {
        method:  "POST",
        headers: this._headers(),
        body:    JSON.stringify({ name: this.name, secret: this.secret }),
      });
    } catch { /* coordinator down — the stale sweep will clean us up */ }
    if (this.server) await new Promise((r) => this.server.close(r));
    this.server = null;
    this.registered = false;
  }

  status() {
    let chunks = 0;
    try { chunks = fs.readdirSync(this.storageDir).length; } catch { /* none yet */ }
    return {
      running:    !!this.server,
      registered: this.registered,
      chunks,
      bytes:      dirSize(this.storageDir),
      quotaBytes: this.quotaBytes,
      url:        this._url(),
    };
  }

  _url() { return `http://${getLocalIP()}:${this.port}`; }

  async _register() {
    try {
      const res = await fetch(`${this.coordUrl}/api/nodes/register`, {
        method:  "POST",
        headers: this._headers(),
        body:    JSON.stringify({ name: this.name, url: this._url(), secret: this.secret, userId: this.userId }),
      });
      this.registered = res.ok;
    } catch { this.registered = false; }
  }

  async _heartbeat() {
    try {
      const res = await fetch(`${this.coordUrl}/api/nodes/heartbeat`, {
        method:  "POST",
        headers: this._headers(),
        body:    JSON.stringify({ name: this.name, secret: this.secret }),
      });
      // If the coordinator forgot us (restarted), re-register.
      if (!res.ok) await this._register();
    } catch { /* coordinator unreachable; retry on next tick */ }
  }

  async _handle(req, res) {
    const json = (code, obj) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    try {
      const u = new URL(req.url, "http://localhost");

      if (req.method === "POST" && u.pathname === "/store-chunk") {
        const { fileId, chunkId, data } = await readJson(req);
        const buf = Buffer.from(data, "base64");
        if (dirSize(this.storageDir) + buf.length > this.quotaBytes) {
          return json(507, { error: "storage quota exceeded" });
        }
        fs.writeFileSync(chunkPath(this.storageDir, fileId, chunkId), buf);
        return json(200, { success: true });
      }

      if (req.method === "GET" && u.pathname === "/get-chunk") {
        const fileId  = u.searchParams.get("fileId");
        const chunkId = u.searchParams.get("chunkId");
        const p = chunkPath(this.storageDir, fileId, chunkId);
        if (!fs.existsSync(p)) return json(404, { error: "Chunk not found" });
        return json(200, { data: fs.readFileSync(p).toString("base64") });
      }

      if (req.method === "POST" && u.pathname === "/delete-chunk") {
        const { fileId, chunkId } = await readJson(req);
        const p = chunkPath(this.storageDir, fileId, chunkId);
        if (fs.existsSync(p)) fs.unlinkSync(p);
        return json(200, { success: true });
      }

      if (req.method === "GET" && u.pathname === "/stats") {
        return json(200, this.status());
      }

      json(404, { error: "not found" });
    } catch (err) {
      json(500, { error: err.message });
    }
  }
}

module.exports = { StorageNode, getLocalIP };
