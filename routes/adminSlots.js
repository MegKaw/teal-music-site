// routes/adminSlots.js
const express = require("express");
const router = express.Router();

const Slot = require("../models/Slot");
const teachers = require("../data/teachers"); // ★ ここで講師一覧読み込み

// 一覧表示: /admin/slots
router.get("/", async (req, res) => {
  try {
    const slots = await Slot.find({ isActive: true })
      .sort({ date: 1, startTime: 1 })
      .lean();

    // ★ slots と一緒に teachers も渡す
    res.render("admin/slots/index", { slots, teachers });
  } catch (err) {
    console.error(err);
    res.status(500).send("slot_list_error");
  }
});

// 新規作成フォーム: /admin/slots/new
router.get("/new", (req, res) => {
  // ★ ここも teachers を渡してる（new.ejs でプルダウンに使う）
  res.render("admin/slots/new", { teachers });
});

// 新規作成POST: /admin/slots
router.post("/", async (req, res) => {
  try {
    const { date, startTime, endTime, teacher, memo } = req.body;

    if (!date || !startTime || !endTime || !teacher) {
      return res.status(400).send("missing_fields");
    }

    await Slot.create({
      date,
      startTime,
      endTime,
      teacher,
      memo: memo || "",
    });

    res.redirect("/admin/reservations/calendar");
  } catch (err) {
    console.error(err);
    res.status(500).send("slot_create_error");
  }
});

// 削除（無効化）: /admin/slots/:id/delete
router.post("/:id/delete", async (req, res) => {
  try {
    const id = req.params.id;
    await Slot.findByIdAndUpdate(id, { isActive: false });
    res.redirect("/admin/slots");
  } catch (err) {
    console.error(err);
    res.status(500).send("slot_delete_error");
  }
});

module.exports = router;
