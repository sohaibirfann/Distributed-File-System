const fs = require("fs");
const path = require("path");

const USERS_FOLDER = path.join(__dirname, "users");
const OUTPUT_FOLDER = path.join(__dirname, "merged");
const METADATA_FILE = path.join(__dirname, "metadata.json");

if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER);
}

function mergeFile(filename) {
  if (!fs.existsSync(METADATA_FILE)) {
    console.log("metadata.json not found");
    return;
  }

  const metadata = JSON.parse(
    fs.readFileSync(METADATA_FILE, "utf8")
  );

  const chunks = metadata[filename];

  if (!Array.isArray(chunks)) {
    console.log("No chunk metadata found");
    return;
  }

  chunks.sort((a, b) => a.chunkId - b.chunkId);

  const mergedParts = [];

  for (const chunk of chunks) {
    let found = false;

    for (const user of chunk.users) {
      const chunkPath = path.join(
        USERS_FOLDER,
        user,
        `${filename}_chunk_${chunk.chunkId}`
      );

      if (fs.existsSync(chunkPath)) {
        mergedParts.push(fs.readFileSync(chunkPath));
        console.log("Chunk", chunk.chunkId, "loaded from", user);
        found = true;
        break;
      }
    }

    if (!found) {
      console.log("Chunk", chunk.chunkId, "missing");
      return;
    }
  }

  const finalBuffer = Buffer.concat(mergedParts);
  const outputPath = path.join(OUTPUT_FOLDER, filename);

  fs.writeFileSync(outputPath, finalBuffer);

  console.log("Merged file saved at:", outputPath);
}

const filename = process.argv[2];

if (!filename) {
  console.log("Usage: node merge.js <filename>");
  process.exit(1);
}

mergeFile(filename);