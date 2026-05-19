require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

// AES-256-GCM: input is base64(iv[12] + authTag[16] + ciphertext)
function decrypt(b64) {
  const buf     = Buffer.from(b64, "base64");
  const iv      = buf.slice(0, 12);
  const authTag = buf.slice(12, 28);
  const enc     = buf.slice(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

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
          // Remove the file from shared/ so it doesn't linger as a bad cache entry
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

          const rawErr = (stderr || error.message || "").trim();
          const firstLine = rawErr.split("\n").find((l) => l.trim()) || "Upload failed — could not distribute chunks";
          io.emit("log", `[upload] failed: ${req.file.originalname} — ${firstLine}`);
          return res.status(500).json({
            success: false,
            message: firstLine,
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
    const NODE_MAP = req.app.get("nodes") || {};

    const buffers = [];

    for (const chunk of chunks) {
      let chunkBuffer = null;
      let integrityFailed = false;

      for (const user of chunk.users) {
        try {
          const response = await fetch(
            `${NODE_MAP[user]}/get-chunk?filename=${filename}&chunkId=${chunk.chunkId}`,
            { signal: AbortSignal.timeout(3000) },
          );

          if (!response.ok) throw new Error();

          const data = await response.json();

          const decrypted = decrypt(data.data);

          const actualHash = crypto.createHash("sha256").update(decrypted).digest("hex");
          if (actualHash !== chunk.hash) {
            req.app.get("io").emit("log", `[integrity] chunk ${chunk.chunkId} from ${user} failed hash check — trying next replica`);
            integrityFailed = true;
            continue;
          }

          chunkBuffer = decrypted;
          break;
        } catch {
          console.log(`Retrying chunk ${chunk.chunkId}`);
        }
      }

      if (!chunkBuffer) {
        const message = integrityFailed
          ? `Chunk ${chunk.chunkId} failed integrity check on all replicas — file may be corrupted`
          : `Chunk ${chunk.chunkId} is unavailable on all nodes`;
        req.app.get("io").emit("log", `[error] ${filename} · ${message}`);
        return res.status(500).json({ success: false, message });
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

    const NODE_MAP = req.app.get("nodes") || {};

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
