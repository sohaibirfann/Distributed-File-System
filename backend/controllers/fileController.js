require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const {
  getGroupFiles,
  getGroupFileByName,
  deleteFileRecord,
  getNodeMap,
} = require("../db");

const { distributeFile } = require("../coordinator");

const SHARED_FOLDER   = path.join(__dirname, "../shared");
const CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

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
| Upload File (group-scoped)
|--------------------------------------------------------------------------
*/

const uploadFile = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const io           = req.app.get("io");
    const groupId      = req.params.groupId;
    const filePath     = req.file.path;
    const originalName = req.file.originalname;

    distributeFile(filePath, originalName, groupId, req.user.id, io)
      .then(() => res.json({ success: true, message: "File uploaded successfully" }))
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
| List a group's files
|--------------------------------------------------------------------------
*/

const getFiles = (req, res) => {
  try {
    const cachedSet = new Set(fs.existsSync(SHARED_FOLDER) ? fs.readdirSync(SHARED_FOLDER) : []);

    const files = getGroupFiles(req.params.groupId).map((f) => ({
      filename:   f.filename,
      chunks:     f.chunk_count,
      size:       f.total_size,
      uploadedAt: f.uploaded_at,
      uploadedBy: f.uploaded_by_name,
      cached:     cachedSet.has(f.id),
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
    const { groupId, filename } = req.params;

    const record = getGroupFileByName(groupId, filename);
    if (!record) return res.status(404).json({ success: false, message: "File not found" });

    const cachedPath = path.join(SHARED_FOLDER, record.id);

    if (fs.existsSync(cachedPath)) {
      const now = new Date();
      fs.utimesSync(cachedPath, now, now);
      req.app.get("io").emit("log", `[cache hit] ${filename} · served to ${clientIP(req)}`);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      return fs.createReadStream(cachedPath).pipe(res);
    }

    const io = req.app.get("io");
    io.emit("log", `[cache miss] ${filename} · assembling from nodes`);

    const NODE_MAP = getNodeMap();

    const chunkBuffers = await Promise.all(
      record.chunks.map(async (chunk) => {
        let integrityFailed = false;

        for (const user of chunk.users) {
          const nodeUrl = NODE_MAP[user];
          if (!nodeUrl) continue;

          try {
            const response = await fetch(
              `${nodeUrl}/get-chunk?fileId=${record.id}&chunkId=${chunk.chunkId}`,
              { signal: AbortSignal.timeout(3000) },
            );
            if (!response.ok) throw new Error();

            const { data } = await response.json();
            const buf = Buffer.from(data, "base64");

            // Integrity check on the (encrypted) chunk — detects a corrupted or
            // tampered replica before we bother returning it.
            const actualHash = crypto.createHash("sha256").update(buf).digest("hex");
            if (actualHash !== chunk.hash) {
              io.emit("log", `[integrity] chunk ${chunk.chunkId} from ${user} failed hash check — trying next replica`);
              integrityFailed = true;
              continue;
            }

            return buf;
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

// Tell every node holding this file's chunks to delete them, and drop any local
// cache copy. Best-effort (offline nodes are skipped); does NOT touch the DB.
async function purgeFileChunks(record, NODE_MAP = getNodeMap()) {
  await Promise.all(
    record.chunks.flatMap((chunk) =>
      chunk.users.map(async (user) => {
        const nodeUrl = NODE_MAP[user];
        if (!nodeUrl) return;
        try {
          await fetch(`${nodeUrl}/delete-chunk`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ fileId: record.id, chunkId: chunk.chunkId }),
            signal:  AbortSignal.timeout(3000),
          });
        } catch {
          console.log(`Failed to delete chunk ${chunk.chunkId} from ${user}`);
        }
      }),
    ),
  );
  const cachedPath = path.join(SHARED_FOLDER, record.id);
  try { if (fs.existsSync(cachedPath)) fs.unlinkSync(cachedPath); } catch { /* ignore */ }
}

// GC every chunk for a group's files across member nodes — called *before* a
// group is deleted, while the chunk→node map still exists. Best-effort.
async function purgeGroupChunks(groupId) {
  const NODE_MAP = getNodeMap();
  for (const f of getGroupFiles(groupId)) {
    const record = getGroupFileByName(groupId, f.filename);
    if (record) await purgeFileChunks(record, NODE_MAP);
  }
}

const deleteFile = async (req, res) => {
  try {
    const { groupId, filename } = req.params;
    const record = getGroupFileByName(groupId, filename);
    if (!record) return res.status(404).json({ message: "File not found" });

    const io = req.app.get("io");
    io.emit("log", `[delete] ${filename} · requested by ${clientIP(req)}`);

    await purgeFileChunks(record);
    deleteFileRecord(record.id);

    io.emit("log", `[delete] ${filename} · removed from all nodes and cache`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
};

module.exports = { uploadFile, getFiles, downloadFile, deleteFile, purgeGroupChunks };
