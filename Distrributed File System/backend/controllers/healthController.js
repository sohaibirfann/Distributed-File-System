const fs = require("fs");
const path = require("path");

const METADATA_FILE = path.join(__dirname, "../metadata.json");

const getHealth = (req, res) => {
  try {
    let totalFiles = 0;
    let totalChunks = 0;

    if (fs.existsSync(METADATA_FILE)) {
      const metadata = JSON.parse(
        fs.readFileSync(METADATA_FILE, "utf8")
      );

      totalFiles = Object.keys(metadata).length;

      for (const file in metadata) {
        const entry  = metadata[file];
        const chunks = Array.isArray(entry) ? entry : (entry?.chunks ?? []);
        totalChunks += chunks.length;
      }
    }

    const nodes = req.app.get("nodes") || {};
    const onlineUsers = Object.keys(nodes).length;

    res.json({
      status: "healthy",
      files: totalFiles,
      chunks: totalChunks,
      usersOnline: onlineUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { getHealth };