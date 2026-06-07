const express = require("express");

const router = express.Router({ mergeParams: true });

const upload = require("../middleware/upload");
const { requireAuth } = require("../middleware/auth");
const { isMember } = require("../db");

const {
  uploadFile,
  getFiles,
  downloadFile,
  getThumb,
  renameFile,
  deleteFile,
} = require("../controllers/fileController");

function clientIP(req) {
  return (req.ip || "").replace(/^::ffff:/, "") || "unknown";
}

function fmtBytes(b) {
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

router.use(requireAuth);
router.use((req, res, next) => {
  if (!isMember(req.params.groupId, req.user.id)) {
    return res.status(403).json({ error: "Not a member of this group" });
  }
  next();
});

router.post("/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: "File too large (max 500 MB)" });
    }
    if (err) return next(err);
    if (req.file) {
      req.app.get("io").emit(
        "log",
        `[upload] ${req.file.originalname} · ${fmtBytes(req.file.size)} · from ${clientIP(req)}`,
      );
    }
    next();
  });
}, uploadFile);

router.get("/", getFiles);

router.get("/thumb/:filename", getThumb);

router.get("/download/:filename", (req, res, next) => {
  req.app.get("io").emit("log", `[download] ${req.params.filename} · requested by ${clientIP(req)}`);
  next();
}, downloadFile);

router.patch("/rename/:filename", renameFile);

router.delete("/delete/:filename", deleteFile);

module.exports = router;
