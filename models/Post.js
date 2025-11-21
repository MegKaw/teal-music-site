// models/Post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug:  { type: String, unique: true }, // ← required削除（自動生成用）
  category: { type: String },
  content: { type: String }, // Quillの本文
  excerpt: { type: String },
  metaTitle: { type: String },
  metaDescription: { type: String },
  metaKeywords: { type: String },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  coverImage: { type: String },
  coverThumb: { type: String },
  publishedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.models.Post || mongoose.model('Post', postSchema);