// routes/sitemap.js
const express = require('express');
const router = express.Router();
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');
const Post = require('../models/Post');

const BASE_URL = process.env.BASE_URL || 'https://teal-music.com';
const CACHE_TTL_MS = parseInt(process.env.SITEMAP_CACHE_TTL_MS || '600000', 10); // 既定:10分
const HARD_LIMIT = parseInt(process.env.SITEMAP_LIMIT || '0', 10); // 0=無制限, デバッグ用に制限可

// メモリキャッシュ
let CACHE_XML = null;
let CACHE_AT = 0;

// 固定ページ（必要に応じて増減）
const staticPaths = [
  '/', '/courses', '/about', '/contact',
  '/courses/guitar', '/courses/vocal', '/courses/musical',
  '/courses/ukulele', '/courses/bass', '/courses/dtm',
  '/blog', '/privacy-policy', '/event'
];

// /sitemap.xml を返す
router.get('/sitemap.xml', async (req, res) => {
  try {
    // 手動キャッシュ破棄（管理者用: /sitemap.xml?purge=1）
    if (req.query.purge === '1') {
      CACHE_XML = null;
      CACHE_AT = 0;
      console.log('🔄 Sitemap cache purged manually');
    }

    // 新鮮なキャッシュがあれば即返す
    const now = Date.now();
    if (CACHE_XML && (now - CACHE_AT) < CACHE_TTL_MS) {
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
      return res.status(200).send(CACHE_XML);
    }

    // 公開記事のみ取得（必要なフィールドだけ）＋ lean で軽量化
    let query = Post.find({ status: 'published' })
      .select('slug category updatedAt createdAt')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    if (HARD_LIMIT > 0) query = query.limit(HARD_LIMIT);

    const posts = await query;

    // リンク配列作成
    const links = [];

    // 固定ページ
    const today = new Date().toISOString().slice(0, 10);
    for (const p of staticPaths) {
      links.push({ url: p, lastmod: today });
    }

    // 記事URL
    for (const p of posts) {
      const lastDate = p.updatedAt || p.createdAt || new Date();
      const lastmod = new Date(lastDate).toISOString().slice(0, 10);
      const path = p.category === 'news' ? `/news/${p.slug}` : `/blog/${p.slug}`;
      links.push({ url: path, lastmod });
    }

    // ホスト名末尾スラッシュを削除
    const host = (BASE_URL || '').replace(/\/+$/, '');

    // ストリーミングでXML生成
    const smStream = new SitemapStream({ hostname: host });
    const xmlBuffer = await streamToPromise(Readable.from(links).pipe(smStream));
    const xml = xmlBuffer.toString('utf8');

    // キャッシュ
    CACHE_XML = xml;
    CACHE_AT = now;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
    return res.status(200).send(xml);
  } catch (e) {
    console.error('❌ Sitemap generation error:', e);
    return res.status(500).send('');
  }
});

module.exports = router;