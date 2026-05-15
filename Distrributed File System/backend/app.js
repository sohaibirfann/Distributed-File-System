const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

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

app.use("/api", fileRoutes);

app.use("/api", nodeRoutes);

app.use("/api", healthRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Distributed File System API Running",
  });
});

io.on("connection", (socket) => {
  console.log(
    "Frontend connected:",
    socket.id
  );

  socket.emit(
    "log",
    "Connected to distributed storage server"
  );

  socket.on("disconnect", () => {
    console.log(
      "Frontend disconnected:",
      socket.id
    );
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(
    "Backend running on port",
    PORT
  );
});

module.exports = io;