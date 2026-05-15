const express = require("express");

const router = express.Router();

const upload = require("../middleware/upload");

const {
  uploadFile,
  getFiles,
  mergeFileController,
  downloadFile,
  deleteFile,
} = require("../controllers/fileController");

/*
|--------------------------------------------------------------------------
| Upload File
|--------------------------------------------------------------------------
*/

router.post(
  "/upload",
  upload.single("file"),
  (req, res, next) => {
    const io = req.app.get("io");

    if (req.file) {
      io.emit(
        "log",
        `Uploading file: ${req.file.originalname}`
      );
    }

    next();
  },
  uploadFile
);


// get all files
router.get("/", getFiles);

// merge files
router.post(
  "/merge/:filename",
  (req, res, next) => {
    const io = req.app.get("io");

    io.emit(
      "log",
      `Merge started for ${req.params.filename}`
    );

    next();
  },
  mergeFileController
);

// download files
router.get(
  "/download/:filename",
  (req, res, next) => {
    const io = req.app.get("io");

    io.emit(
      "log",
      `Download requested: ${req.params.filename}`
    );

    next();
  },
  downloadFile
);

// delete files
router.delete("/delete/:filename", deleteFile);

module.exports = router;