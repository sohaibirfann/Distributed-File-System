const multer = require("multer");
const path = require("path");
const fs = require("fs");

const SHARED_FOLDER = path.join(__dirname, "../shared");

if (!fs.existsSync(SHARED_FOLDER)) {
  fs.mkdirSync(SHARED_FOLDER);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SHARED_FOLDER);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

module.exports = multer({ storage });