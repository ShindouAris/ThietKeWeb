// logic.js — Hàm thuần xử lý dữ liệu (KHÔNG đụng DOM, KHÔNG đọc localStorage).
// Dữ liệu vào qua tham số, kết quả trả ra bằng return -> dễ kiểm thử, dễ giải thích.
// Quy ước ngày: chuỗi "YYYY-MM-DD" (so sánh chuỗi theo thứ tự chữ cái = so sánh ngày).

import { toIso, addDays, isValidIsoDate } from "./utils.js"; // hàm ngày dùng chung (cũng là hàm thuần)

const EPS = 1e-9; // sai số nhỏ khi so sánh số thực (VD 3/15 so với 0.2)

// ---------- Hàm phụ (không export) ----------

/** Chia an toàn: mẫu = 0 thì trả 0 (không chia cho 0). */
const safeRate = (part, whole) => (whole > 0 ? part / whole : 0);

/** Sắp xếp theo ngày rồi theo ca, trả mảng mới (không làm thay đổi mảng gốc). */
const sortByTime = (sessions) =>
  [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift);

/** Thứ tự mức cảnh báo để so sánh "mức nào nặng hơn". */
const LEVEL_RANK = { safe: 0, warning: 1, danger: 2 };

// ---------- Tuần / tháng ----------

/**
 * Lấy khoảng tuần (Thứ Hai → Chủ Nhật) chứa một ngày.
 * Chủ Nhật thuộc về tuần kết thúc ở chính ngày đó. Tuần có thể vắt qua tháng/năm mới.
 * @param {string|Date} date Ngày bất kỳ, "YYYY-MM-DD" hoặc Date.
 * @returns {{start: string, end: string}} Hai ngày dạng "YYYY-MM-DD".
 */
export const getWeekRange = (date) => {
  const iso = toIso(date);
  const dayOfWeek = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Chủ Nhật ... 6 = Thứ Bảy
  const daysFromMonday = (dayOfWeek + 6) % 7;                 // T2 → 0, ..., CN → 6
  const start = addDays(iso, -daysFromMonday);
  return { start, end: addDays(start, 6) };
};

/**
 * Lọc các buổi học nằm trong tuần chứa `date`, đã sắp theo ngày và ca.
 * Tuần không có lịch thì trả mảng rỗng.
 * @param {Array} sessions Danh sách buổi học.
 * @param {string|Date} date Ngày bất kỳ trong tuần cần xem.
 * @returns {Array} Các buổi học trong tuần.
 */
export const getSessionsByWeek = (sessions, date) => {
  const { start, end } = getWeekRange(date);
  return sortByTime(sessions.filter((s) => s.date >= start && s.date <= end));
};

/**
 * Lọc các buổi học trong một tháng, đã sắp theo ngày và ca.
 * @param {Array} sessions Danh sách buổi học.
 * @param {number} year Năm đầy đủ, VD 2026.
 * @param {number} month Tháng từ 1 đến 12 (KHÔNG phải kiểu 0-11 của Date).
 * @returns {Array} Các buổi học trong tháng.
 */
export const getSessionsByMonth = (sessions, year, month) => {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return sortByTime(sessions.filter((s) => s.date.startsWith(prefix)));
};

// ---------- Thống kê chuyên cần ----------

/**
 * Tính chuyên cần của một môn.
 * - held (đã diễn ra) = số buổi có status khác "upcoming".
 * - attendRate = present / held (held = 0 thì 0).
 * - absentRate = (absent + excused) / totalSessions của môn (total = 0 thì 0).
 * @param {Array} sessions Tất cả buổi học (hàm tự lọc theo môn).
 * @param {{courseId: string, totalSessions: number}} course Môn cần tính.
 * @param {string|Date} [today] Ngày hiện tại. Quy tắc tính dựa vào status nên hiện chưa dùng,
 *   giữ tham số để các hàm thống kê có chữ ký thống nhất.
 * @returns {{attended:number, absent:number, excused:number, held:number, total:number,
 *   attendRate:number, absentRate:number}}
 */
export const calcAttendance = (sessions, course, today) => {
  const mine = sessions.filter((s) => s.courseId === course.courseId);
  const count = (status) => mine.filter((s) => s.status === status).length;

  const attended = count("present");
  const absent = count("absent");
  const excused = count("excused");
  const held = mine.filter((s) => s.status !== "upcoming").length;
  const total = course.totalSessions;

  return {
    attended,
    absent,
    excused,
    held,
    total,
    attendRate: safeRate(attended, held),
    absentRate: safeRate(absent + excused, total),
  };
};

/**
 * Xác định mức cảnh báo từ tỷ lệ nghỉ.
 * < warningAt → "safe"; warningAt..absenceLimit (gồm cả hai đầu) → "warning"; > absenceLimit → "danger".
 * @param {number} absentRate Tỷ lệ nghỉ (0..1).
 * @param {{absenceLimit:number, warningAt:number}} settings Cài đặt ngưỡng.
 * @returns {"safe"|"warning"|"danger"}
 */
export const getWarningLevel = (absentRate, settings) => {
  if (absentRate > settings.absenceLimit + EPS) return "danger";
  if (absentRate >= settings.warningAt - EPS) return "warning";
  return "safe";
};

/**
 * Còn được nghỉ thêm bao nhiêu buổi mà chưa vượt ngưỡng (chưa vào "danger").
 * Số buổi nghỉ tối đa = floor(absenceLimit × totalSessions); trừ đi số buổi đã nghỉ. Không âm.
 * @param {{totalSessions:number}} course Môn học.
 * @param {{absent:number, excused:number}} stats Kết quả của calcAttendance.
 * @param {{absenceLimit:number}} settings Cài đặt ngưỡng.
 * @returns {number} Số buổi còn được nghỉ (>= 0).
 */
export const remainingAbsences = (course, stats, settings) => {
  const maxAbsences = Math.floor(settings.absenceLimit * course.totalSessions + EPS);
  return Math.max(0, maxAbsences - (stats.absent + stats.excused));
};

/**
 * Thống kê từng môn: gộp kết quả calcAttendance với mức cảnh báo và số buổi còn được nghỉ.
 * @param {Array} sessions Tất cả buổi học.
 * @param {Array} courses Danh sách môn.
 * @param {{absenceLimit:number, warningAt:number}} settings Cài đặt.
 * @param {string|Date} [today] Ngày hiện tại.
 * @returns {Array<Object>} Mỗi phần tử: { course, courseId, ...calcAttendance, level, remaining }.
 */
export const getAllCourseStats = (sessions, courses, settings, today) =>
  courses.map((course) => {
    const stats = calcAttendance(sessions, course, today);
    return {
      course,
      courseId: course.courseId,
      ...stats,
      level: getWarningLevel(stats.absentRate, settings),
      remaining: remainingAbsences(course, stats, settings),
    };
  });

/**
 * Các buổi sắp tới: status "upcoming", từ `today` trở đi, sắp theo thời gian, lấy tối đa `limit`.
 * @param {Array} sessions Tất cả buổi học.
 * @param {string|Date} today Ngày hiện tại (buổi diễn ra hôm nay vẫn tính là sắp tới).
 * @param {number} [limit=5] Số buổi tối đa.
 * @returns {Array} Các buổi sắp tới (mảng rỗng nếu không còn buổi nào).
 */
export const getUpcomingSessions = (sessions, today, limit = 5) => {
  const todayIso = toIso(today);
  return sortByTime(
    sessions.filter((s) => s.status === "upcoming" && s.date >= todayIso)
  ).slice(0, Math.max(0, limit));
};

/**
 * Số liệu tổng quan cho Dashboard.
 * Tỷ lệ tổng gộp theo số buổi của mọi môn: attendRate = tổng present / tổng đã diễn ra,
 * absentRate = tổng (absent + excused) / tổng totalSessions.
 * @param {Array} sessions Tất cả buổi học.
 * @param {Array} courses Danh sách môn.
 * @param {{absenceLimit:number, warningAt:number}} settings Cài đặt.
 * @param {string|Date} today Ngày hiện tại.
 * @returns {{courseCount:number, held:number, attended:number, absent:number, excused:number,
 *   total:number, attendRate:number, absentRate:number, overallLevel:string,
 *   levelCounts:{safe:number, warning:number, danger:number}, alertCourses:Array,
 *   worstCourse:(Object|null), courseStats:Array, upcoming:Array}}
 */
export const getOverallStats = (sessions, courses, settings, today) => {
  const courseStats = getAllCourseStats(sessions, courses, settings, today);
  const sum = (key) => courseStats.reduce((acc, c) => acc + c[key], 0);

  const held = sum("held");
  const attended = sum("attended");
  const absent = sum("absent");
  const excused = sum("excused");
  const total = sum("total");

  const levelCounts = courseStats.reduce(
    (acc, c) => ({ ...acc, [c.level]: acc[c.level] + 1 }),
    { safe: 0, warning: 0, danger: 0 }
  );

  // Môn nghỉ nhiều nhất (null nếu chưa có môn nào)
  const worstCourse = courseStats.reduce(
    (worst, c) => (worst === null || c.absentRate > worst.absentRate ? c : worst),
    null
  );

  // Mức nặng nhất trong các môn
  const overallLevel = courseStats.reduce(
    (level, c) => (LEVEL_RANK[c.level] > LEVEL_RANK[level] ? c.level : level),
    "safe"
  );

  return {
    courseCount: courses.length,
    held,
    attended,
    absent,
    excused,
    total,
    attendRate: safeRate(attended, held),
    absentRate: safeRate(absent + excused, total),
    overallLevel,
    levelCounts,
    alertCourses: courseStats.filter((c) => c.level !== "safe"),
    worstCourse,
    courseStats,
    upcoming: getUpcomingSessions(sessions, today),
    unmarked: getUnmarkedSessions(sessions, today),
  };
};

// ---------- Điểm danh ----------

/** Vòng lặp trạng thái khi người dùng bấm vào một buổi. */
const STATUS_CYCLE = { present: "absent", absent: "excused", excused: "present" };

/**
 * Trạng thái kế tiếp khi bấm: present → absent → excused → present.
 * "upcoming" (hoặc giá trị lạ) → "present" (bấm lần đầu là đánh dấu có mặt).
 * @param {string} status Trạng thái hiện tại.
 * @returns {"present"|"absent"|"excused"}
 */
export const nextStatus = (status) => STATUS_CYCLE[status] ?? "present";

/**
 * Buổi học đã tới ngày chưa (được phép điểm danh)? So theo NGÀY, không theo status:
 * dữ liệu lưu từ trước vẫn để "upcoming" dù ngày học đã qua, nếu so theo status thì
 * những buổi đó sẽ không bao giờ điểm danh được.
 * @param {{date: string}} session Buổi học.
 * @param {string|Date} today Ngày hiện tại.
 * @returns {boolean} true nếu ngày học <= hôm nay.
 */
export const canMark = (session, today) => session.date <= toIso(today);

/**
 * Trạng thái để HIỂN THỊ: giống status, riêng buổi "upcoming" đã qua ngày thì là "unmarked"
 * (chưa điểm danh). Không đổi dữ liệu gốc; quy tắc tính tỷ lệ trong CLAUDE.md giữ nguyên.
 * @param {{date: string, status: string}} session Buổi học.
 * @param {string|Date} today Ngày hiện tại.
 * @returns {"present"|"absent"|"excused"|"upcoming"|"unmarked"}
 */
export const getDisplayStatus = (session, today) =>
  session.status === "upcoming" && session.date < toIso(today) ? "unmarked" : session.status;

/**
 * Các buổi đã qua ngày (trước hôm nay) mà vẫn chưa điểm danh, sắp theo thời gian.
 * @param {Array} sessions Tất cả buổi học.
 * @param {string|Date} today Ngày hiện tại.
 * @returns {Array} Mảng rỗng nếu đã điểm danh đủ.
 */
export const getUnmarkedSessions = (sessions, today) =>
  sortByTime(sessions.filter((s) => getDisplayStatus(s, today) === "unmarked"));

// ---------- Kiểm tra dữ liệu nhập từ file JSON ----------

const VALID_STATUS = ["present", "absent", "excused", "upcoming"];
const PROFILE_KEYS = ["studentId", "fullName", "email", "phone", "className"];
const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

/**
 * Kiểm tra một buổi học có đúng Data Contract không.
 * @returns {string} Thông báo lỗi, "" nếu hợp lệ.
 */
const sessionError = (s, courseIds) => {
  if (typeof s !== "object" || s === null) return "không phải đối tượng";
  if (typeof s.sessionId !== "string" || s.sessionId === "") return "thiếu sessionId";
  if (!courseIds.includes(s.courseId)) return `môn "${s.courseId}" không có trong danh sách môn`;
  if (!isValidIsoDate(s.date)) return `ngày "${s.date}" không hợp lệ (cần YYYY-MM-DD)`;
  if (!isInt(s.shift, 1, 4)) return "ca học phải từ 1 đến 4";
  if (!isInt(s.periodStart, 1, 15) || !isInt(s.periodEnd, s.periodStart, 15)) return "tiết học không hợp lệ";
  if (typeof s.room !== "string") return "thiếu phòng học";
  if (!VALID_STATUS.includes(s.status)) return `trạng thái "${s.status}" không hợp lệ`;
  return "";
};

/**
 * Kiểm tra file sao lưu (JSON đã parse) trước khi ghi đè dữ liệu.
 * Cấu trúc: { app: "lhu-attendance", version: 1, sessions: [...], profile?: {...}, settings?: {...} }
 * @param {*} data Kết quả JSON.parse.
 * @param {Array<{courseId: string}>} courses Danh sách môn hợp lệ.
 * @returns {{ok: boolean, errors: string[], value: (Object|null)}}
 *   errors tối đa 5 dòng; value chỉ có khi ok = true.
 */
export const validateBackup = (data, courses) => {
  const fail = (...errors) => ({ ok: false, errors: errors.slice(0, 5), value: null });
  if (typeof data !== "object" || data === null || Array.isArray(data)) return fail("File không phải bản sao lưu của ứng dụng.");
  if (data.app !== "lhu-attendance") return fail("File không phải bản sao lưu của LHU Attendance Tracker.");
  if (!Array.isArray(data.sessions) || data.sessions.length === 0) return fail("File không có danh sách buổi học.");

  const courseIds = courses.map((c) => c.courseId);
  const sessionErrors = data.sessions
    .map((s, i) => ({ i, msg: sessionError(s, courseIds) }))
    .filter((r) => r.msg)
    .map((r) => `Buổi thứ ${r.i + 1}: ${r.msg}.`);

  const ids = data.sessions.map((s) => s?.sessionId);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  const dupErrors = duplicates.length ? [`Trùng mã buổi học: ${[...new Set(duplicates)].slice(0, 3).join(", ")}.`] : [];

  const profile = data.profile;
  const profileErrors = profile !== undefined &&
    (typeof profile !== "object" || profile === null || !PROFILE_KEYS.every((k) => typeof profile[k] === "string"))
    ? ["Hồ sơ sinh viên thiếu thông tin."] : [];

  const st = data.settings;
  const settingsErrors = st !== undefined &&
    (typeof st !== "object" || st === null ||
     !(st.absenceLimit > 0 && st.absenceLimit <= 1) ||
     !(st.warningAt > 0 && st.warningAt <= st.absenceLimit) ||
     typeof st.notifyEnabled !== "boolean")
    ? ["Cài đặt không hợp lệ (giới hạn nghỉ phải trong 0–100% và lớn hơn mức cảnh báo)."] : [];

  const errors = [...sessionErrors, ...dupErrors, ...profileErrors, ...settingsErrors];
  if (errors.length) return fail(...errors);
  return { ok: true, errors: [], value: { sessions: data.sessions, profile, settings: st } };
};

/**
 * Tạo bản sao lưu để xuất ra file JSON.
 * @param {Array} sessions Buổi học. @param {Object} profile Hồ sơ. @param {Object} settings Cài đặt.
 * @param {string} exportedAt Thời điểm xuất (ISO string), truyền vào để hàm vẫn thuần.
 * @returns {Object} Đối tượng sẵn sàng JSON.stringify; validateBackup() đọc lại được.
 */
export const createBackup = (sessions, profile, settings, exportedAt) => ({
  app: "lhu-attendance",
  version: 1,
  exportedAt,
  profile,
  settings,
  sessions,
});
