require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

let NODES     = {};
let LAST_SEEN = {}; // name → timestamp of last heartbeat

const fileRoutes   = require("./routes/fileRoutes");
const healthRoutes = require("./routes/healthRoutes");

const app = express();

app.set("nodes", NODES);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/files", fileRoutes);
app.use("/api",       healthRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Distributed File System API Running" });
});

io.on("connection", (socket) => {
  console.log("Frontend connected:", socket.id);
  socket.emit("log", "Connected to distributed storage server");
  socket.on("disconnect", () => {
    console.log("Frontend disconnected:", socket.id);
  });
});

const PORT = 5000;

app.post("/api/register-node", (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: "name and url are required" });

  NODES[name]     = url;
  LAST_SEEN[name] = Date.now();

  console.log(`Node registered: ${name} → ${url}`);
  io.emit("log", `[node] ${name} registered @ ${url}`);
  res.json({ success: true });
});

app.post("/api/heartbeat", (req, res) => {
  const { name } = req.body;
  if (NODES[name]) LAST_SEEN[name] = Date.now();
  res.json({ ok: true });
});

app.get("/api/nodes", async (req, res) => {
  const nodeEntries = Object.entries(NODES);

  const results = await Promise.all(
    nodeEntries.map(async ([name, url]) => {
      try {
        const start      = Date.now();
        const { data }   = await axios.get(`${url}/stats`, { timeout: 5000 });
        const latency    = Date.now() - start;

        return { name, url, status: "online",  chunks: data.chunks || 0, latency };
      } catch {
        return { name, url, status: "offline", chunks: 0,               latency: null };
      }
    }),
  );

  res.json(results);
});

server.listen(PORT, () => {
  console.log("Backend running on port", PORT);

  // Deregister nodes that have missed heartbeats for more than 60 s
  setInterval(() => {
    const now     = Date.now();
    const TIMEOUT = 60_000;
    for (const name of Object.keys(NODES)) {
      if (LAST_SEEN[name] && now - LAST_SEEN[name] > TIMEOUT) {
        delete NODES[name];
        delete LAST_SEEN[name];
        console.log(`Node deregistered (no heartbeat): ${name}`);
        io.emit("log", `[node] ${name} deregistered — heartbeat timeout`);
      }
    }
  }, 30_000);
});

module.exports = io;
