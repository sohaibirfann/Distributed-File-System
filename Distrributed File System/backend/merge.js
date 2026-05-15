const fs = require("fs");
const path = require("path");

const OUTPUT_FOLDER = path.join(__dirname, "merged");
const METADATA_FILE = path.join(__dirname, "metadata.json");

// Ensure output folder exists
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER);
}

// Map users → node URLs
const NODE_MAP = {
  user1: "http://localhost:7001",
  user2: "http://localhost:7002",
  user3: "http://localhost:7003",
};

// Fetch chunk from node
async function fetchChunk(user, filename, chunkId) {
  const nodeUrl = NODE_MAP[user];

  const res = await fetch(
    `${nodeUrl}/get-chunk?filename=${filename}&chunkId=${chunkId}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch chunk ${chunkId} from ${user}`);
  }

  const data = await res.json();

  return Buffer.from(data.data, "base64");
}

// Main merge function
async function mergeFile(filename) {
  if (!fs.existsSync(METADATA_FILE)) {
    console.log("metadata.json not found");
    return;
  }

  const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf8"));

  console.log("Requested filename:", filename);
  console.log("Available files:", Object.keys(metadata));

  const key = Object.keys(metadata).find((k) => k.trim() === filename.trim());

  const chunks = metadata[key];

  if (!Array.isArray(chunks)) {
    console.log("No chunk metadata found");
    return;
  }

  chunks.sort((a, b) => a.chunkId - b.chunkId);

  const mergedParts = [];

  for (const chunk of chunks) {
    let chunkBuffer = null;

    for (const user of chunk.users) {
      try {
        chunkBuffer = await fetchChunk(user, filename, chunk.chunkId);

        console.log("Chunk", chunk.chunkId, "fetched from", user);

        break;
      } catch (err) {
        console.log(`Failed from ${user}, trying next...`);
      }
    }

    if (!chunkBuffer) {
      console.log("Chunk", chunk.chunkId, "missing from all replicas");
      return;
    }

    mergedParts.push(chunkBuffer);
  }

  const finalBuffer = Buffer.concat(mergedParts);
  const outputPath = path.join(OUTPUT_FOLDER, filename);

  fs.writeFileSync(outputPath, finalBuffer);

  console.log("Merged file saved at:", outputPath);
}

// Entry point
(async () => {
  const filename = process.argv[2];

  if (!filename) {
    console.log("Usage: node merge.js <filename>");
    process.exit(1);
  }

  await mergeFile(filename);
})();
