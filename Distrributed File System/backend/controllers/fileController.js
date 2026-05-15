const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const SHARED_FOLDER = path.join(__dirname, "../shared");

const MERGED_FOLDER = path.join(__dirname, "../merged");

const METADATA_FILE = path.join(__dirname, "../metadata.json");

/*
|--------------------------------------------------------------------------
| Upload File
|--------------------------------------------------------------------------
*/

const uploadFile = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const io = req.app.get("io");

    io.emit("log", `File uploaded: ${req.file.originalname}`);

    const filePath = req.file.path;

    exec(
      `node coordinator.js upload "${filePath}"`,
      {
        cwd: path.join(__dirname, ".."),
      },
      (error, stdout, stderr) => {
        if (error) {
          return res.status(500).json({
            success: false,
            message: stderr || error.message,
          });
        }

        io.emit("log", `Replication completed for ${req.file.originalname}`);

        res.json({
          success: true,
          message: "File uploaded successfully",
          output: stdout,
        });
      },
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Files
|--------------------------------------------------------------------------
*/

const getFiles = (req, res) => {
  try {
    if (!fs.existsSync(METADATA_FILE)) {
      return res.json([]);
    }

    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf8"));

    const files = Object.keys(metadata).map((filename) => {
      const filePath = path.join(SHARED_FOLDER, filename);

      let size = 0;

      if (fs.existsSync(filePath)) {
        size = fs.statSync(filePath).size;
      }

      return {
        filename,
        chunks: metadata[filename].length,
        size,
      };
    });

    res.json(files);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Merge File
|--------------------------------------------------------------------------
*/

const mergeFileController = (req, res) => {
  try {
    const io = req.app.get("io");

    const filename = req.params.filename;

    io.emit("log", `Merge started for ${filename}`);

    exec(
      `node merge.js "${filename}"`,
      {
        cwd: path.join(__dirname, ".."),
      },
      (error, stdout, stderr) => {
        if (error) {
          return res.status(500).json({
            success: false,
            message: stderr || error.message,
          });
        }

        io.emit("log", `Merge completed for ${filename}`);

        res.json({
          success: true,
          message: "File merged successfully",
          output: stdout,
        });
      },
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Download File
|--------------------------------------------------------------------------
*/

const downloadFile = async (req, res) => {
  try {
    const filename = req.params.filename;

    const metadataPath = path.join(__dirname, "../metadata.json");

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        success: false,
        message: "Metadata not found",
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    const key = Object.keys(metadata).find((k) => k.trim() === filename.trim());

    if (!key) {
      return res.status(404).json({
        success: false,
        message: "File not found in metadata",
      });
    }

    const chunks = metadata[key];

    const NODE_MAP = {
      user1: "http://localhost:7001",
      user2: "http://localhost:7002",
      user3: "http://localhost:7003",
    };

    const buffers = [];

    for (const chunk of chunks) {
      let chunkBuffer = null;

      for (const user of chunk.users) {
        try {
          const response = await fetch(
            `${NODE_MAP[user]}/get-chunk?filename=${filename}&chunkId=${chunk.chunkId}`,
          );

          if (!response.ok) throw new Error();

          const data = await response.json();

          chunkBuffer = Buffer.from(data.data, "base64");

          break;
        } catch {
          console.log(`Retrying chunk ${chunk.chunkId}`);
        }
      }

      if (!chunkBuffer) {
        return res.status(500).json({
          success: false,
          message: `Missing chunk ${chunk.chunkId}`,
        });
      }

      buffers.push(chunkBuffer);
    }

    const finalBuffer = Buffer.concat(buffers);

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.setHeader("Content-Type", "application/octet-stream");

    return res.send(finalBuffer);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Download failed",
    });
  }
};

const deleteFile = async (req, res) => {
  try {
    const filename = req.params.filename;

    const metadataPath = path.join(__dirname, "../metadata.json");

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ message: "Metadata not found" });
    }

    let metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    const fileChunks = metadata[filename];

    if (!fileChunks) {
      return res.status(404).json({ message: "File not found" });
    }

    const NODE_MAP = {
      user1: "http://localhost:7001",
      user2: "http://localhost:7002",
      user3: "http://localhost:7003",
    };

    // delete chunks from all nodes
    for (const chunk of fileChunks) {
      for (const user of chunk.users) {
        try {
          await fetch(`${NODE_MAP[user]}/delete-chunk`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filename,
              chunkId: chunk.chunkId,
            }),
          });
        } catch (err) {
          console.log(`Failed to delete chunk ${chunk.chunkId} from ${user}`);
        }
      }
    }

    // remove from metadata
    delete metadata[filename];

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
};

module.exports = {
  uploadFile,
  getFiles,
  mergeFileController,
  downloadFile,
  deleteFile,
};
