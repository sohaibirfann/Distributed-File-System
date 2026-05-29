require("dotenv").config();

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  console.error("ERROR: ENCRYPTION_KEY missing or invalid in .env — must be a 64-char hex string");
  console.error("Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}

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
const healthRoutes = require("./routes/healthRoutes");
const authRoutes   = require("./routes/authRoutes");
const nodeRoutes   = require("./routes/nodeRoutes");

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.set("io", io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/files",  fileRoutes);
app.use("/api",        healthRoutes);
app.use("/api/auth",   authRoutes);
app.use("/api/nodes",  nodeRoutes);

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
