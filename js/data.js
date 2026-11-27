// data.js — Dữ liệu mẫu của dự án (đúng Data Contract trong CLAUDE.md)
// Các file khác chỉ import, KHÔNG sửa trực tiếp mảng này; thay đổi của người dùng lưu qua storage.js.

// ---------- Sinh viên ----------
export const STUDENT = {
  studentId: "12500888",
  fullName: "Nguyễn Văn An",
  email: "an.nguyen@lhu.edu.vn",
  phone: "0901234567",
  className: "25DH-CNTT1",
};

// ---------- Môn học (5 môn CNTT năm 2, mỗi môn 15 buổi) ----------
export const COURSES = [
  { courseId: "CTDL", courseName: "Cấu trúc dữ liệu và giải thuật", credits: 3, lecturer: "ThS. Trần Minh Khoa", room: "A.301", color: "#1e6fd9", totalSessions: 15 },
  { courseId: "OOP",  courseName: "Lập trình hướng đối tượng",     credits: 3, lecturer: "ThS. Lê Thị Hoa",     room: "B.205", color: "#e67e22", totalSessions: 15 },
  { courseId: "CSDL", courseName: "Cơ sở dữ liệu",                 credits: 3, lecturer: "TS. Phạm Quốc Bảo",   room: "A.402", color: "#2ea44f", totalSessions: 15 },
  { courseId: "MMT",  courseName: "Mạng máy tính",                 credits: 3, lecturer: "ThS. Võ Hoàng Long",  room: "C.103", color: "#8e44ad", totalSessions: 15 },
  { courseId: "WEB",  courseName: "Thiết kế Web",                  credits: 3, lecturer: "ThS. Đặng Thu Hà",    room: "Lab.2", color: "#d63384", totalSessions: 15 },
];

// ---------- Cấu hình sinh buổi học ----------
const SEMESTER_START = "2026-09-07"; // Thứ Hai, tuần 1
const TODAY = "2026-11-27";          // Buổi trước ngày này là đã diễn ra
const WEEKS = 15;                    // 15 tuần, mỗi tuần 1 buổi

// Ca học -> tiết (ca 1: tiết 1-3, ca 2: tiết 4-6, ca 3: tiết 7-9, ca 4: tiết 10-12)
const PERIODS = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12] };

// Lịch mỗi môn: dayOffset = số ngày tính từ Thứ Hai (0 = T2 ... 4 = T6), shift = ca học.
// marks = { chỉ số tuần (0..14): trạng thái } — tuần không ghi mặc định là "present".
const PLAN = {
  CTDL: { dayOffset: 0, shift: 1, marks: { 2: "absent", 5: "excused" } },                       // 2/15 -> safe
  OOP:  { dayOffset: 1, shift: 2, marks: { 3: "absent", 7: "excused", 9: "absent" } },         // 3/15 = 0.2 -> warning
  CSDL: { dayOffset: 2, shift: 3, marks: { 1: "absent", 4: "absent", 6: "excused", 10: "absent" } }, // 4/15 -> danger
  MMT:  { dayOffset: 3, shift: 1, marks: { 8: "excused" } },                                   // 1/15 -> safe
  WEB:  { dayOffset: 3, shift: 3, marks: { 5: "absent", 9: "excused" } },                      // 2/15 -> safe
};

// Cộng thêm n ngày vào ngày "YYYY-MM-DD" (dùng UTC để không bị lệch múi giờ)
const addDays = (isoDate, n) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ---------- Buổi học: 5 môn x 15 tuần = 75 buổi ----------
export const SESSIONS = COURSES.flatMap((course) => {
  const { dayOffset, shift, marks } = PLAN[course.courseId];
  const [periodStart, periodEnd] = PERIODS[shift];

  return Array.from({ length: WEEKS }, (_, week) => {
    const date = addDays(SEMESTER_START, week * 7 + dayOffset);
    // Buổi đã diễn ra lấy trạng thái từ marks (mặc định present); buổi chưa tới là upcoming
    const status = date < TODAY ? (marks[week] ?? "present") : "upcoming";
    return {
      sessionId: `${course.courseId}-${String(week + 1).padStart(2, "0")}`,
      courseId: course.courseId,
      date,
      shift,
      periodStart,
      periodEnd,
      room: course.room,
      status,
    };
  });
});

// ---------- Cài đặt mặc định ----------
export const SETTINGS = {
  absenceLimit: 0.2,   // vượt mức này -> "danger"
  warningAt: 0.15,     // từ mức này -> "warning"
  notifyEnabled: true, // bật nhắc nhở
};
