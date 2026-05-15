const net = require("net");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 5000;
const DOWNLOAD_FOLDER = path.join(__dirname, "downloads");
const CHUNK_FOLDER = path.join(__dirname, "client_chunks");

const AES_KEY = crypto.scryptSync("password", "salt", 32);
const AES_IV = Buffer.alloc(16, 0);

if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);
if (!fs.existsSync(CHUNK_FOLDER)) fs.mkdirSync(CHUNK_FOLDER);

function decryptBuffer(buf) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", AES_KEY, AES_IV);
  return Buffer.concat([decipher.update(buf), decipher.final()]);
}

function requestFile(filename) {
  console.log("Connecting to server:", SERVER_HOST + ":" + SERVER_PORT);

  const socket = net.createConnection(
    { host: SERVER_HOST, port: SERVER_PORT },
    () => {
      console.log("Connected. Requesting:", filename);

      const nameBuf = Buffer.from(filename);
      const header = Buffer.alloc(4);
      header.writeUInt32BE(nameBuf.length);

      socket.write(Buffer.concat([header, nameBuf]));
      socket.end();
    }
  );

  let chunks = [];

  socket.on("data", (data) => chunks.push(data));

  socket.on("end", () => {
    const raw = Buffer.concat(chunks);

    if (raw.toString() === "FILE_NOT_FOUND") {
      console.log("File not found:", filename);
      return;
    }

    const encryptedData = raw.slice(8);
    const fileData = decryptBuffer(encryptedData);

    // 🔥 BREAK INTO CHUNKS AGAIN (for demo)
    const CHUNK_SIZE = 4 * 1024;
    let offset = 0;
    let index = 0;

    console.log("\nBefore merging (client side chunks):");

    while (offset < fileData.length) {
      const slice = fileData.slice(offset, offset + CHUNK_SIZE);

      const chunkPath = path.join(
        CHUNK_FOLDER,
        filename + "_chunk_" + index
      );

      fs.writeFileSync(chunkPath, slice);

      console.log("Saved:", filename + "_chunk_" + index);

      offset += CHUNK_SIZE;
      index++;
    }

    console.log("\nTotal chunks received:", index);

    console.log("\nNow run merge.js to combine chunks");
  });

  socket.on("error", (err) => {
    console.error("Connection error:", err.message);
  });
}

const filename = process.argv[2];

if (!filename) {
  console.log("Usage: node client.js <filename>");
  process.exit(1);
}

requestFile(filename);