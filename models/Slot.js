// models/Slot.js
const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema(
  {
    // 予約したい「日付」 例: 2025-11-25
    date: {
      type: Date,
      required: true,
    },
    // 開始時間 例: "14:00"
    startTime: {
      type: String,
      required: true,
    },
    // 終了時間 例: "15:00"
    endTime: {
      type: String,
      required: true,
    },
    // 担当講師名（「Atsushi」「Megumi」など自由文字列）
    teacher: {
      type: String,
      required: true,
    },
    // メモ（任意）
    memo: {
      type: String,
      default: "",
    },
    // 有効フラグ（将来キャンセル扱いなどに使える）
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// 同じ講師・同じ日付・同じ開始時間の重複登録を防ぐ
slotSchema.index({ date: 1, startTime: 1, teacher: 1 }, { unique: true });

module.exports = mongoose.model("Slot", slotSchema);
