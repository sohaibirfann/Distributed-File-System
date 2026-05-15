const net = require("net");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 5000;
const SHARED_FOLDER = path.join(__dirname, "shared");
const CHUNK_SIZE = 4096;

const AES_KEY = crypto.scryptSync("password", "salt", 32);
const AES_IV = Buffer.alloc(16, 0);

if (!fs.existsSync(SHARED_FOLDER)) fs.mkdirSync(SHARED_FOLDER);

function encryptBuffer(buf) {
  const cipher = crypto.createCipheriv("aes-256-cbc", AES_KEY, AES_IV);
  return Buffer.concat([cipher.update(buf), cipher.final()]);
}

function decryptBuffer(buf) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", AES_KEY, AES_IV);
  return Buffer.concat([decipher.update(buf), decipher.final()]);
}

function handleClient(socket) {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log("Client connected:", addr);

  let chunks = [];

  socket.on("data", (data) => chunks.push(data));

  socket.on("end", () => {
    const raw = Buffer.concat(chunks);

    const nameLen = raw.readUInt32BE(0);
    const filename = raw.slice(4, 4 + nameLen).toString("utf8");

    console.log("File requested:", filename);

    const filePath = path.join(SHARED_FOLDER, filename);

    if (!fs.existsSync(filePath)) {
      console.log("File not found:", filename);
      socket.write(Buffer.from("FILE_NOT_FOUND"));
      socket.end();
      return;
    }

    console.log("Sending file:", filename);

    const fileData = fs.readFileSync(filePath);
    const encrypted = encryptBuffer(fileData);

    const sizeHeader = Buffer.alloc(8);
    sizeHeader.writeBigUInt64BE(BigInt(encrypted.length));
    socket.write(sizeHeader);

    let offset = 0;

    while (offset < encrypted.length) {
      const end = Math.min(offset + CHUNK_SIZE, encrypted.length);
      socket.write(encrypted.slice(offset, end));
      offset = end;
    }

    console.log("File sent successfully");
    socket.end();
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });

  socket.on("close", () => {
    console.log("Client disconnected:", addr);
  });
}

const server = net.createServer((socket) => {
  handleClient(socket);
});

server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
  console.log("Shared folder:", SHARED_FOLDER);
});

server.on("error", (err) => console.error("Server error:", err));