// routes/reserve.js
const express = require("express");
const router = express.Router();

const Slot = require("../models/Slot");
const Reservation = require("../models/Reservation");
const teachers = require("../data/teachers");

const MAX_PER_TIME = 2;

// 週の開始/終了
function getWeekRange(baseDate) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay(); // 0=日, 1=月...
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { monday, sunday };
}

// 日付＋開始時間キー（文字列）
function makeGroupKey(date, startTime) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dateKey = d.toISOString().slice(0, 10); // "2025-11-23"
  return `${dateKey}::${startTime}`;
}

// ★ 週カレンダー（/reserve と /reserve/select 共通）
async function renderWeek(req, res, viewName) {
  try {
    const course = req.query.course || "";
    const baseDate = req.query.date ? new Date(req.query.date) : new Date();

    const { monday, sunday } = getWeekRange(baseDate);

    const query = {
      date: { $gte: monday, $lte: sunday },
      isActive: { $ne: false },
    };

    // コース指定がある場合、そのコースを担当できる講師だけに絞る
    if (course) {
      const teacherValues = teachers
        .filter((t) => Array.isArray(t.courses) && t.courses.includes(course))
        .map((t) => t.value);

      if (teacherValues.length > 0) {
        query.teacher = { $in: teacherValues };
      } else {
        // 該当講師がいなければ何も出さない
        query.teacher = "__no_teacher_match__";
      }
    }

    const slots = await Slot.find(query).sort({ date: 1, startTime: 1 }).lean();

    // 「日付＋開始時間」のグループを作る
    const groupMap = new Map(); // key -> { date, startTime, totalInGroup, isGroupFull }
    slots.forEach((slot) => {
      const key = makeGroupKey(slot.date, slot.startTime);
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          date: slot.date,
          startTime: slot.startTime,
          totalInGroup: 0,
          isGroupFull: false,
        });
      }
    });

    const groupEntries = Array.from(groupMap.entries());

    // グループごとに予約数をカウント（フォーム側と完全に同じロジック）
    await Promise.all(
      groupEntries.map(async ([key, g]) => {
        const sameSlots = await Slot.find({
          isActive: { $ne: false },
          date: g.date,
          startTime: g.startTime,
        })
          .select("_id")
          .lean();

        const sameIds = sameSlots.map((s) => s._id);

        const totalInGroup = await Reservation.countDocuments({
          slot: { $in: sameIds },
          status: { $ne: "cancelled" },
        });

        g.totalInGroup = totalInGroup;
        g.isGroupFull = totalInGroup >= MAX_PER_TIME;
      })
    );

    // 曜日ごとに整形
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: d,
        slots: [],
      });
    }

    const dayMs = 24 * 60 * 60 * 1000;

    slots.forEach((slot) => {
      const idx = Math.floor(
        (new Date(slot.date).setHours(0, 0, 0, 0) - monday.getTime()) / dayMs
      );
      if (idx < 0 || idx > 6) return;

      const key = makeGroupKey(slot.date, slot.startTime);
      const groupInfo = groupMap.get(key);

      const isGroupFull = groupInfo ? groupInfo.isGroupFull : false;
      const totalInGroup = groupInfo ? groupInfo.totalInGroup : 0;
      const canBook = !isGroupFull;

      days[idx].slots.push({
        ...slot,
        isGroupFull,
        totalInGroup,
        canBook,
      });
    });

    res.render(viewName, {
      course,
      days,
      monday,
      sunday,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("select_error");
  }
}

// トップ：/reserve → カレンダー（index.ejs）
router.get("/", (req, res) => {
  renderWeek(req, res, "reserve/index");
});

// 旧：/reserve/select も同じカレンダー（互換用）
router.get("/select", (req, res) => {
  renderWeek(req, res, "reserve/select");
});

// 予約フォーム表示
router.get("/form", async (req, res) => {
  try {
    const { slotId, course, type } = req.query;
    if (!slotId) return res.status(400).send("slotId required");

    const slot = await Slot.findById(slotId).lean();
    if (!slot || slot.isActive === false) {
      return res.status(404).send("slot_not_found");
    }

    // 同じ日付＋時間の枠を集める
    const sameSlots = await Slot.find({
      isActive: { $ne: false },
      date: slot.date,
      startTime: slot.startTime,
    })
      .select("_id")
      .lean();

    const sameIds = sameSlots.map((s) => s._id);

    const totalInGroup = await Reservation.countDocuments({
      slot: { $in: sameIds },
      status: { $ne: "cancelled" },
    });

    if (totalInGroup >= MAX_PER_TIME) {
      return res.render("reserve/full", { slot });
    }

    // ★ ここで表示用の文字列を作ってテンプレに渡す（EJS側にはロジックを書かない）
    const rawCourse = course || "";
    const courseLabelMap = {
      vocal: "ボーカル",
      guitar: "ギター",
      bass: "ベース",
      ukulele: "ウクレレ",
      dtm: "DTM",
      musical: "ミュージカル / 声楽",
    };
    const courseLabel = courseLabelMap[rawCourse] || rawCourse || "未選択";

    const dt = new Date(slot.date);
    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const dateLabel =
      dt.getFullYear() +
      "年" +
      (dt.getMonth() + 1) +
      "月" +
      dt.getDate() +
      "日（" +
      week[dt.getDay()] +
      "）";

    res.render("reserve/form", {
      slot,
      course: rawCourse,
      type: type || "trial",
      courseLabel,
      dateLabel,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("form_error");
  }
});

// 予約送信
router.post("/submit", async (req, res) => {
  try {
    const { type, course, slotId, name, email, phone, note } = req.body;

    if (!slotId) return res.status(400).send("slotId missing");
    if (!name || !email) return res.status(400).send("name/email required");

    const slot = await Slot.findById(slotId).lean();
    if (!slot || slot.isActive === false) {
      return res.status(404).send("slot_not_found");
    }

    const sameSlots = await Slot.find({
      isActive: { $ne: false },
      date: slot.date,
      startTime: slot.startTime,
    })
      .select("_id")
      .lean();

    const sameIds = sameSlots.map((s) => s._id);

    const totalInGroup = await Reservation.countDocuments({
      slot: { $in: sameIds },
      status: { $ne: "cancelled" },
    });

    if (totalInGroup >= MAX_PER_TIME) {
      return res.render("reserve/full", { slot });
    }

    await Reservation.create({
      type: type || "trial",
      course: course || "",
      slot: slotId,
      name,
      email,
      phone,
      note: note || "",
      status: "pending",
    });

    res.redirect(`/reserve/success?name=${encodeURIComponent(name)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("reservation_error");
  }
});

// 完了画面
router.get("/success", (req, res) => {
  const name = req.query.name || "";
  res.render("reserve/success", { name });
});

// 満枠
router.get("/full", (req, res) => {
  res.render("reserve/full");
});

module.exports = router;
