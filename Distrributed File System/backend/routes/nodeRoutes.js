const express = require("express");
const router = express.Router();

const { getNodes } = require("../controllers/nodeController");

router.get("/nodes", getNodes);

module.exports = router;