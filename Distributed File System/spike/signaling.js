// Minimal signaling server — the future coordinator's "control plane", stripped
// to the essentials. It only relays WebRTC handshake messages between peers in a
// room. It never sees chunk data — that flows peer-to-peer over WebRTC.

const { Server } = require("socket.io");

const PORT = process.env.SIGNAL_PORT || 9000;
const ROOM = "spike-room";

const io = new Server(PORT, { cors: { origin: "*" } });
console.log(`[signal] signaling server listening on :${PORT}`);

io.on("connection", (socket) => {
  socket.join(ROOM);

  const size = io.sockets.adapter.rooms.get(ROOM)?.size ?? 0;
  console.log(`[signal] peer connected ${socket.id} — ${size} in room`);

  // Relay any handshake message to the other peer(s) in the room.
  socket.on("signal", (data) => {
    socket.to(ROOM).emit("signal", data);
  });

  // Once two peers are present, tell the room to start the handshake.
  if (size >= 2) {
    io.to(ROOM).emit("ready");
    console.log("[signal] room ready — 2 peers present, handshake can begin");
  }

  socket.on("disconnect", () => {
    console.log(`[signal] peer disconnected ${socket.id}`);
  });
});
