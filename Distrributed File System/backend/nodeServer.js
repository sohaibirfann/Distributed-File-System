const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// arguments
const USER = process.argv[2] || "user1";
const PORT = process.argv[3] || 7001;

const STORAGE = path.join(__dirname, "node_storage", USER);

// create storage folder
if (!fs.existsSync(STORAGE)) {
  fs.mkdirSync(STORAGE, { recursive: true });
}

// STORE CHUNK
app.post("/store-chunk", (req, res) => {
  try {
    const { filename, chunkId, data } = req.body;

    const filePath = path.join(STORAGE, `${filename}_chunk_${chunkId}`);

    fs.writeFileSync(filePath, Buffer.from(data, "base64"));

    console.log(`Stored chunk ${chunkId} for ${filename} in ${USER}`);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET CHUNK
app.get("/get-chunk", (req, res) => {
  try {
    const { filename, chunkId } = req.query;

    const filePath = path.join(STORAGE, `${filename}_chunk_${chunkId}`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Chunk not found" });
    }

    const data = fs.readFileSync(filePath);

    res.json({
      data: data.toString("base64"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/stats", (req, res) => {
  let files = [];

  if (fs.existsSync(STORAGE)) {
    files = fs.readdirSync(STORAGE);
  }

  res.json({
    user: USER,
    chunks: files.length,
  });
});

app.post("/delete-chunk", (req, res) => {
  try {
    const { filename, chunkId } = req.body;

    const filePath = path.join(STORAGE, `${filename}_chunk_${chunkId}`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted chunk ${chunkId} of ${filename} from ${USER}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`${USER} node running on port ${PORT}`);
});
