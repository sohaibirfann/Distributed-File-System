const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const os = require("os");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// arguments
const USER = process.argv[2] || "user1";
const PORT = process.argv[3] || 7001;

const BACKEND_URL = "http://192.168.1.231:5000"; // replace with your IP
const STORAGE = path.join(__dirname, "node_storage", USER);

function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (let name of Object.keys(interfaces)) {
    for (let net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
}

// create storage folder
if (!fs.existsSync(STORAGE)) {
  fs.mkdirSync(STORAGE, { recursive: true });
}

// STORE CHUNK
app.post("/store-chunk", (req, res) => {
  try {
    const { filename, chunkId, data } = req.body;

    const filePath = path.join(STORAGE, `${filename}_chunk_${chunkId}`);

    fs.writeFileSync(filePath, Buffer.from(data, "base64"));

    console.log(`Stored chunk ${chunkId} for ${filename} in ${USER}`);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET CHUNK
app.get("/get-chunk", (req, res) => {
  try {
    const { filename, chunkId } = req.query;

    const filePath = path.join(STORAGE, `${filename}_chunk_${chunkId}`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Chunk not found" });
    }

    const data = fs.readFileSync(filePath);

    res.json({
      data: data.toString("base64"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/stats", (req, res) => {
  let files = [];

  if (fs.existsSync(STORAGE)) {
    files = fs.readdirSync(STORAGE);
  }

  res.json({
    user: USER,
    chunks: files.length,
  });
});

app.post("/delete-chunk", (req, res) => {
  try {
    const { filename, chunkId } = req.body;

    const filePath = path.join(STORAGE, `${filename}_chunk_${chunkId}`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted chunk ${chunkId} of ${filename} from ${USER}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`${USER} node running on port ${PORT}`);

  const localIP  = getLocalIP();
  const NODE_URL = `http://${localIP}:${PORT}`;

  try {
    await axios.post(`${BACKEND_URL}/api/register-node`, { name: USER, url: NODE_URL });
    console.log(`Registered: ${USER} → ${NODE_URL}`);
  } catch (err) {
    console.error("Registration failed:", err.message);
  }

  setInterval(async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/heartbeat`, { name: USER });
    } catch {}
  }, 15_000);
});
