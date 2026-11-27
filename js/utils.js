// utils.js — Hàm tiện ích và hằng số hiển thị dùng chung cho mọi trang.
// Chỉ gồm hàm thuần (không đụng DOM, không đọc localStorage) nên logic.js cũng dùng được.
// Quy ước ngày: chuỗi "YYYY-MM-DD"; tính toán ngày dùng UTC để không lệch múi giờ.

// ---------- Ngày tháng ----------

/** Thêm số 0 phía trước cho đủ 2 chữ số: 7 → "07". */
export const pad = (n) => String(n).padStart(2, "0");

/** Đổi Date (giờ địa phương) hoặc chuỗi thành "YYYY-MM-DD". */
export const toIso = (date) =>
  typeof date === "string"
    ? date.slice(0, 10)
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Ngày hôm nay dạng "YYYY-MM-DD" theo giờ máy người dùng. */
export const todayIso = () => toIso(new Date());

/** Cộng n ngày (n âm = lùi). Tự qua tháng / năm / năm nhuận đúng. */
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Ngày đầu tháng sau khi cộng n tháng: addMonths("2026-11-27", 1) → "2026-12-01". */
export const addMonths = (iso, n) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};

/** Chuỗi ngày có hợp lệ thật không (loại "2026-02-30", "2026-13-01"...). */
export const isValidIsoDate = (iso) =>
  typeof iso === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
  new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso;

/** Vị trí trong tuần, Thứ Hai = 0 ... Chủ nhật = 6. */
export const weekdayIndex = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

// ---------- Định dạng hiển thị ----------

/** "2026-11-27" → "27/11". */
export const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "2026-11-27" → "27/11/2026". */
export const ddmmyyyy = (iso) => `${ddmm(iso)}/${iso.slice(0, 4)}`;

/** Tỷ lệ 0..1 → "66,7%" (dấu phẩy thập phân kiểu Việt Nam). */
export const pct = (rate) => `${(rate * 100).toFixed(1).replace(".", ",")}%`;

/** Chống chèn HTML (XSS) khi đưa chuỗi vào innerHTML. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Hằng số hiển thị ----------

export const DAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const DAY_FULL = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];

/** Ca học → [tiết bắt đầu, tiết kết thúc]. */
export const SHIFT_PERIODS = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12] };
export const SHIFTS = [1, 2, 3, 4];

/** Nhãn trạng thái. "unmarked" không lưu trong dữ liệu: là buổi "upcoming" đã qua ngày (xem logic.js). */
export const STATUS_LABEL = {
  present: "Có mặt",
  absent: "Vắng",
  excused: "Có phép",
  upcoming: "Sắp tới",
  unmarked: "Chưa điểm danh",
};
export const LEVEL_LABEL = { safe: "An toàn", warning: "Cảnh báo", danger: "Nguy hiểm" };

/** Tên thứ đầy đủ của một ngày: "2026-11-27" → "Thứ Sáu". */
export const dayName = (iso) => DAY_FULL[weekdayIndex(iso)];
