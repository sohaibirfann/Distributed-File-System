require("dotenv").config();

// Note: files are encrypted client-side with per-group keys — the coordinator
// never holds an encryption key. Only JWT and the node secret are needed here.
if (!process.env.JWT_SECRET) {
  console.error("ERROR: JWT_SECRET missing in .env");
  process.exit(1);
}

const express    = require("express");
const cors       = require("cors");
const http       = require("http");
const { Server } = require("socket.io");

const {
  registerNode,
  heartbeatNode,
  getNodeMap,
  deregisterStaleNodes,
} = require("./db");

const fileRoutes   = require("./routes/fileRoutes");
const authRoutes   = require("./routes/authRoutes");
const nodeRoutes   = require("./routes/nodeRoutes");
const groupRoutes  = require("./routes/groupRoutes");

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.set("io", io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Group-scoped file operations (nested so :groupId is available).
app.use("/api/groups/:groupId/files", fileRoutes);

app.use("/api/auth",   authRoutes);
app.use("/api/nodes",  nodeRoutes);
app.use("/api/groups", groupRoutes);

app.get("/", (req, res) => res.json({ message: "Distributed File System API" }));

io.on("connection", (socket) => {
  console.log("Frontend connected:", socket.id);
  socket.emit("log", "Connected to distributed storage server");
  socket.on("disconnect", () => console.log("Frontend disconnected:", socket.id));
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Backend running on port", PORT);

  setInterval(() => {
    const NODE_SECRET_TIMEOUT = 60;
    const evicted = deregisterStaleNodes(NODE_SECRET_TIMEOUT);
    for (const name of evicted) {
      console.log(`Node deregistered (no heartbeat): ${name}`);
      io.emit("log", `[node] ${name} deregistered — heartbeat timeout`);
    }
  }, 30_000);
});
