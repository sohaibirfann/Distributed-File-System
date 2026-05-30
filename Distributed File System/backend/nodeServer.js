require("dotenv").config();

const express = require("express");
const fs      = require("fs");
const cors    = require("cors");
const path    = require("path");
const axios   = require("axios");
const os      = require("os");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const USER        = process.argv[2] || "user1";
const PORT        = process.argv[3] || 7001;
const BACKEND_URL = process.env.BACKEND_URL;
const NODE_SECRET = process.env.NODE_SECRET;
const STORAGE     = path.join(__dirname, "node_storage", USER);

if (!BACKEND_URL) { console.error("BACKEND_URL missing in .env"); process.exit(1); }
if (!NODE_SECRET) { console.error("NODE_SECRET missing in .env"); process.exit(1); }

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const net of ifaces) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });

app.post("/store-chunk", (req, res) => {
  try {
    const { fileId, chunkId, data } = req.body;
    fs.writeFileSync(path.join(STORAGE, `${fileId}_chunk_${chunkId}`), Buffer.from(data, "base64"));
    console.log(`Stored chunk ${chunkId} for ${fileId}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/get-chunk", (req, res) => {
  try {
    const { fileId, chunkId } = req.query;
    const filePath = path.join(STORAGE, `${fileId}_chunk_${chunkId}`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Chunk not found" });
    res.json({ data: fs.readFileSync(filePath).toString("base64") });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/stats", (req, res) => {
  const files = fs.existsSync(STORAGE) ? fs.readdirSync(STORAGE) : [];
  res.json({ user: USER, chunks: files.length });
});

app.post("/delete-chunk", (req, res) => {
  try {
    const { fileId, chunkId } = req.body;
    const filePath = path.join(STORAGE, `${fileId}_chunk_${chunkId}`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`${USER} node running on port ${PORT}`);

  const NODE_URL = `http://${getLocalIP()}:${PORT}`;

  try {
    await axios.post(`${BACKEND_URL}/api/nodes/register`, { name: USER, url: NODE_URL, secret: NODE_SECRET });
    console.log(`Registered: ${USER} → ${NODE_URL}`);
  } catch (err) {
    console.error("Registration failed:", err.message);
  }

  setInterval(async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/nodes/heartbeat`, { name: USER, secret: NODE_SECRET });
    } catch {}
  }, 15_000);
});
