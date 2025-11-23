// models/Teacher.js
const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    // 表示名（例: "Atsushi"）
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // 担当コース（例: ["guitar", "bass"]）
    courses: {
      type: [String],
      default: [],
    },
    // 退職・一時停止などで無効にする用
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt 自動追加
  }
);

module.exports = mongoose.model("Teacher", teacherSchema);
