const express = require("express");

const { registerNode, heartbeatNode } = require("../db");

const router = express.Router();

const NODE_SECRET = process.env.NODE_SECRET;

// POST /api/nodes/register
router.post("/register", (req, res) => {
  const { name, url, secret } = req.body;

  if (!name || !url)            return res.status(400).json({ error: "name and url required" });
  if (secret !== NODE_SECRET)   return res.status(401).json({ error: "invalid node secret" });

  registerNode(name, url);
  console.log(`Node registered: ${name} → ${url}`);
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

module.exports = router;
