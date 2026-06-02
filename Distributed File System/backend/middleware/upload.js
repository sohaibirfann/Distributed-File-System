const multer = require("multer");
const path   = require("path");
const fs     = require("fs");
const crypto = require("crypto");

const UPLOAD_FOLDER = path.join(__dirname, "../uploads");

if (!fs.existsSync(UPLOAD_FOLDER)) fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_FOLDER),
  // Unique temp name so concurrent uploads of the same filename don't clobber
  // each other on disk. The real name lives on in req.file.originalname.
  filename:    (req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname)}`),
});

module.exports = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });
