// schedule.js — Trang Thời khóa biểu & Điểm danh.
// Chỉ lo phần giao diện + sự kiện; mọi phép tính lấy từ logic.js, dữ liệu lấy/lưu qua storage.js,
// hàm định dạng dùng chung lấy từ utils.js. Style nằm trong css/schedule.css.
import "./nav.js"; // sidebar: bấm trang đang mở thì không tải lại
import { COURSES } from "./data.js";
import { showToast } from "./ui.js";
import { loadSessions, saveSessions, loadSettings } from "./storage.js";
import {
  getWeekRange,
  getSessionsByWeek,
  getSessionsByMonth,
  getAllCourseStats,
  nextStatus,
  canMark,
  getDisplayStatus,
  getUnmarkedSessions,
  getDayPart,
} from "./logic.js";
import {
  pad, todayIso, addDays, addMonths, ddmm, ddmmyyyy, pct, esc, dayName,
  DAY_SHORT, DAY_FULL, DAY_PARTS, STATUS_LABEL, LEVEL_LABEL,
} from "./utils.js";

const COURSE_MAP = new Map(COURSES.map((c) => [c.courseId, c]));
const ANIMATION_MS = 300;

// ---------- Trạng thái của trang ----------
const today = todayIso();
const state = {
  mode: "week",          // "week" | "month"
  viewDate: today,       // một ngày bất kỳ nằm trong tuần/tháng đang xem
  courseFilter: "all",   // "all" hoặc courseId
  sessions: loadSessions(),
  levels: new Map(),     // courseId -> mức cảnh báo lần trước (để phát hiện "vừa chuyển sang danger")
  alerted: new Set(),    // môn đã báo danger, chưa tụt khỏi danger -> không báo lặp
};

// ---------- Tham chiếu DOM ----------
const $ = (id) => document.getElementById(id);
const gridEl = $("schedule-grid");
const weekWrap = gridEl.closest(".ui-week-scroll");
const titleEl = $("week-title");
const controlsEl = $("week-controls");

/** Tạo phần tử với class (và id) cho các khối JS tự thêm vào trang. */
const createEl = (tag, className, id) => {
  const el = document.createElement(tag);
  el.className = className;
  if (id) el.id = id;
  return el;
};

// Các phần tử do JS tự thêm vào (file HTML chỉ có khung)
const toolbarEl = createEl("div", "att-toolbar");          // nút chế độ + bộ lọc môn
toolbarEl.innerHTML = `
  <button type="button" class="ui-btn" id="btn-mode"></button>
  <label class="att-toolbar__filter">Môn học:
    <select class="att-select" id="course-filter">
      <option value="all">Tất cả môn</option>
      ${COURSES.map((c) => `<option value="${esc(c.courseId)}">${esc(c.courseName)}</option>`).join("")}
    </select>
  </label>`;
const noticeEl = createEl("div", "att-notice", "unmarked-notice"); // nhắc buổi chưa điểm danh
noticeEl.setAttribute("role", "status");
const emptyEl = createEl("p", "att-empty");                // tuần/tháng không có buổi học
emptyEl.hidden = true;
const monthEl = createEl("div", "att-month");              // lưới tháng
monthEl.hidden = true;
const statsEl = createEl("section", "att-stats");          // bảng thống kê
statsEl.setAttribute("aria-label", "Thống kê chuyên cần theo môn");

controlsEl.after(noticeEl);
weekWrap.before(toolbarEl);
weekWrap.after(emptyEl);
emptyEl.after(monthEl);
monthEl.after(statsEl);

// ======================================================================
// RENDER
// ======================================================================

/** Áp bộ lọc môn lên danh sách buổi học (dùng filter). */
const applyFilter = (sessions) =>
  sessions.filter((s) => state.courseFilter === "all" || s.courseId === state.courseFilter);

/** Tên môn đang lọc (để ghi vào thông báo trống). */
const filterName = () => (state.courseFilter === "all" ? "" : ` môn ${COURSE_MAP.get(state.courseFilter).courseName}`);

/** HTML một thẻ buổi học (cấu trúc theo docs/ui-preview.html).
 *  aria-label đọc đủ ngữ cảnh vì trên lưới, trình đọc màn hình không tự biết thẻ thuộc ngày/ca nào. */
const sessionCardHtml = (s) => {
  const course = COURSE_MAP.get(s.courseId);
  const shown = getDisplayStatus(s, today); // "unmarked" nếu đã qua ngày mà chưa điểm danh
  const action = canMark(s, today) ? "Nhấn Enter để đổi trạng thái" : "Chưa diễn ra, chưa thể điểm danh";
  const label = `${course.courseName}, ${dayName(s.date)} ${ddmm(s.date)}, tiết ${s.periodStart} đến ${s.periodEnd}, phòng ${s.room}: ${STATUS_LABEL[shown]}. ${action}`;
  return `
    <button type="button" class="ui-session ui-session--${shown}" style="--course-color:${esc(course.color)}" data-session-id="${esc(s.sessionId)}" aria-label="${esc(label)}">
      <span class="ui-session__name">${esc(course.courseName)}</span>
      <span class="ui-session__meta">Phòng ${esc(s.room)} · Tiết ${s.periodStart}–${s.periodEnd}</span>
      <span class="ui-session__status">${STATUS_LABEL[shown]}</span>
    </button>`;
};

/** Dựng lưới tuần: góc, 7 tiêu đề ngày, rồi mỗi buổi (Sáng/Chiều/Tối) gồm 1 nhãn buổi + 7 ô.
 *  Một ô có thể chứa nhiều buổi học (VD sáng có cả ca 1 và ca 2) -> sắp theo ca. */
const renderWeek = () => {
  const { start, end } = getWeekRange(state.viewDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const weekSessions = applyFilter(getSessionsByWeek(state.sessions, state.viewDate));

  const heads = days.map((d, i) => `
    <div class="ui-week__dayhead${d === today ? " ui-week__dayhead--today" : ""}">${DAY_SHORT[i]}<small>${ddmm(d)}</small></div>`);

  const rows = DAY_PARTS.map((part, p) => {
    const cells = days.map((d, i) => {
      const cards = weekSessions
        .filter((s) => s.date === d && getDayPart(s) === part.id)
        .sort((a, b) => a.shift - b.shift)
        .map(sessionCardHtml)
        .join("");
      return `<div class="ui-week__cell${d === today ? " ui-week__cell--today" : ""}" style="--day:${i + 1};--part:${p + 1}" data-label="${DAY_FULL[i]} ${ddmm(d)} · Buổi ${part.label.toLowerCase()} (Tiết ${part.from}–${part.to})">${cards}</div>`;
    });
    return `<div class="ui-week__part">${part.label}<small>Tiết ${part.from}–${part.to}</small></div>${cells.join("")}`;
  });

  gridEl.innerHTML = `<div class="ui-week__corner"></div>${heads.join("")}${rows.join("")}`;
  titleEl.textContent = `Tuần ${ddmm(start)} – ${ddmmyyyy(end)}`;

  // Tuần trống: trên mobile danh sách sẽ trống trơn nên cần báo rõ
  emptyEl.hidden = weekSessions.length > 0;
  emptyEl.textContent = `Tuần này không có buổi học${filterName()}.`;
};

/** Dựng lưới tháng: mỗi ngày có các chấm màu theo trạng thái buổi học. */
const renderMonth = () => {
  const [year, month] = state.viewDate.split("-").map(Number);
  const monthSessions = applyFilter(getSessionsByMonth(state.sessions, year, month));
  const daysInMonth = new Date(year, month, 0).getDate();
  const blanks = (new Date(year, month - 1, 1).getDay() + 6) % 7; // số ô trống đầu tháng (tuần bắt đầu T2)

  const heads = DAY_SHORT.map((d) => `<div class="att-month__head">${d}</div>`);
  const empties = Array.from({ length: blanks }, () => `<div class="att-month__day att-month__day--blank"></div>`);
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${year}-${pad(month)}-${pad(i + 1)}`;
    const daySessions = monthSessions.filter((s) => s.date === date);
    const dots = daySessions
      .map((s) => {
        const shown = getDisplayStatus(s, today);
        return `<span class="att-dot att-dot--${shown}" title="${esc(COURSE_MAP.get(s.courseId).courseName)} — ${STATUS_LABEL[shown]}"></span>`;
      })
      .join("");
    return `<button type="button" class="att-month__day${date === today ? " att-month__day--today" : ""}" data-date="${date}" aria-label="Ngày ${i + 1}/${month}: ${daySessions.length} buổi học. Nhấn để xem tuần">
      <span class="att-month__num">${i + 1}</span><span class="att-dots">${dots}</span></button>`;
  });

  monthEl.innerHTML = [...heads, ...empties, ...days].join("");
  titleEl.textContent = `Tháng ${pad(month)}/${year}`;
  emptyEl.hidden = monthSessions.length > 0;
  emptyEl.textContent = `Tháng này không có buổi học${filterName()}.`;
};

/** Bảng thống kê từng môn: thanh % đi học, số buổi còn được nghỉ, nhãn mức cảnh báo. */
const renderStats = () => {
  const stats = getAllCourseStats(state.sessions, COURSES, loadSettings(), today);
  statsEl.innerHTML = `
    <h3>Thống kê chuyên cần</h3>
    <ul class="att-stats__list">${stats.map((st) => `
      <li class="att-stat" style="--course-color:${esc(st.course.color)}">
        <span class="att-stat__name">${esc(st.course.courseName)}</span>
        <div class="att-stat__rate">
          <div class="att-bar" role="progressbar" aria-label="Tỷ lệ đi học" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(st.attendRate * 100)}">
            <div class="att-bar__fill" style="width:${st.attendRate * 100}%"></div>
          </div>
          <p class="att-stat__text">Đi học ${st.attended}/${st.held} buổi (${pct(st.attendRate)}) · Nghỉ ${st.absent + st.excused}/${st.total} (${pct(st.absentRate)})</p>
        </div>
        <span class="att-stat__left">Còn được nghỉ: <strong>${st.remaining}</strong> buổi</span>
        <span class="att-badge att-badge--${st.level}">${LEVEL_LABEL[st.level]}</span>
      </li>`).join("")}
    </ul>`;
  return stats;
};

/** Nhắc các buổi đã qua ngày mà chưa điểm danh, có nút nhảy tới buổi sớm nhất. */
const renderNotice = () => {
  const unmarked = getUnmarkedSessions(state.sessions, today);
  noticeEl.hidden = unmarked.length === 0;
  if (!unmarked.length) return;
  const first = unmarked[0];
  noticeEl.innerHTML = `
    <span class="att-notice__text">Có <strong>${unmarked.length}</strong> buổi đã qua nhưng chưa điểm danh
      (sớm nhất: ${dayName(first.date)} ${ddmm(first.date)}).</span>
    <button type="button" class="ui-btn" data-goto="${first.date}">Đến buổi đó</button>`;
};

/** Vẽ lại phần lịch theo chế độ hiện tại + cập nhật chữ trên các nút. */
const renderView = () => {
  const isWeek = state.mode === "week";
  weekWrap.hidden = !isWeek;
  monthEl.hidden = isWeek;
  (isWeek ? renderWeek : renderMonth)();

  $("btn-mode").textContent = isWeek ? "Xem theo tháng" : "Xem theo tuần";
  $("btn-prev-week").textContent = isWeek ? "← Tuần trước" : "← Tháng trước";
  $("btn-next-week").textContent = isWeek ? "Tuần sau →" : "Tháng sau →";
  $("btn-today").textContent = "Hôm nay";
};

// ======================================================================
// THÔNG BÁO (toast dùng chung từ ui.js + Notification của hệ điều hành)
// ======================================================================

/** Gửi Notification của trình duyệt (nếu bật trong cài đặt và người dùng cho phép). */
const sendBrowserNotification = async (title, body) => {
  if (!loadSettings().notifyEnabled || !("Notification" in window)) return;
  try {
    // Chỉ hỏi quyền khi chưa quyết định; hàm này chạy ngay sau thao tác click nên trình duyệt chấp nhận
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission === "granted") new Notification(title, { body });
  } catch {
    // Trình duyệt không hỗ trợ / bị chặn: bỏ qua, đã có toast thay thế
  }
};

/**
 * So mức cảnh báo mới với lần trước. Môn VỪA chuyển sang "danger" -> nhắc 1 lần.
 * Môn còn ở danger thì không nhắc lại; khi tụt khỏi danger mới được nhắc lần sau.
 */
const checkDangerAlerts = (stats) => {
  stats.forEach((st) => {
    const before = state.levels.get(st.courseId);
    if (st.level === "danger" && before !== "danger" && !state.alerted.has(st.courseId)) {
      state.alerted.add(st.courseId);
      const text = `Đã nghỉ ${st.absent + st.excused}/${st.total} buổi (${pct(st.absentRate)}), vượt giới hạn cho phép.`;
      showToast("danger", `${st.course.courseName}: nguy cơ cấm thi`, text);
      sendBrowserNotification(`Cảnh báo chuyên cần: ${st.course.courseName}`, text);
    }
    if (st.level !== "danger") state.alerted.delete(st.courseId);
    state.levels.set(st.courseId, st.level);
  });
};

// ======================================================================
// XỬ LÝ SỰ KIỆN
// ======================================================================

/** Chạy hiệu ứng trượt (class .ui-slide-left/right) trên phần tử, gỡ class khi xong. */
const animate = (el, direction) => {
  const cls = direction < 0 ? "ui-slide-left" : "ui-slide-right";
  el.classList.remove("ui-slide-left", "ui-slide-right");
  void el.offsetWidth; // buộc trình duyệt tính lại để animation chạy lại từ đầu
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ANIMATION_MS);
};

/** Phần tử đang hiển thị lịch (để chạy hiệu ứng). */
const currentView = () => (state.mode === "week" ? weekWrap : monthEl);

/** Chuyển tuần/tháng: direction = -1 (trước), +1 (sau). */
const handleNavigate = (direction) => {
  state.viewDate = state.mode === "week"
    ? addDays(state.viewDate, direction * 7)
    : addMonths(state.viewDate, direction);
  renderView();
  animate(currentView(), direction);
};

/** Đang xem đúng tuần (hoặc tháng) chứa ngày `date` chưa? */
const isViewing = (date) =>
  state.mode === "week"
    ? getWeekRange(state.viewDate).start === getWeekRange(date).start
    : state.viewDate.slice(0, 7) === date.slice(0, 7); // so "YYYY-MM"

/** Nhảy tới tuần/tháng chứa `date`; đang ở đó rồi thì không làm gì (không vẽ lại, không hiệu ứng). */
const goTo = (date) => {
  if (isViewing(date)) return;
  const direction = state.viewDate < date ? 1 : -1;
  state.viewDate = date;
  renderView();
  animate(currentView(), direction);
};

/** Click vào các nút điều khiển: dùng 1 listener cho cả thanh (event delegation). */
const handleControlsClick = (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;
  if (btn.id === "btn-prev-week") handleNavigate(-1);
  else if (btn.id === "btn-next-week") handleNavigate(1);
  else if (btn.id === "btn-today") goTo(today);
};

/** Đổi chế độ Tuần <-> Tháng. */
const handleToggleMode = () => {
  state.mode = state.mode === "week" ? "month" : "week";
  renderView();
};

/** Đổi môn trong bộ lọc: lọc lại lịch (thống kê vẫn hiện đủ các môn). */
const handleFilterChange = (event) => {
  state.courseFilter = event.target.value;
  renderView();
};

/**
 * Click vào một thẻ buổi học (event delegation trên lưới).
 * - Buổi chưa tới ngày: chưa thể điểm danh -> báo toast.
 * - Buổi đã tới ngày (kể cả còn "upcoming" vì chưa điểm danh): đổi trạng thái bằng nextStatus(),
 *   lưu, vẽ lại đúng thẻ đó + bảng thống kê + lời nhắc.
 */
const handleSessionClick = (event) => {
  const card = event.target.closest(".ui-session");
  if (!card) return;

  const session = state.sessions.find((s) => s.sessionId === card.dataset.sessionId);
  if (!session) return;

  if (!canMark(session, today)) {
    showToast("warning", "Chưa thể điểm danh", `Buổi học này diễn ra vào ${dayName(session.date)} ${ddmmyyyy(session.date)}.`);
    return;
  }

  const updated = { ...session, status: nextStatus(session.status) };
  state.sessions = state.sessions.map((s) => (s.sessionId === updated.sessionId ? updated : s));
  saveSessions(state.sessions);

  card.outerHTML = sessionCardHtml(updated).trim();
  gridEl.querySelector(`[data-session-id="${updated.sessionId}"]`)?.focus(); // giữ focus cho người dùng bàn phím

  renderNotice();
  checkDangerAlerts(renderStats());
};

/** Click một ngày trong lưới tháng: chuyển sang xem tuần chứa ngày đó. */
const handleMonthClick = (event) => {
  const dayBtn = event.target.closest("[data-date]");
  if (!dayBtn) return;
  state.viewDate = dayBtn.dataset.date;
  state.mode = "week";
  renderView();
};

/** Nút "Đến buổi đó" trong lời nhắc: về chế độ tuần, tới tuần có buổi chưa điểm danh sớm nhất. */
const handleNoticeClick = (event) => {
  const btn = event.target.closest("[data-goto]");
  if (!btn) return;
  if (state.mode !== "week") {
    state.mode = "week";
    state.viewDate = btn.dataset.goto;
    renderView();
  } else {
    goTo(btn.dataset.goto);
  }
  gridEl.querySelector(".ui-session--unmarked")?.focus();
};

// ---------- Gắn sự kiện (mỗi vùng chỉ 1 listener) ----------
controlsEl.addEventListener("click", handleControlsClick);
$("btn-mode").addEventListener("click", handleToggleMode);
$("course-filter").addEventListener("change", handleFilterChange);
gridEl.addEventListener("click", handleSessionClick);
monthEl.addEventListener("click", handleMonthClick);
noticeEl.addEventListener("click", handleNoticeClick);

// ---------- Khởi động ----------
renderView();
renderNotice();
getAllCourseStats(state.sessions, COURSES, loadSettings(), today).forEach((st) => {
  state.levels.set(st.courseId, st.level);                // ghi nhận mức ban đầu, không báo khi mới tải trang
  if (st.level === "danger") state.alerted.add(st.courseId);
});
renderStats();
