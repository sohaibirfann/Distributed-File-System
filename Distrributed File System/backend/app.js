const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const fileRoutes = require("./routes/fileRoutes");
const nodeRoutes = require("./routes/nodeRoutes");
const healthRoutes = require("./routes/healthRoutes");

const app = express();

/*
|--------------------------------------------------------------------------
| HTTP Server
|--------------------------------------------------------------------------
*/

const server = http.createServer(app);

/*
|--------------------------------------------------------------------------
| Socket.IO
|--------------------------------------------------------------------------
*/

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use("/api", fileRoutes);

app.use("/api", nodeRoutes);

app.use("/api", healthRoutes);

/*
|--------------------------------------------------------------------------
| Root
|--------------------------------------------------------------------------
*/

app.get("/", (_, res) => {
  res.json({
    success: true,
    message:
      "Distributed File System API Running",
  });
});

/*
|--------------------------------------------------------------------------
| Socket Events
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Server Start
|--------------------------------------------------------------------------
*/

const PORT =
  process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `Backend running on port ${PORT}`
  );
});

module.exports = io;