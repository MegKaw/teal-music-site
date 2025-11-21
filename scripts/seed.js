// scripts/seed.js
// 既存の /blog/*.js から MongoDB へ upsert（slug 基準）
// 何度実行してもOK（idempotent）

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// ====== Post モデル ======
const Post = require('../models/Post'); // 既存の新仕様（SEOフィールド付き）を利用

if (!process.env.MONGODB_URI) {
  console.error('ERROR: .env に MONGODB_URI がありません');
  process.exit(1);
}

const BLOG_DIR = path.join(__dirname, '..', 'blog');

function normalizeArray(moduleExport) {
  // /blog/*.js の export 形態が module.exports = [...] または export default [...] の両対応
  if (Array.isArray(moduleExport)) return moduleExport;
  if (moduleExport && Array.isArray(moduleExport.default)) return moduleExport.default;
  // 想定外フォーマット
  return [];
}

function toSeo({ title, excerpt, content }) {
  const safe = (s) => (s || '').toString().replace(/\s+/g, ' ').trim();
  const desc = safe(excerpt) || safe(content)?.slice(0, 140);
  const keywords = [];
  if (title) keywords.push(...title.split(/\s|、|,/).filter(Boolean));
  return {
    metaTitle: safe(title),
    metaDescription: safe(desc),
    metaKeywords: keywords.slice(0, 12).join(', ')
  };
}

async function main() {
  console.log('Connecting MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI, {});

  if (!fs.existsSync(BLOG_DIR)) {
    console.error(`ERROR: blog ディレクトリが見つかりません: ${BLOG_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.js'));

  if (files.length === 0) {
    console.error('ERROR: /blog/*.js が見つかりません。');
    process.exit(1);
  }

  let total = 0, upserts = 0, skips = 0, errors = 0;

  for (const file of files) {
    const abs = path.join(BLOG_DIR, file);
    console.log(`> Loading ${file}`);
    // require のキャッシュ回避（何度も実行するため）
    delete require.cache[require.resolve(abs)];
    const mod = require(abs);
    const arr = normalizeArray(mod);

    if (!arr.length) {
      console.warn(`  WARN: ${file} に配列が見つからない。スキップ`);
      continue;
    }

    for (const raw of arr) {
      total++;

      // 期待フィールドが揃っていない既存データに対応（最低限 title / slug / category / content を確保）
      const title = raw.title || raw.name || '';
      const slug = raw.slug || (title ? title.toLowerCase().replace(/[^\w\-]+/g, '-').replace(/\-+/g, '-').replace(/^\-|\-$/g, '') : '');
      const category = raw.category || path.basename(file, '.js'); // ファイル名をカテゴリのデフォルトに
      const content = raw.content || raw.body || '';
      const excerpt = raw.excerpt || raw.description || '';

      if (!title || !slug || !category) {
        console.warn(`  WARN: 不足フィールド（title/slug/category）。スキップ: ${title}`);
        skips++;
        continue;
      }

      // SEO デフォルト生成（既存に meta が無い場合）
      const metaTitle = raw.metaTitle;
      const metaDescription = raw.metaDescription;
      const metaKeywords = raw.metaKeywords;

      const seo = {
        ...(toSeo({ title, excerpt, content })),
        ...(metaTitle ? { metaTitle } : {}),
        ...(metaDescription ? { metaDescription } : {}),
        ...(metaKeywords ? { metaKeywords } : {}),
      };

      const payload = {
        title,
        slug,
        category,
        content,
        excerpt,
        // 任意の既存フィールドマップ（必要に応じて拡張）
        coverImage: raw.coverImage || null,
        author: raw.author || 'TEAL',
        tags: raw.tags || [],
        publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : (raw.date ? new Date(raw.date) : new Date()),
        // SEO
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription,
        metaKeywords: seo.metaKeywords,
        // 既存の「下書き」フラグ等に対応
        status: raw.status || 'published',
      };

      try {
        const res = await Post.updateOne(
          { slug },
          { $set: payload },
          { upsert: true }
        );
        // upsert か update かの判定は Mongo の応答に依存
        // ここでは単純に success とカウント
        upserts++;
      } catch (e) {
        errors++;
        console.error(`  ERROR: ${title} (${slug})`, e.message);
      }
    }
  }

  console.log('---- RESULT ----');
  console.log(`files:   ${files.length}`);
  console.log(`total:   ${total}`);
  console.log(`upserts: ${upserts}`);
  console.log(`skips:   ${skips}`);
  console.log(`errors:  ${errors}`);

  await mongoose.disconnect();
  console.log('DONE');
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});