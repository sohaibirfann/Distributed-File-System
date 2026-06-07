const express = require("express");
const jwt = require("jsonwebtoken");

const { registerNode, heartbeatNode, deregisterNode } = require("../db");

const router = express.Router();

const NODE_SECRET = process.env.NODE_SECRET;

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

router.post("/register", nodeAuth, (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: "name and url required" });

  registerNode(name, url, req.nodeUserId);
  console.log(`Node registered: ${name} → ${url}${req.nodeUserId ? ` (user ${req.nodeUserId})` : ""}`);
  req.app.get("io").emit("log", `[node] ${name} registered @ ${url}`);
  res.json({ success: true });
});

router.post("/heartbeat", nodeAuth, (req, res) => {
  heartbeatNode(req.body.name);
  res.json({ ok: true });
});

router.post("/deregister", nodeAuth, (req, res) => {
  deregisterNode(req.body.name);
  req.app.get("io").emit("log", `[node] ${req.body.name} left`);
  res.json({ success: true });
});

module.exports = router;
