console.log("--- boot ---");

const express = require("express");
const path = require("path");
const session = require("express-session");
require("dotenv").config();
const Post = require("./models/Post");
const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();
const port = 3000;

// EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// static / body
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.urlencoded({ extended: true }));

// session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "devsecret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false },
  })
);

// ルーター
const adminAuthRouter = require("./routes/adminAuth");
const adminPostsRouter = require("./routes/adminPosts");
const adminUploadsRouter = require("./routes/adminUploads");
const adminSlotsRouter = require("./routes/adminSlots");
const adminReservationsRouter = require("./routes/adminReservations");
const blogRoutes = require("./routes/blog");
const sitemapRoute = require("./routes/sitemap");
const coursesRouter = require("./routes/courses");
const reserveRouter = require("./routes/reserve"); // ★ 予約ページ

// =======================
// 予約管理専用ログイン
// =======================

// GET: ログイン画面
app.get("/reserve/admin-login", (req, res) => {
  res.render("reserve/admin-login", { error: null });
});

// POST: ログイン処理
app.post("/reserve/admin-login", (req, res) => {
  const { adminId, password } = req.body;

  const validId = process.env.RESERVE_ADMIN_ID;
  const validPw = process.env.RESERVE_ADMIN_PASSWORD;

  if (adminId === validId && password === validPw) {
    // 予約管理専用フラグ
    req.session.isReserveAdmin = true;
    return res.redirect("/admin/reservations/calendar");
  }

  // 失敗時はエラーメッセージ付きで同じ画面に戻す
  res.render("reserve/admin-login", {
    error: "IDまたはパスワードが違います。",
  });
});

// 予約システムルート（一般ユーザー用）
app.use("/reserve", reserveRouter);

// admin
app.use("/admin", adminAuthRouter);
app.use("/admin/posts", adminPostsRouter);
app.use("/admin/uploads", adminUploadsRouter);
app.use("/admin/slots", adminSlotsRouter);
app.use("/admin/reservations", adminReservationsRouter); // ★ 既存生徒予約

// コースページ (/courses/guitar など)
app.use("/courses", coursesRouter);

// トップページ
app.get("/", async (req, res, next) => {
  try {
    const newsPosts = await Post.find({
      status: "published",
      category: "news",
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(3)
      .lean();

    res.render("index", { newsPosts });
  } catch (e) {
    next(e);
  }
});

// ブログ & サイトマップ
app.use("/blog", blogRoutes);
app.use("/", sitemapRoute);

// 固定ページ
app.get("/privacy-policy", (req, res) => res.render("privacy-policy"));
app.get("/event", (req, res) => res.render("event"));

// 起動
app.listen(port, "0.0.0.0", () => {
  console.log(`listening on http://0.0.0.0:${port}`);
});
