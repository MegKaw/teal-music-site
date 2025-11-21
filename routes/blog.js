// routes/blog.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// 一覧: /blog  最新20件
router.get('/', async (req, res, next) => {
  try {
    const posts = await Post.find({ status: 'published' })
      .sort({ publishedAt: -1, _id: -1 })
      .limit(20)
      .lean();
    res.render('blog/index', { posts });
  } catch (e) { next(e); }
});

// 詳細: /blog/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, status: 'published' }).lean();
    if (!post) return res.status(404).send('Not Found');

    // 同カテゴリの関連3件
    const related = await Post.find({
      _id: { $ne: post._id },
      category: post.category,
      status: 'published'
    }).sort({ publishedAt: -1, _id: -1 }).limit(3).lean();

    res.render('blog/shows', { post, related });
  } catch (e) { next(e); }
});

module.exports = router;