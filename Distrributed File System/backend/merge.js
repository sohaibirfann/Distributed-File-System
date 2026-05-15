const fs = require("fs");
const path = require("path");
const axios = require("axios");

const OUTPUT_FOLDER = path.join(
  __dirname,
  "merged"
);

const METADATA_FILE = path.join(
  __dirname,
  "metadata.json"
);

if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER);
}

/*
|--------------------------------------------------------------------------
| Download Chunk From Node
|--------------------------------------------------------------------------
*/

async function downloadChunk(
  nodeUrl,
  chunkName
) {
  try {
    const response = await axios.get(
      `${nodeUrl}/chunk/${chunkName}`,
      {
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(response.data);
  } catch (error) {
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| Merge File
|--------------------------------------------------------------------------
*/

async function mergeFile(filename) {
  if (!fs.existsSync(METADATA_FILE)) {
    console.log(
      "metadata.json not found"
    );

    return;
  }

  const metadata = JSON.parse(
    fs.readFileSync(
      METADATA_FILE,
      "utf8"
    )
  );

  const chunks = metadata[filename];

  if (!Array.isArray(chunks)) {
    console.log(
      "No chunk metadata found"
    );

    return;
  }

  chunks.sort(
    (a, b) =>
      a.chunkId - b.chunkId
  );

  const mergedParts = [];

  /*
  |--------------------------------------------------------------------------
  | Retrieve Chunks
  |--------------------------------------------------------------------------
  */

  for (const chunk of chunks) {
    let found = false;

    for (const node of chunk.nodes) {
      const chunkName = `${filename}_chunk_${chunk.chunkId}`;

      console.log(
        `Trying chunk ${chunk.chunkId} from ${node}`
      );

      const data =
        await downloadChunk(
          node,
          chunkName
        );

      if (data) {
        mergedParts.push(data);

        console.log(
          `Chunk ${chunk.chunkId} loaded from ${node}`
        );

        found = true;

        break;
      }
    }

    if (!found) {
      console.log(
        `Chunk ${chunk.chunkId} missing`
      );

      return;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Merge Chunks
  |--------------------------------------------------------------------------
  */

  const finalBuffer = Buffer.concat(
    mergedParts
  );

  const outputPath = path.join(
    OUTPUT_FOLDER,
    filename
  );

  fs.writeFileSync(
    outputPath,
    finalBuffer
  );

  console.log(
    "Merged file saved at:",
    outputPath
  );
}

/*
|--------------------------------------------------------------------------
| CLI
|--------------------------------------------------------------------------
*/

const filename = process.argv[2];

if (!filename) {
  console.log(
    "Usage: node merge.js <filename>"
  );

  process.exit(1);
}

mergeFile(filename);