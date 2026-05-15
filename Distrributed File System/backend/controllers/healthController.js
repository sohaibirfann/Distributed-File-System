const fs = require("fs");
const path = require("path");

const USERS_FOLDER = path.join(__dirname, "../users");
const METADATA_FILE = path.join(__dirname, "../metadata.json");

const getHealth = (req, res) => {
  try {
    let totalFiles = 0;
    let totalChunks = 0;
    let onlineUsers = 0;

    if (fs.existsSync(METADATA_FILE)) {
      const metadata = JSON.parse(
        fs.readFileSync(METADATA_FILE, "utf8")
      );

      totalFiles = Object.keys(metadata).length;

      for (const file in metadata) {
        totalChunks += metadata[file].length;
      }
    }

    if (fs.existsSync(USERS_FOLDER)) {
      onlineUsers = fs.readdirSync(USERS_FOLDER).length;
    }

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