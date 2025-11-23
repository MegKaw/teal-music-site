// routes/adminReservations.js
const express = require("express");
const router = express.Router();

const Reservation = require("../models/Reservation");
const Slot = require("../models/Slot");
const teachers = require("../data/teachers");

const MAX_PER_TIME = 2;

// 予約管理ログイン必須
function ensureReserveAdmin(req, res, next) {
  if (req.session && req.session.isReserveAdmin) {
    return next();
  }
  return res.redirect("/reserve/admin-login");
}

router.use(ensureReserveAdmin);

// =============== 共通ヘルパー ===============
function getWeekRange(baseDate) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { monday, sunday };
}

function makeGroupKey(date, startTime) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day + "::" + startTime;
}

const courseLabelMap = {
  vocal: "ボーカル",
  guitar: "ギター",
  bass: "ベース",
  ukulele: "ウクレレ",
  dtm: "DTM",
  musical: "ミュージカル / 声楽",
};

// =============== ① 月カレンダー（管理用） ===============
// GET: /admin/reservations/calendar
router.get("/calendar", async (req, res) => {
  try {
    // ?month=2025-11 形式。なければ今月。
    let baseDate;
    if (req.query.month) {
      const parts = req.query.month.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      baseDate = new Date(y, m - 1, 1);
    } else {
      baseDate = new Date();
    }
    baseDate.setHours(0, 0, 0, 0);

    const year = baseDate.getFullYear();
    const monthIndex = baseDate.getMonth(); // 0〜11
    const displayMonth = monthIndex + 1;

    const firstOfMonth = new Date(year, monthIndex, 1);
    const lastOfMonth = new Date(year, monthIndex + 1, 0);

    // カレンダー表示用に「その月を含む最初の日曜日〜最後の土曜日」まで
    const firstSunday = new Date(firstOfMonth);
    firstSunday.setDate(firstOfMonth.getDate() - firstOfMonth.getDay()); // 0=日

    const lastSaturday = new Date(lastOfMonth);
    lastSaturday.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));

    const days = [];
    for (
      let d = new Date(firstSunday);
      d <= lastSaturday;
      d.setDate(d.getDate() + 1)
    ) {
      days.push(new Date(d));
    }

    // 1週ごとに分割
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const prevMonthDate = new Date(year, monthIndex - 1, 1);
    const nextMonthDate = new Date(year, monthIndex + 1, 1);

    function ymParam(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return y + "-" + m;
    }

    // === ここからカレンダー用の Slot / Reservation 集計 ===

    // 対象期間の有効な Slot を全部取得
    const slots = await Slot.find({
      date: { $gte: firstSunday, $lte: lastSaturday },
      isActive: { $ne: false },
    })
      .sort({ date: 1, startTime: 1 })
      .lean();

    const calendarData = {}; // dateKey -> timeKey -> { slots: [], reservedCount }
    const slotById = {};

    // Slot を日付＋開始時間ごとにグループ化
    slots.forEach((slot) => {
      const d = new Date(slot.date);
      d.setHours(0, 0, 0, 0);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateKey = y + "-" + m + "-" + day;
      const timeKey = slot.startTime; // "10:00" など

      const idStr = String(slot._id);

      slot.hasReservation = false;
      slot.reservation = null;

      slotById[idStr] = slot;

      if (!calendarData[dateKey]) {
        calendarData[dateKey] = {};
      }
      if (!calendarData[dateKey][timeKey]) {
        calendarData[dateKey][timeKey] = {
          date: d,
          startTime: timeKey,
          slots: [],
          reservedCount: 0,
        };
      }
      calendarData[dateKey][timeKey].slots.push(slot);
    });

    // この期間の Slot に紐づく Reservation を全部取得
    const allSlotIds = Object.keys(slotById);
    if (allSlotIds.length > 0) {
      const reservations = await Reservation.find({
        slot: { $in: allSlotIds },
        status: { $ne: "cancelled" },
      })
        .select("slot type course name note")
        .lean();

      reservations.forEach((r) => {
        const sid = String(r.slot);
        const slot = slotById[sid];
        if (!slot) return;

        slot.hasReservation = true;
        slot.reservation = r;

        const d = new Date(slot.date);
        d.setHours(0, 0, 0, 0);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateKey = y + "-" + m + "-" + day;
        const timeKey = slot.startTime;

        if (calendarData[dateKey] && calendarData[dateKey][timeKey]) {
          calendarData[dateKey][timeKey].reservedCount += 1;
        }
      });
    }

    // 講師ごとの色インデックス（0〜）を作成
    const teacherColorMap = {};
    teachers.forEach((t, idx) => {
      if (t.value) {
        teacherColorMap[t.value] = idx;
      }
    });

    res.render("admin/reservations/calendar", {
      year,
      displayMonth,
      weeks,
      currentMonthIndex: monthIndex,
      currentMonthStart: firstOfMonth,
      prevMonth: ymParam(prevMonthDate),
      nextMonth: ymParam(nextMonthDate),
      calendarData,
      MAX_PER_TIME,
      teacherColorMap,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("calendar_error");
  }
});

// =============== ② 予約一覧 ===============
router.get("/", async (req, res) => {
  try {
    const reservations = await Reservation.find({})
      .sort({ createdAt: -1 })
      .populate("slot")
      .lean();

    res.render("admin/reservations/index", { reservations });
  } catch (err) {
    console.error(err);
    res.status(500).send("reservations_list_error");
  }
});

// =============== ③ 講師別・週カレンダーで新規予約 ===============
// 新規予約フォーム: /admin/reservations/new
// ※カレンダーから ?slotId=xxx 付きで来る前提
router.get("/new", async (req, res) => {
  try {
    const slotId = req.query.slotId;

    // slotId なしで来たらカレンダーへ戻す
    if (!slotId) {
      return res.redirect("/admin/reservations/calendar");
    }

    const selectedSlot = await Slot.findById(slotId).lean();
    if (!selectedSlot) {
      return res.status(404).send("slot_not_found");
    }

    // new.ejs で使う変数を渡す
    res.render("admin/reservations/new", {
      selectedSlotId: slotId,
      selectedSlot,
      slots: [], // 将来必要なら使う用。今はダミー。
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("reservations_new_error");
  }
});

// =============== ④ 予約フォーム（通常レッスン） ===============
router.get("/create", async (req, res) => {
  try {
    const slotId = req.query.slotId;
    if (!slotId) return res.redirect("/admin/reservations/new");

    const slot = await Slot.findById(slotId).lean();
    if (!slot || slot.isActive === false) {
      return res.status(404).send("slot_not_found");
    }

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

    const teacherInfo = teachers.find((t) => t.value === slot.teacher);
    let courseOptions = [];

    if (teacherInfo && Array.isArray(teacherInfo.courses)) {
      courseOptions = teacherInfo.courses.map((cId) => {
        return {
          id: cId,
          label: courseLabelMap[cId] || cId,
        };
      });
    }

    res.render("admin/reservations/create", {
      slot,
      dateLabel,
      courseOptions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("reservations_create_form_error");
  }
});

// POST: /admin/reservations
router.post("/", async (req, res) => {
  try {
    const { slotId, name, note, course } = req.body;

    if (!slotId || !name) {
      return res.status(400).send("missing_fields");
    }

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
      return res.status(409).send("this_time_full");
    }

    await Reservation.create({
      slot: slotId,
      type: "regular",
      course: course || "",
      name,
      email: "",
      phone: "",
      note: note || "",
      status: "confirmed",
    });

    res.redirect("/admin/reservations");
  } catch (err) {
    console.error(err);
    res.status(500).send("reservations_create_error");
  }
});

module.exports = router;
