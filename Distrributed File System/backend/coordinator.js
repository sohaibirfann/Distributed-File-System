const net = require("net");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const axios = require("axios");

const COORD_PORT = 6000;
const CHUNK_SIZE = 4 * 1024;
const METADATA_FILE = path.join(__dirname, "metadata.json");

const BACKEND_URL = "http://localhost:5000";

// const USERS_FOLDER = path.join(__dirname, "users");

// // Get user folders
// const USERS = fs
//   .readdirSync(USERS_FOLDER)
//   .filter((file) => fs.statSync(path.join(USERS_FOLDER, file)).isDirectory());

// // Ensure users folder exists
// if (!fs.existsSync(USERS_FOLDER)) {
//   fs.mkdirSync(USERS_FOLDER);
// }

// Load metadata

async function getNodes() {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/nodes`);

    const nodes = res.data;

    const map = {};

    nodes.forEach((node) => {
      map[node.name] = node.url;
    });

    return map;
  } catch (err) {
    console.error("Failed to fetch nodes");
    return {};
  }
}

let metadata = {};

if (fs.existsSync(METADATA_FILE)) {
  metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf8"));
}

function saveMetadata() {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

// Split file into chunks
function chunkFile(filePath) {
  const data = fs.readFileSync(filePath);
  const chunks = [];

  let offset = 0;
  let chunkId = 0;

  while (offset < data.length) {
    const slice = data.slice(offset, offset + CHUNK_SIZE);

    const hash = crypto.createHash("sha256").update(slice).digest("hex");

    chunks.push({
      chunkId,
      data: slice,
      hash,
      size: slice.length,
    });

    offset += CHUNK_SIZE;
    chunkId++;
  }

  return chunks;
}

// Dummy TCP handler (unchanged)
function handleRequest(socket) {
  socket.on("data", () => {});
  socket.on("end", () => {
    socket.end();
  });
}

// ----------------------------
// 🚀 UPLOAD (DISTRIBUTED)
// ----------------------------

if (process.argv[2] === "upload") {
  (async () => {
    const filePath = process.argv[3];

    if (!fs.existsSync(filePath)) {
      console.log("File not found");
      process.exit(1);
    }

    const filename = path.basename(filePath);
    const fileChunks = chunkFile(filePath);

    metadata[filename] = [];

    console.log("File:", filename);
    console.log("Total chunks:", fileChunks.length);

    // // Node mapping
    const NODE_MAP = await getNodes();
    const USERS = Object.keys(NODE_MAP);

    if (USERS.length === 0) {
      console.log("No nodes available");
      process.exit(1);
    }

    for (const chunk of fileChunks) {
      const first = USERS[chunk.chunkId % USERS.length];
      const second = USERS[(chunk.chunkId + 1) % USERS.length];

      const replicaUsers = [first, second];

      for (const user of replicaUsers) {
        const nodeUrl = NODE_MAP[user];

        try {
          await fetch(`${nodeUrl}/store-chunk`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filename,
              chunkId: chunk.chunkId,
              data: chunk.data.toString("base64"),
            }),
          });

          console.log(`Chunk ${chunk.chunkId} sent to ${user}`);
        } catch (err) {
          console.error(`Failed to send chunk ${chunk.chunkId} to ${user}`);
        }
      }

      metadata[filename].push({
        chunkId: chunk.chunkId,
        hash: chunk.hash,
        users: replicaUsers,
      });
    }

    saveMetadata();
    console.log("All chunks distributed successfully");
  })();
}

// ----------------------------
// TCP SERVER (UNCHANGED)
// ----------------------------

if (process.argv[2] !== "upload") {
  const coordinator = net.createServer(handleRequest);

  coordinator.listen(COORD_PORT, () => {
    console.log("Coordinator running on port", COORD_PORT);
  });
}
