// models/Reservation.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const reservationSchema = new Schema(
  {
    // どの枠か
    slot: {
      type: Schema.Types.ObjectId,
      ref: "Slot",
      required: true,
    },

    // 種別: trial = 体験, regular = 通常レッスン
    type: {
      type: String,
      enum: ["trial", "regular"],
      default: "trial",
    },

    // コースID (vocal / guitar / ... )
    course: {
      type: String,
      default: "",
    },

    // 生徒名（体験でも既存生徒でも必須）
    name: {
      type: String,
      required: true,
    },

    // ★メールアドレス：体験では使うが、既存生徒は空でもOK
    email: {
      type: String,
      default: "",
      // required は付けない
    },

    // 電話番号（任意）
    phone: {
      type: String,
      default: "",
    },

    // 備考（任意）
    note: {
      type: String,
      default: "",
    },

    // ステータス: pending(体験申し込み) / confirmed(確定) / cancelled(キャンセル)
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Reservation", reservationSchema);
