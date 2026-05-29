const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

const UPLOAD_FOLDER = path.join(__dirname, "../uploads");

if (!fs.existsSync(UPLOAD_FOLDER)) fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_FOLDER),
  filename:    (req, file, cb) => cb(null, file.originalname),
});

module.exports = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });
