const fs   = require("fs");
const path = require("path");

const { getAllFilesWithChunks, getNodeMap } = require("../db");

const SHARED_FOLDER   = path.join(__dirname, "../shared");
const CACHE_MAX_BYTES = 200 * 1024 * 1024;

const getHealth = (req, res) => {
  try {
    const files          = getAllFilesWithChunks();
    const totalFiles     = files.length;
    const totalChunks    = files.reduce((s, f) => s + f.chunks.length, 0);
    const distributedBytes = files.reduce((s, f) => s + f.total_size, 0);

    const lastUploaded = files.reduce((latest, f) => {
      if (!f.uploaded_at) return latest;
      if (!latest || new Date(f.uploaded_at) > new Date(latest.uploadedAt)) {
        return { filename: f.filename, uploadedAt: f.uploaded_at, size: f.total_size };
      }
      return latest;
    }, null);

    let cacheUsed    = 0;
    const cachedFiles = [];
    if (fs.existsSync(SHARED_FOLDER)) {
      for (const f of fs.readdirSync(SHARED_FOLDER)) {
        try {
          cacheUsed += fs.statSync(path.join(SHARED_FOLDER, f)).size;
          cachedFiles.push(f);
        } catch {}
      }
    }

    const onlineUsers = Object.keys(getNodeMap()).length;

    res.json({
      status: "healthy",
      files:  totalFiles,
      chunks: totalChunks,
      usersOnline: onlineUsers,
      distributedBytes,
      cacheUsed,
      cacheMax:     CACHE_MAX_BYTES,
      cachedFiles,
      lastUploaded,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getHealth };
