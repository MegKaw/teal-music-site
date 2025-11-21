// routes/adminPosts.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const multer = require('multer');
const upload = multer(); // multipart/form-data 対応（画像がない場合もこれでOK）

// --- slug生成 ---
function slugify(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')     // 空白 → -
    .replace(/[^\w\-]+/g, '') // 英数字とハイフン以外削除
    .replace(/\-\-+/g, '-')   // ハイフン連続 → 1個
    .replace(/^-+|-+$/g, ''); // 先頭末尾のハイフン削除
}

// --- slugユニーク化 ---
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug || `post-${Date.now()}`;
  let n = 1;
  while (true) {
    const q = { slug };
    if (excludeId) q._id = { $ne: excludeId };
    const hit = await Post.findOne(q).select('_id').lean();
    if (!hit) return slug;
    slug = `${baseSlug}-${n++}`;
  }
}

// --- YouTubeリンクをiframeに自動変換 ---
function autoEmbedYouTube(html) {
  if (!html) return html;
  return html.replace(
    /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/g,
    '<iframe width="560" height="315" src="https://www.youtube.com/embed/$1" frameborder="0" allowfullscreen></iframe>'
  );
}

// --- 管理者チェック ---
function checkAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

// --- 投稿一覧 ---
router.get('/', checkAdmin, async (req, res, next) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).lean();
    res.render('admin/index', { posts });
  } catch (e) {
    next(e);
  }
});

// --- 新規作成フォーム ---
router.get('/new', checkAdmin, (req, res) => {
  res.render('admin/new', { post: {} });
});

// --- 新規投稿処理 ---
router.post('/', checkAdmin, upload.none(), async (req, res) => {
  console.log('BODY_KEYS =', Object.keys(req.body));
  console.log('BODY =', req.body);

  try {
    let {
      title,
      category,
      content, // hidden name="content"
      body,    // 後方互換
      excerpt,
      metaDescription,
      metaKeywords,
      status,
      coverImage,
      coverThumb,
    } = req.body;

    // 本文は content 優先
    let html = content || body || '';
    html = autoEmbedYouTube(html);

    if (!title || !title.trim()) {
      return res.status(400).send('タイトルは必須です');
    }

    const baseSlug = slugify(title);
    const slug = await ensureUniqueSlug(baseSlug);

    const metaTitle = title;
    if (!metaDescription) metaDescription = excerpt || '';

    const post = new Post({
      title: title.trim(),
      slug,
      category,
      content: html,
      excerpt,
      metaTitle,
      metaDescription,
      metaKeywords,
      status: ['draft', 'published'].includes(status) ? status : 'draft',
      coverImage,
      coverThumb,
      publishedAt: status === 'published' ? new Date() : undefined,
    });

    await post.save();
    res.redirect('/admin/posts');
  } catch (err) {
    console.error('❌ Error creating post:', err);
    res.status(500).send('投稿に失敗しました: ' + err.message);
  }
});

// --- 編集フォーム ---
router.get('/:id/edit', checkAdmin, async (req, res) => {
  const post = await Post.findById(req.params.id).lean();
  if (!post) return res.status(404).send('投稿が見つかりません');
  res.render('admin/edit', { post });
});

// --- 更新処理 ---
router.post('/:id/update', checkAdmin, upload.none(), async (req, res) => {
  console.log('BODY_KEYS =', Object.keys(req.body));
  console.log('BODY =', req.body);

  try {
    const id = req.params.id;

    let {
      title,
      category,
      content,
      body,
      excerpt,
      metaDescription,
      metaKeywords,
      status,
      coverImage,
      coverThumb,
    } = req.body;

    let html = content || body || '';
    html = autoEmbedYouTube(html);

    const current = await Post.findById(id);
    if (!current) return res.status(404).send('投稿が見つかりません');

    if (!title || !title.trim()) {
      return res.status(400).send('タイトルは必須です');
    }

    const baseSlug = slugify(title);
    const slug = await ensureUniqueSlug(baseSlug, current._id);

    const metaTitle = title;
    if (!metaDescription) metaDescription = excerpt || '';

    const update = {
      title: title.trim(),
      slug,
      category,
      content: html,
      excerpt,
      metaTitle,
      metaDescription,
      metaKeywords,
      status: ['draft', 'published'].includes(status) ? status : current.status,
      coverImage,
      coverThumb,
      publishedAt:
        status === 'published'
          ? current.publishedAt || new Date()
          : current.publishedAt,
    };

    await Post.findByIdAndUpdate(id, update);
    res.redirect('/admin/posts');
  } catch (err) {
    console.error('❌ Error updating post:', err);
    res.status(500).send('更新に失敗しました: ' + err.message);
  }
});

// --- 削除処理 ---
router.post('/:id/delete', checkAdmin, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.redirect('/admin/posts');
  } catch (err) {
    console.error('❌ Error deleting post:', err);
    res.status(500).send('削除に失敗しました');
  }
});

module.exports = router;