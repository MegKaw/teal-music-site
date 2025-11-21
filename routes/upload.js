const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

const router = express.Router();

function checkAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/gif'];
    if (ok.includes(file.mimetype)) return cb(null, true);
    cb(new Error('images only'));
  }
});

// POST /admin/upload-image
router.post('/upload-image', checkAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file' });

    const src = path.join(UPLOAD_DIR, req.file.filename);
    const base = req.file.filename.replace(path.extname(req.file.filename), '');
    const outMain  = path.join(UPLOAD_DIR, `${base}-w1600.webp`);
    const outThumb = path.join(UPLOAD_DIR, `${base}-thumb.webp`);

    // 本体：幅1600まで / 画質80
    await sharp(src).rotate().resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 }).toFile(outMain);

    // サムネ：16:9 640x360 / 画質75（中央クロップ）
    await sharp(src).rotate().resize(640, 360, { fit: 'cover', position: 'attention' })
      .webp({ quality: 75 }).toFile(outThumb);

    // 元ファイルは残す or 消す（不要なら消す）
    fs.unlink(src, () => {});

    return res.json({
      url: `/uploads/${path.basename(outMain)}`,
      thumbUrl: `/uploads/${path.basename(outThumb)}`
    });
  } catch (e) {
    console.error('upload failed:', e);
    return res.status(500).json({ error: 'process failed' });
  }
});

module.exports = router;
