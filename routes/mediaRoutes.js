const express = require("express");
const { uploadMedia } = require("../controllers/mediaController");
const multer = require("multer");

const router = express.Router();
const upload = multer();

router.post("/upload", upload.single("file"), uploadMedia);

module.exports = router;
