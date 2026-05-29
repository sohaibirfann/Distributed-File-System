require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const {
  getFileWithChunks,
  getAllFilesWithChunks,
  deleteFileRecord,
  getNodeMap,
} = require("../db");

const ENCRYPTION_KEY  = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const SHARED_FOLDER   = path.join(__dirname, "../shared");
const CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

function decrypt(b64) {
  const buf     = Buffer.from(b64, "base64");
  const iv      = buf.slice(0, 12);
  const authTag = buf.slice(12, 28);
  const enc     = buf.slice(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

function clientIP(req) {
  return (req.ip || "").replace(/^::ffff:/, "") || "unknown";
}

function evictCache(incomingBytes) {
  if (!fs.existsSync(SHARED_FOLDER)) return;
  const entries = fs.readdirSync(SHARED_FOLDER)
    .map((name) => {
      const p    = path.join(SHARED_FOLDER, name);
      const stat = fs.statSync(p);
      return { p, size: stat.size, mtime: stat.mtimeMs };
    })
    .sort((a, b) => a.mtime - b.mtime);

  let total = entries.reduce((sum, e) => sum + e.size, 0) + incomingBytes;
  for (const entry of entries) {
    if (total <= CACHE_MAX_BYTES) break;
    fs.unlinkSync(entry.p);
    total -= entry.size;
  }
}

/*
|--------------------------------------------------------------------------
| Upload File — delegates to in-process coordinator
|--------------------------------------------------------------------------
*/

const uploadFile = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const io           = req.app.get("io");
    const filePath     = req.file.path;
    const originalName = req.file.originalname;

    // Import here to avoid circular dep issues at module load time
    const { distributeFile } = require("../coordinator");

    distributeFile(filePath, originalName, io)
      .then(() => {
        res.json({ success: true, message: "File uploaded successfully" });
      })
      .catch((err) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        io.emit("upload-progress", { filename: originalName, error: err.message });
        res.status(500).json({ success: false, message: err.message });
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Get Files
|--------------------------------------------------------------------------
*/

const getFiles = (req, res) => {
  try {
    const cachedSet = new Set(
      fs.existsSync(SHARED_FOLDER) ? fs.readdirSync(SHARED_FOLDER) : [],
    );

    const files = getAllFilesWithChunks().map(({ filename, uploaded_at, total_size, chunks }) => ({
      filename,
      chunks:     chunks.length,
      size:       total_size,
      uploadedAt: uploaded_at,
      cached:     cachedSet.has(filename),
    }));

    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Download File — parallel chunk assembly
|--------------------------------------------------------------------------
*/

const downloadFile = async (req, res) => {
  try {
    const filename   = req.params.filename;
    const cachedPath = path.join(SHARED_FOLDER, filename);

    if (fs.existsSync(cachedPath)) {
      const now = new Date();
      fs.utimesSync(cachedPath, now, now);
      req.app.get("io").emit("log", `[cache hit] ${filename} · served to ${clientIP(req)}`);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      return fs.createReadStream(cachedPath).pipe(res);
    }

    req.app.get("io").emit("log", `[cache miss] ${filename} · assembling from nodes`);

    const record = getFileWithChunks(filename);
    if (!record) return res.status(404).json({ success: false, message: "File not found" });

    const NODE_MAP = getNodeMap();
    const io       = req.app.get("io");

    // Fetch all chunks in parallel
    const chunkBuffers = await Promise.all(
      record.chunks.map(async (chunk) => {
        let integrityFailed = false;

        for (const user of chunk.users) {
          const nodeUrl = NODE_MAP[user];
          if (!nodeUrl) continue;

          try {
            const response = await fetch(
              `${nodeUrl}/get-chunk?filename=${filename}&chunkId=${chunk.chunkId}`,
              { signal: AbortSignal.timeout(3000) },
            );
            if (!response.ok) throw new Error();

            const { data } = await response.json();

            let decrypted;
            try {
              decrypted = decrypt(data);
            } catch {
              io.emit("log", `[integrity] chunk ${chunk.chunkId} from ${user} failed decryption — trying next replica`);
              integrityFailed = true;
              continue;
            }

            const actualHash = crypto.createHash("sha256").update(decrypted).digest("hex");
            if (actualHash !== chunk.hash) {
              io.emit("log", `[integrity] chunk ${chunk.chunkId} from ${user} failed hash check — trying next replica`);
              integrityFailed = true;
              continue;
            }

            return decrypted;
          } catch {}
        }

        const message = integrityFailed
          ? `Chunk ${chunk.chunkId} failed integrity check on all replicas`
          : `Chunk ${chunk.chunkId} is unavailable on all nodes`;
        io.emit("log", `[error] ${filename} · ${message}`);
        throw new Error(message);
      }),
    );

    const finalBuffer = Buffer.concat(chunkBuffers);

    if (finalBuffer.length <= CACHE_MAX_BYTES) {
      evictCache(finalBuffer.length);
      if (!fs.existsSync(SHARED_FOLDER)) fs.mkdirSync(SHARED_FOLDER, { recursive: true });
      fs.writeFileSync(cachedPath, finalBuffer);
      io.emit("log", `[cached] ${filename} · ready for future requests`);
    } else {
      io.emit("log", `[skip cache] ${filename} · file too large to cache`);
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    return res.send(finalBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || "Download failed" });
  }
};

/*
|--------------------------------------------------------------------------
| Delete File
|--------------------------------------------------------------------------
*/

const deleteFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const record   = getFileWithChunks(filename);
    if (!record) return res.status(404).json({ message: "File not found" });

    const NODE_MAP = getNodeMap();
    const io       = req.app.get("io");
    io.emit("log", `[delete] ${filename} · requested by ${clientIP(req)}`);

    await Promise.all(
      record.chunks.flatMap((chunk) =>
        chunk.users.map(async (user) => {
          const nodeUrl = NODE_MAP[user];
          if (!nodeUrl) return;
          try {
            await fetch(`${nodeUrl}/delete-chunk`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ filename, chunkId: chunk.chunkId }),
              signal:  AbortSignal.timeout(3000),
            });
          } catch {
            console.log(`Failed to delete chunk ${chunk.chunkId} from ${user}`);
          }
        }),
      ),
    );

    deleteFileRecord(filename);

    const cachedPath = path.join(SHARED_FOLDER, filename);
    if (fs.existsSync(cachedPath)) fs.unlinkSync(cachedPath);

    io.emit("log", `[delete] ${filename} · removed from all nodes and cache`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
};

/*
|--------------------------------------------------------------------------
| Clear Cache
|--------------------------------------------------------------------------
*/

const clearCache = (req, res) => {
  try {
    if (!fs.existsSync(SHARED_FOLDER)) return res.json({ success: true, cleared: 0 });

    const files   = fs.readdirSync(SHARED_FOLDER);
    let   cleared = 0;
    for (const f of files) {
      try { fs.unlinkSync(path.join(SHARED_FOLDER, f)); cleared++; } catch {}
    }

    req.app.get("io").emit("log", `[cache] cleared ${cleared} cached file${cleared !== 1 ? "s" : ""} by admin`);
    res.json({ success: true, cleared });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { uploadFile, getFiles, downloadFile, deleteFile, clearCache };
