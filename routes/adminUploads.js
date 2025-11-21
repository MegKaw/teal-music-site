// routes/adminUploads.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

// ===== 設定値 =====
const MAX_FILE_MB   = 20;   // Nginx側も client_max_body_size 20M を推奨
const MAX_WIDTH     = 1600; // 本文画像の最大幅
const THUMB_WIDTH   = 480;  // サムネイルの幅
const WEBP_QUALITY  = 82;   // 本文画像のWebP品質
const THUMB_QUALITY = 78;   // サムネイルのWebP品質

// 保存先（存在しなければ作成）
// ※ app.js にて `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` がある前提
const UP_BASE   = path.join(__dirname, '..', 'uploads', 'images');
const UP_THUMBS = path.join(UP_BASE, 'thumbs');
[UP_BASE, UP_THUMBS].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer（メモリ保存）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 }, // ← 定数を反映
  fileFilter: (req, file, cb) => {
    // iPhone由来の HEIC/HEIF、GIF も許容（sharpでWebP変換）
    const ok = /image\/(png|jpe?g|webp|gif|heic|heif)/i.test(file.mimetype);
    cb(ok ? null : new Error('Invalid image type'), ok);
  },
});

// 画像アップロード（本文中/カバー共通）
router.post('/images', upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file' });
    }

    const id        = uuid();
    const baseName  = `${id}.webp`;
    const outPath   = path.join(UP_BASE, baseName);
    const thumbName = `${id}.thumb.webp`;
    const thumbPath = path.join(UP_THUMBS, thumbName);

    // 本文用（最大1600px, WebP）
    const mainPipeline = sharp(req.file.buffer)
      .rotate()
      .resize({ width: MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY });

    // サムネ用（幅480px, WebP）
    const thumbPipeline = sharp(req.file.buffer)
      .rotate()
      .resize({ width: THUMB_WIDTH, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY });

    await Promise.all([mainPipeline.toFile(outPath), thumbPipeline.toFile(thumbPath)]);

    const publicUrl   = `/uploads/images/${baseName}`;
    const publicThumb = `/uploads/images/thumbs/${thumbName}`;

    res.type('application/json');
    return res.status(200).json({ url: publicUrl, thumbUrl: publicThumb });
  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// 互換：旧API /admin/upload-image を同処理へ委譲
router.post('/upload-image', (req, res, next) => {
  req.url = '/images';
  next();
});

// 共通エラーハンドラ（multer/fileFilter/サイズ超過などをJSONで返す）
router.use((err, req, res, next) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  if (/Invalid image type/i.test(err.message || '')) {
    return res.status(400).json({ error: 'Invalid image type' });
  }
  console.error('Upload route error:', err);
  return res.status(500).json({ error: 'Upload failed' });
});

module.exports = router;