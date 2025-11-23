// data/teachers.js
// 講師と担当できるコース
// value … Slot.teacher に入っている値
// courses … 担当できるコースID（courses.js の id）

module.exports = [
  {
    value: "川崎",
    label: "川崎先生",
    courses: ["guitar", "bass", "ukulele", "vocal", "dtm"],
    colorClass: "teacher-kawasaki", // 将来タイムラインで色分け用
  },
  {
    value: "益井",
    label: "益井先生",
    courses: ["vocal", "musical", "ukulele"],
    colorClass: "teacher-masui",
  },
  {
    value: "益山",
    label: "益山先生",
    courses: ["guitar", "bass", "ukulele", "dtm"],
    colorClass: "teacher-masuyama",
  },
  {
    value: "坂井",
    label: "坂井先生",
    courses: ["vocal", "musical"],
    colorClass: "teacher-sakai",
  },
  {
    value: "依田",
    label: "依田先生",
    courses: ["vocal", "musical"],
    colorClass: "teacher-yoda",
  },

  // 追加したかったらここに増やす
];
