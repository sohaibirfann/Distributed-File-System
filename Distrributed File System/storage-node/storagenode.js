const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7001;

/*
|--------------------------------------------------------------------------
| Chunks Directory
|--------------------------------------------------------------------------
*/

const CHUNKS_DIR = path.join(
  __dirname,
  "chunks"
);

if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR);
}

/*
|--------------------------------------------------------------------------
| Multer Storage Config
|--------------------------------------------------------------------------
*/

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, CHUNKS_DIR);
  },

  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

/*
|--------------------------------------------------------------------------
| Store Chunk
|--------------------------------------------------------------------------
*/

app.post(
  "/storeChunk",
  upload.single("chunk"),
  (req, res) => {
    try {
      console.log(
        "Chunk stored:",
        req.file.originalname
      );

      res.json({
        success: true,
        message:
          "Chunk stored successfully",
        chunk: req.file.originalname,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Retrieve Chunk
|--------------------------------------------------------------------------
*/

app.get(
  "/chunk/:chunkName",
  (req, res) => {
    try {
      const chunkPath = path.join(
        CHUNKS_DIR,
        req.params.chunkName
      );

      if (
        !fs.existsSync(chunkPath)
      ) {
        return res.status(404).json({
          success: false,
          message: "Chunk not found",
        });
      }

      console.log(
        "Chunk requested:",
        req.params.chunkName
      );

      res.download(chunkPath);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Node Health
|--------------------------------------------------------------------------
*/

app.get("/health", (_, res) => {
  try {
    const chunks =
      fs.readdirSync(CHUNKS_DIR);

    res.json({
      success: true,
      status: "online",
      port: PORT,
      totalChunks: chunks.length,
      chunks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(
    `Storage Node running on port ${PORT}`
  );
});