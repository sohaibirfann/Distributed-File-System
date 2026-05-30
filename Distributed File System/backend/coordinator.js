require("dotenv").config();

const fs     = require("fs");
const crypto = require("crypto");
const path   = require("path");

const { saveFile, getGroupFileByName, getGroup, getNodeMap } = require("./db");

const CHUNK_SIZE     = 512 * 1024; // 512 KB
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

// Replication presets → how many copies of each chunk to store.
// Capped to the number of nodes actually online ('max' = all of them).
const PRESET_COPIES = { minimal: 2, balanced: 3, max: Infinity };

function replicaCount(preset, nodeCount) {
  const want = PRESET_COPIES[preset] ?? PRESET_COPIES.balanced;
  return Math.max(1, Math.min(want, nodeCount));
}

function encrypt(buffer) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const enc    = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

function chunkFile(filePath) {
  const data   = fs.readFileSync(filePath);
  const chunks = [];
  let offset = 0, chunkId = 0;

  while (offset < data.length) {
    const slice = data.slice(offset, offset + CHUNK_SIZE);
    chunks.push({
      chunkId,
      data:  slice,
      hash:  crypto.createHash("sha256").update(slice).digest("hex"),
      size:  slice.length,
    });
    offset += CHUNK_SIZE;
    chunkId++;
  }
  return chunks;
}

/*
|--------------------------------------------------------------------------
| distributeFile — chunk, encrypt and spread a file across a group's nodes
|--------------------------------------------------------------------------
| Chunks are keyed on nodes by the file's unique id, so two groups can hold
| files with the same name without colliding.
*/

async function distributeFile(filePath, filename, groupId, uploadedBy, io) {
  if (!fs.existsSync(filePath)) throw new Error("Uploaded file not found on disk");

  const fileId     = crypto.randomUUID();
  const group      = getGroup(groupId);
  const preset     = group?.replication || "balanced";
  const fileChunks = chunkFile(filePath);
  const NODE_MAP   = getNodeMap();
  const USERS      = Object.keys(NODE_MAP);

  if (USERS.length === 0) {
    throw new Error("No nodes available — start at least one node before uploading");
  }

  const copies = replicaCount(preset, USERS.length);

  io.emit("upload-progress", { filename, percent: 0, distributed: 0, total: fileChunks.length });

  // Existing file with this name in the group — its chunks are cleaned up after
  // the new version is confirmed stored.
  const oldFile   = getGroupFileByName(groupId, filename);
  const oldChunks = oldFile?.chunks ?? [];
  const oldFileId = oldFile?.id ?? null;

  const distributed = []; // for rollback on failure
  const newChunks   = [];
  const seenIds     = new Set();

  for (const chunk of fileChunks) {
    // Pick `copies` distinct nodes round-robin, offset by chunkId for spread.
    const replicaUsers = [];
    for (let i = 0; i < copies; i++) {
      replicaUsers.push(USERS[(chunk.chunkId + i) % USERS.length]);
    }

    let storedCount = 0;
    const encrypted = encrypt(chunk.data);

    for (const user of replicaUsers) {
      try {
        const res = await fetch(`${NODE_MAP[user]}/store-chunk`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ fileId, chunkId: chunk.chunkId, data: encrypted }),
          signal:  AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`Node responded ${res.status}`);
        distributed.push({ user, chunkId: chunk.chunkId });
        storedCount++;
      } catch (err) {
        console.error(`Failed to send chunk ${chunk.chunkId} to ${user}: ${err.message}`);
      }
    }

    if (storedCount === 0) {
      await Promise.allSettled(distributed.map(({ user, chunkId }) =>
        fetch(`${NODE_MAP[user]}/delete-chunk`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ fileId, chunkId }),
          signal:  AbortSignal.timeout(3000),
        }),
      ));
      throw new Error(`Chunk ${chunk.chunkId} could not be stored on any node — upload rolled back`);
    }

    seenIds.add(chunk.chunkId);
    newChunks.push({ chunkId: chunk.chunkId, hash: chunk.hash, size: chunk.size, users: replicaUsers });

    const percent = Math.min(99, Math.round((seenIds.size / fileChunks.length) * 100));
    io.emit("upload-progress", { filename, percent, distributed: seenIds.size, total: fileChunks.length });
  }

  // Persist (replaces any same-name file in this group atomically).
  saveFile(fileId, groupId, filename, uploadedBy, new Date().toISOString(), newChunks);

  // Remove the old version's chunks from nodes now that the new one is confirmed.
  if (oldFileId) {
    await Promise.allSettled(
      oldChunks.flatMap((chunk) =>
        chunk.users.map((user) => {
          const nodeUrl = NODE_MAP[user];
          if (!nodeUrl) return Promise.resolve();
          return fetch(`${nodeUrl}/delete-chunk`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ fileId: oldFileId, chunkId: chunk.chunkId }),
            signal:  AbortSignal.timeout(3000),
          });
        }),
      ),
    );
    const oldCache = path.join(__dirname, "shared", oldFileId);
    if (fs.existsSync(oldCache)) fs.unlinkSync(oldCache);
  }

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  io.emit("upload-progress", { filename, percent: 100, done: true });
  io.emit("log", `[replication] ${filename} · ${newChunks.length} chunks × ${copies} ${copies === 1 ? "copy" : "copies"} (${preset})`);
}

module.exports = { distributeFile };
