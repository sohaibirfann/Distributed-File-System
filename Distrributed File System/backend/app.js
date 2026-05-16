const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

let NODES = {};

const fileRoutes = require("./routes/fileRoutes");
const nodeRoutes = require("./routes/nodeRoutes");
const healthRoutes = require("./routes/healthRoutes");

const app = express();

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

app.use("/api", nodeRoutes);

app.use("/api", healthRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Distributed File System API Running",
  });
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

  if (!name || !url) {
    return res.status(400).json({ error: "name and url are required" });
  }

  NODES[name] = url;

  console.log(`Node registered: ${name} → ${url}`);
  res.json({ success: true });
});

app.get("/api/nodes", async (req, res) => {
  const nodeEntries = Object.entries(NODES);

  const results = await Promise.all(
    nodeEntries.map(async ([name, url]) => {
      try {
        const response = await axios.get(`${url}/stats`, {
          timeout: 5000,
        });

        console.log("SUCCESS:", name);

        const stats = await axios.get(`${url}/stats`, {
          timeout: 5000,
        });

        return {
          name,
          url,
          status: "online",
          chunks: stats.data.chunks || 0,
          replication: "Healthy",
        };
      } catch (err) {
        console.log("FAILED:", name, err.message);

        return {
          name,
          url,
          status: "offline",
          chunks: 0,
          replication: "Down",
        };
      }
    }),
  );

  res.json(results);
});

server.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});

module.exports = io;
