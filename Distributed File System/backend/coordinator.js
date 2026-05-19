require("dotenv").config();

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  console.error("ERROR: ENCRYPTION_KEY missing or invalid in .env — must be a 64-char hex string");
  process.exit(1);
}

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const axios = require("axios");

const CHUNK_SIZE = 4 * 1024;
const METADATA_FILE = path.join(__dirname, "metadata.json");

const BACKEND_URL = "http://localhost:5000";

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

// AES-256-GCM: output is base64(iv[12] + authTag[16] + ciphertext)
function encrypt(buffer) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const enc    = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

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

    console.log("File:", filename);
    console.log("Total chunks:", fileChunks.length);

    const NODE_MAP = await getNodes();
    const USERS = Object.keys(NODE_MAP);

    if (USERS.length === 0) {
      console.error("No nodes available — start at least one node before uploading");
      process.exit(1);
    }

    // If file already exists, delete old chunks from nodes before overwriting
    if (metadata[filename]) {
      const oldChunks = Array.isArray(metadata[filename])
        ? metadata[filename]
        : (metadata[filename]?.chunks ?? []);

      for (const chunk of oldChunks) {
        for (const user of chunk.users) {
          if (!NODE_MAP[user]) continue;
          try {
            await fetch(`${NODE_MAP[user]}/delete-chunk`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename, chunkId: chunk.chunkId }),
            });
          } catch {}
        }
      }

      // Purge from shared cache
      const cachedPath = path.join(__dirname, "shared", filename);
      if (fs.existsSync(cachedPath)) fs.unlinkSync(cachedPath);

      console.log("Replaced existing file — old chunks removed");
    }

    metadata[filename] = { uploadedAt: new Date().toISOString(), chunks: [] };

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
              data: encrypt(chunk.data),
            }),
          });

          console.log(`Chunk ${chunk.chunkId} sent to ${user}`);
        } catch (err) {
          console.error(`Failed to send chunk ${chunk.chunkId} to ${user}`);
        }
      }

      metadata[filename].chunks.push({
        chunkId: chunk.chunkId,
        hash: chunk.hash,
        size: chunk.size,
        users: replicaUsers,
      });
    }

    saveMetadata();
    console.log("All chunks distributed successfully");
  })();
}
