const express = require("express");
const axios   = require("axios");

const { registerNode, heartbeatNode, getNodeMap } = require("../db");

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

// GET /api/nodes
router.get("/", async (req, res) => {
  const NODE_MAP = getNodeMap();

  const results = await Promise.all(
    Object.entries(NODE_MAP).map(async ([name, url]) => {
      try {
        const start    = Date.now();
        const { data } = await axios.get(`${url}/stats`, { timeout: 5000 });
        return { name, url, status: "online",  chunks: data.chunks || 0, latency: Date.now() - start };
      } catch {
        return { name, url, status: "offline", chunks: 0, latency: null };
      }
    }),
  );

  res.json(results);
});

module.exports = router;
