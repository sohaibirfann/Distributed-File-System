const fs = require("fs");
const path = require("path");

const METADATA_FILE  = path.join(__dirname, "../metadata.json");
const SHARED_FOLDER  = path.join(__dirname, "../shared");
const CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

const getHealth = (req, res) => {
  try {
    let totalFiles       = 0;
    let totalChunks      = 0;
    let distributedBytes = 0;
    let lastUploaded     = null;

    if (fs.existsSync(METADATA_FILE)) {
      const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf8"));

      totalFiles = Object.keys(metadata).length;

      for (const [filename, entry] of Object.entries(metadata)) {
        const chunks = Array.isArray(entry) ? entry : (entry?.chunks ?? []);
        totalChunks      += chunks.length;
        const fileSize    = chunks.reduce((s, c) => s + (c.size || 0), 0);
        distributedBytes += fileSize;

        if (entry?.uploadedAt) {
          if (!lastUploaded || new Date(entry.uploadedAt) > new Date(lastUploaded.uploadedAt)) {
            lastUploaded = { filename, uploadedAt: entry.uploadedAt, size: fileSize };
          }
        }
      }
    }

    // Cache stats
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

    const nodes      = req.app.get("nodes") || {};
    const onlineUsers = Object.keys(nodes).length;

    res.json({
      status:           "healthy",
      files:            totalFiles,
      chunks:           totalChunks,
      usersOnline:      onlineUsers,
      distributedBytes,
      cacheUsed,
      cacheMax:         CACHE_MAX_BYTES,
      cachedFiles,
      lastUploaded,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getHealth };
