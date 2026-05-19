const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");

const SHARED_FOLDER   = path.join(__dirname, "../shared");
const METADATA_FILE   = path.join(__dirname, "../metadata.json");
const CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

function clientIP(req) {
  return (req.ip || "").replace(/^::ffff:/, "") || "unknown";
}

// Supports both old format (plain array) and new format ({ uploadedAt, chunks })
function getChunks(entry) {
  return Array.isArray(entry) ? entry : (entry?.chunks ?? []);
}

/*
|--------------------------------------------------------------------------
| Helper: Evict oldest cached files until there is room for incomingBytes
|--------------------------------------------------------------------------
*/

function evictCache(incomingBytes) {
  if (!fs.existsSync(SHARED_FOLDER)) return;

  const entries = fs.readdirSync(SHARED_FOLDER)
    .map((name) => {
      const p    = path.join(SHARED_FOLDER, name);
      const stat = fs.statSync(p);
      return { p, size: stat.size, mtime: stat.mtimeMs };
    })
    .sort((a, b) => a.mtime - b.mtime); // oldest first

  let total = entries.reduce((sum, e) => sum + e.size, 0) + incomingBytes;

  for (const entry of entries) {
    if (total <= CACHE_MAX_BYTES) break;
    fs.unlinkSync(entry.p);
    total -= entry.size;
  }
}

/*
|--------------------------------------------------------------------------
| Helper: Get dynamic nodes
|--------------------------------------------------------------------------
*/

async function getNodeMap() {
  try {
    const res = await axios.get("http://localhost:5000/api/nodes");

    const nodes = res.data;

    const map = {};

    nodes.forEach((node) => {
      map[node.name] = node.url;
    });

    return map;
  } catch (err) {
    console.error("Failed to fetch nodes:", err.message);
    return {};
  }
}

/*
|--------------------------------------------------------------------------
| Upload File
|--------------------------------------------------------------------------
*/

const uploadFile = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const io = req.app.get("io");

    io.emit("log", `File uploaded: ${req.file.originalname}`);

    const filePath = req.file.path;

    exec(
      `node coordinator.js upload "${filePath}"`,
      {
        cwd: path.join(__dirname, ".."),
      },
      (error, stdout, stderr) => {
        if (error) {
          io.emit("log", `[upload] failed: ${req.file.originalname} — ${stderr || error.message}`);
          return res.status(500).json({
            success: false,
            message: stderr || error.message,
          });
        }

        const chunkLine = stdout.match(/Total chunks:\s*(\d+)/);
        const chunkCount = chunkLine ? chunkLine[1] : "?";
        io.emit("log", `[replication] ${req.file.originalname} · ${chunkCount} chunks distributed`);

        res.json({
          success: true,
          message: "File uploaded successfully",
          output: stdout,
        });
      },
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Files (from metadata)
|--------------------------------------------------------------------------
*/

const getFiles = (req, res) => {
  try {
    if (!fs.existsSync(METADATA_FILE)) {
      return res.json([]);
    }

    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf8"));

    const files = Object.keys(metadata).map((filename) => {
      const entry      = metadata[filename];
      const fileChunks = getChunks(entry);
      const totalSize  = fileChunks.reduce((sum, chunk) => sum + (chunk.size || 0), 0);

      return {
        filename,
        chunks:     fileChunks.length,
        size:       totalSize,
        uploadedAt: entry?.uploadedAt ?? null,
      };
    });

    res.json(files);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Download File (dynamic nodes)
|--------------------------------------------------------------------------
*/

const downloadFile = async (req, res) => {
  try {
    const filename   = req.params.filename;
    const cachedPath = path.join(SHARED_FOLDER, filename);

    // Cache hit: serve directly and refresh its mtime for LRU tracking
    if (fs.existsSync(cachedPath)) {
      const now = new Date();
      fs.utimesSync(cachedPath, now, now);
      req.app.get("io").emit("log", `[cache hit] ${filename} · served to ${clientIP(req)}`);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      return fs.createReadStream(cachedPath).pipe(res);
    }

    req.app.get("io").emit("log", `[cache miss] ${filename} · assembling from nodes`);

    // Cache miss: assemble from nodes
    if (!fs.existsSync(METADATA_FILE)) {
      return res.status(404).json({
        success: false,
        message: "Metadata not found",
      });
    }

    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf8"));

    if (!metadata[filename]) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const chunks   = getChunks(metadata[filename]);
    const NODE_MAP = await getNodeMap();

    const buffers = [];

    for (const chunk of chunks) {
      let chunkBuffer = null;

      for (const user of chunk.users) {
        try {
          const response = await fetch(
            `${NODE_MAP[user]}/get-chunk?filename=${filename}&chunkId=${chunk.chunkId}`,
          );

          if (!response.ok) throw new Error();

          const data = await response.json();

          chunkBuffer = Buffer.from(data.data, "base64");

          break;
        } catch {
          console.log(`Retrying chunk ${chunk.chunkId}`);
        }
      }

      if (!chunkBuffer) {
        return res.status(500).json({
          success: false,
          message: `Missing chunk ${chunk.chunkId}`,
        });
      }

      buffers.push(chunkBuffer);
    }

    const finalBuffer = Buffer.concat(buffers);

    // Write to shared cache (evict oldest entries if over limit)
    evictCache(finalBuffer.length);
    fs.writeFileSync(cachedPath, finalBuffer);
    req.app.get("io").emit("log", `[cached] ${filename} · ready for future requests`);

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    return res.send(finalBuffer);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Download failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Delete File (FULL cleanup)
|--------------------------------------------------------------------------
*/

const deleteFile = async (req, res) => {
  try {
    const filename = req.params.filename;

    if (!fs.existsSync(METADATA_FILE)) {
      return res.status(404).json({ message: "Metadata not found" });
    }

    let metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf8"));

    if (!metadata[filename]) {
      return res.status(404).json({ message: "File not found" });
    }

    const fileChunks = getChunks(metadata[filename]);

    const io = req.app.get("io");
    io.emit("log", `[delete] ${filename} · requested by ${clientIP(req)}`);

    const NODE_MAP = await getNodeMap();

    // delete chunks from all nodes
    for (const chunk of fileChunks) {
      for (const user of chunk.users) {
        try {
          await fetch(`${NODE_MAP[user]}/delete-chunk`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filename,
              chunkId: chunk.chunkId,
            }),
          });
        } catch (err) {
          console.log(`Failed to delete chunk ${chunk.chunkId} from ${user}`);
        }
      }
    }

    // remove from metadata
    delete metadata[filename];

    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

    // purge from shared cache
    const cachedPath = path.join(SHARED_FOLDER, filename);
    if (fs.existsSync(cachedPath)) fs.unlinkSync(cachedPath);

    io.emit("log", `[delete] ${filename} · removed from all nodes and cache`);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
};

module.exports = {
  uploadFile,
  getFiles,
  downloadFile,
  deleteFile,
};
