// routes/upload.js (example path)
const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure disk storage for multer.
// Files will be written under "<project>/uploads" with a random filename.
const storage = multer.diskStorage({
   // Destination folder (ensure this folder exists and is writable).
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  // Filename strategy: timestamp + random suffix + original extension.
  // Using only the extension from the original name avoids path traversal issues.
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});
// Init multer instance with disk storage.
const upload = multer({ storage });

// POST /
// Protected upload endpoint. Expects a single file in form field "image".
// Responds with a public-ish URL and basic metadata.
router.post('/', auth, upload.single('image'), (req, res) => {
  // If multer didn't attach a file, reject the request.
  if (!req.file) return res.status(400).json({ message: 'No file' });
  // Build a URL the frontend can load from. Make sure your app serves /uploads statically.
  const url = `/uploads/${req.file.filename}`;
  // Return minimal metadata; do not echo absolute filesystem paths.
  res.status(201).json({
    url,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype
  });
});

module.exports = router;
