const express = require("express");
const jwt = require("jsonwebtoken");

const { registerNode, heartbeatNode, deregisterNode } = require("../db");

const router = express.Router();

const NODE_SECRET = process.env.NODE_SECRET;

// Authenticate a node request one of two ways:
//   1) the member's JWT (Authorization: Bearer …) → the node belongs to that user.
//      This is how the desktop app registers, so members never need to know a
//      shared secret of whatever coordinator they connect to (self-hosted model).
//   2) the shared NODE_SECRET in the body → standalone/dev nodes; userId trusted
//      from the body. Kept for `backend/nodeServer.js` and headless setups.
function nodeAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.nodeUserId = jwt.verify(header.slice(7), process.env.JWT_SECRET).id;
      return next();
    } catch { /* not a valid token — fall through to the secret path */ }
  }
  if (NODE_SECRET && req.body.secret === NODE_SECRET) {
    req.nodeUserId = req.body.userId ?? null;
    return next();
  }
  return res.status(401).json({ error: "node auth required (sign in or node secret)" });
}

// POST /api/nodes/register — ties the node to a user so a group's files land on
// its own members' machines (userId comes from the JWT, or the trusted body for
// secret auth).
router.post("/register", nodeAuth, (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: "name and url required" });

  registerNode(name, url, req.nodeUserId);
  console.log(`Node registered: ${name} → ${url}${req.nodeUserId ? ` (user ${req.nodeUserId})` : ""}`);
  req.app.get("io").emit("log", `[node] ${name} registered @ ${url}`);
  res.json({ success: true });
});

// POST /api/nodes/heartbeat
router.post("/heartbeat", nodeAuth, (req, res) => {
  heartbeatNode(req.body.name);
  res.json({ ok: true });
});

// POST /api/nodes/deregister — a node leaving cleanly (contribute toggled off / quit)
router.post("/deregister", nodeAuth, (req, res) => {
  deregisterNode(req.body.name);
  req.app.get("io").emit("log", `[node] ${req.body.name} left`);
  res.json({ success: true });
});

module.exports = router;
