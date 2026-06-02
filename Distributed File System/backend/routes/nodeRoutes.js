const express = require("express");

const { registerNode, heartbeatNode, deregisterNode } = require("../db");

const router = express.Router();

const NODE_SECRET = process.env.NODE_SECRET;

// POST /api/nodes/register
// `userId` ties the node to a user so a group's files land on its own members'
// machines. It's trusted under the shared NODE_SECRET (same trust level as today;
// JWT-based node identity is the planned hardening). Standalone nodes omit it.
router.post("/register", (req, res) => {
  const { name, url, secret, userId } = req.body;

  if (!name || !url)            return res.status(400).json({ error: "name and url required" });
  if (secret !== NODE_SECRET)   return res.status(401).json({ error: "invalid node secret" });

  registerNode(name, url, userId ?? null);
  console.log(`Node registered: ${name} → ${url}${userId ? ` (user ${userId})` : ""}`);
  req.app.get("io").emit("log", `[node] ${name} registered @ ${url}`);
  res.json({ success: true });
});

// POST /api/nodes/heartbeat
router.post("/heartbeat", (req, res) => {
  const { name, secret } = req.body;
  if (secret !== NODE_SECRET) return res.status(401).json({ error: "invalid node secret" });
  heartbeatNode(name);
  res.json({ ok: true });
});

// POST /api/nodes/deregister — a node leaving cleanly (contribute toggled off / quit)
router.post("/deregister", (req, res) => {
  const { name, secret } = req.body;
  if (secret !== NODE_SECRET) return res.status(401).json({ error: "invalid node secret" });
  deregisterNode(name);
  req.app.get("io").emit("log", `[node] ${name} left`);
  res.json({ success: true });
});

module.exports = router;
