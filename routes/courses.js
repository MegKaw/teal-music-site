const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

router.get('/:category', async (req, res) => {
  const category = req.params.category;
  const posts = await Post.find({ category, published: true })
    .sort({ createdAt: -1 })
    .limit(5);

  res.render(`courses/${category}`, { posts });
});

module.exports = router;