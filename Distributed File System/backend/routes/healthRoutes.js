const express = require("express");
const router  = express.Router();

const { requireAuth } = require("../middleware/auth");
const { getHealth }   = require("../controllers/healthController");

router.get("/health", requireAuth, getHealth);

module.exports = router;
