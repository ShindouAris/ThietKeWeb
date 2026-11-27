// schedule.js — Trang Thời khóa biểu & Điểm danh.
// Chỉ lo phần giao diện + sự kiện; mọi phép tính lấy từ logic.js, dữ liệu lấy/lưu qua storage.js.
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
} from "./logic.js";

// ---------- Hằng số hiển thị ----------
const DAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_FULL = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const SHIFT_PERIODS = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12] }; // ca -> tiết
const SHIFTS = [1, 2, 3, 4];
const STATUS_LABEL = { present: "Có mặt", absent: "Vắng", excused: "Có phép", upcoming: "Sắp tới" };
const LEVEL_LABEL = { safe: "An toàn", warning: "Cảnh báo", danger: "Nguy hiểm" };
const COURSE_MAP = new Map(COURSES.map((c) => [c.courseId, c]));
const ANIMATION_MS = 300;

// ---------- Hàm ngày (chỉ để điều hướng/hiển thị, không phải logic tính chuyên cần) ----------
const pad = (n) => String(n).padStart(2, "0");
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const shiftMonth = (iso, n) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const pct = (rate) => `${(rate * 100).toFixed(1).replace(".", ",")}%`;
// Chống chèn HTML khi đưa chuỗi vào innerHTML
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Trạng thái của trang ----------
const today = toIso(new Date());
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

// Các phần tử do JS tự thêm vào (file HTML chỉ có khung)
const monthEl = document.createElement("div");   // lưới tháng
monthEl.className = "att-month";
monthEl.hidden = true;
const statsEl = document.createElement("section"); // bảng thống kê
statsEl.className = "att-stats";
statsEl.setAttribute("aria-label", "Thống kê chuyên cần theo môn");
const toolbarEl = document.createElement("div");   // nút chế độ + bộ lọc môn
toolbarEl.className = "att-toolbar";
toolbarEl.innerHTML = `
  <button type="button" class="ui-btn" id="btn-mode"></button>
  <label class="att-toolbar__filter">Môn học:
    <select class="att-select" id="course-filter">
      <option value="all">Tất cả môn</option>
      ${COURSES.map((c) => `<option value="${esc(c.courseId)}">${esc(c.courseName)}</option>`).join("")}
    </select>
  </label>`;
weekWrap.before(toolbarEl);
weekWrap.after(monthEl);
monthEl.after(statsEl);

// ---------- CSS riêng của trang này (tiền tố .att-), dùng biến màu từ styles.css ----------
const style = document.createElement("style");
style.textContent = `
.att-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-3);margin-bottom:var(--ui-space-4)}
.att-select{padding:var(--ui-space-2);font:inherit;border:1px solid var(--ui-border-strong);border-radius:var(--ui-radius-sm)}
.att-month{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--ui-border);border:1px solid var(--ui-border);border-radius:var(--ui-radius);overflow:hidden}
.att-month[hidden]{display:none}
.att-month__head{padding:var(--ui-space-2);font-weight:700;text-align:center;color:var(--ui-primary-dark);background:var(--ui-primary-light)}
.att-month__day{display:flex;flex-direction:column;gap:var(--ui-space-1);min-height:72px;padding:var(--ui-space-2);font:inherit;text-align:left;background:var(--ui-surface);border:0;cursor:pointer}
.att-month__day:hover{background:#f6faff}
.att-month__day--blank{cursor:default;background:var(--ui-bg)}
.att-month__day--today .att-month__num{color:#fff;background:var(--ui-primary);border-radius:999px;padding:0 6px;align-self:flex-start}
.att-dots{display:flex;flex-wrap:wrap;gap:4px}
.att-dot{width:12px;height:12px;border-radius:50%;background:var(--dot)}
.att-dot--present{--dot:var(--ui-present)}.att-dot--absent{--dot:var(--ui-absent)}
.att-dot--excused{--dot:var(--ui-excused)}.att-dot--upcoming{--dot:var(--ui-upcoming)}
.att-stats{margin-top:var(--ui-space-5)}
.att-stats__list{display:flex;flex-direction:column;gap:var(--ui-space-3);margin:0;padding:0;list-style:none}
.att-stat{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-2) var(--ui-space-4);padding:var(--ui-space-3);background:var(--ui-surface);border:1px solid var(--ui-border);border-left:4px solid var(--course-color);border-radius:var(--ui-radius)}
.att-stat__name{flex:1 1 200px;font-weight:700}
.att-stat__rate{flex:1 1 200px}
.att-bar{height:10px;overflow:hidden;background:var(--ui-upcoming-bg);border-radius:999px}
.att-bar__fill{height:100%;background:var(--course-color);transition:width 300ms}
.att-stat__text{margin:2px 0 0;font-size:.85rem;color:var(--ui-text-muted)}
.att-stat__left{flex:1 1 160px;font-size:.9rem}
.att-badge{padding:2px var(--ui-space-3);font-size:.8rem;font-weight:700;color:#fff;border-radius:999px;background:var(--lv)}
.att-badge--safe{--lv:var(--ui-safe)}.att-badge--warning{--lv:var(--ui-warning)}.att-badge--danger{--lv:var(--ui-danger)}
@media (min-width:1024px){.att-stat{display:grid;grid-template-columns:minmax(180px,1.2fr) 2fr minmax(150px,auto) 96px}.att-badge{justify-self:end}}
@media (prefers-reduced-motion:reduce){.att-bar__fill{transition:none}}
`;
document.head.append(style);

// ======================================================================
// RENDER
// ======================================================================

/** Áp bộ lọc môn lên danh sách buổi học (dùng filter). */
const applyFilter = (sessions) =>
  sessions.filter((s) => state.courseFilter === "all" || s.courseId === state.courseFilter);

/** Thứ trong tuần (Thứ Hai..Chủ nhật) của chuỗi ngày "YYYY-MM-DD". */
const dayFullOf = (iso) => DAY_FULL[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7];

/** HTML một thẻ buổi học (cấu trúc theo docs/ui-preview.html).
 *  aria-label đọc đủ ngữ cảnh vì trên lưới, trình đọc màn hình không tự biết thẻ thuộc ngày/ca nào. */
const sessionCardHtml = (s) => {
  const course = COURSE_MAP.get(s.courseId);
  const action = s.status === "upcoming" ? "Chưa diễn ra, chưa thể điểm danh" : "Nhấn Enter để đổi trạng thái";
  const label = `${course.courseName}, ${dayFullOf(s.date)} ${ddmm(s.date)}, ca ${s.shift}, phòng ${s.room}: ${STATUS_LABEL[s.status]}. ${action}`;
  return `
    <button type="button" class="ui-session ui-session--${s.status}" style="--course-color:${esc(course.color)}" data-session-id="${esc(s.sessionId)}" aria-label="${esc(label)}">
      <span class="ui-session__name">${esc(course.courseName)}</span>
      <span class="ui-session__meta">Phòng ${esc(s.room)} · Tiết ${s.periodStart}–${s.periodEnd}</span>
      <span class="ui-session__status">${STATUS_LABEL[s.status]}</span>
    </button>`;
};

/** Dựng lưới tuần: góc, 7 tiêu đề ngày, rồi mỗi ca gồm 1 nhãn ca + 7 ô. */
const renderWeek = () => {
  const { start, end } = getWeekRange(state.viewDate);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(start, i));
  const weekSessions = applyFilter(getSessionsByWeek(state.sessions, state.viewDate));

  const heads = days.map((d, i) => `
    <div class="ui-week__dayhead${d === today ? " ui-week__dayhead--today" : ""}">${DAY_SHORT[i]}<small>${ddmm(d)}</small></div>`);

  const rows = SHIFTS.map((shift) => {
    const [from, to] = SHIFT_PERIODS[shift];
    const cells = days.map((d, i) => {
      const cards = weekSessions.filter((s) => s.date === d && s.shift === shift).map(sessionCardHtml).join("");
      return `<div class="ui-week__cell${d === today ? " ui-week__cell--today" : ""}" style="--day:${i + 1};--shift:${shift}" data-label="${DAY_FULL[i]} ${ddmm(d)} · Ca ${shift} (Tiết ${from}–${to})">${cards}</div>`;
    });
    return `<div class="ui-week__shift">Ca ${shift}<small>Tiết ${from}–${to}</small></div>${cells.join("")}`;
  });

  gridEl.innerHTML = `<div class="ui-week__corner"></div>${heads.join("")}${rows.join("")}`;
  titleEl.textContent = `Tuần ${ddmm(start)} – ${ddmm(end)}/${end.slice(0, 4)}`;
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
    const dots = monthSessions
      .filter((s) => s.date === date)
      .map((s) => `<span class="att-dot att-dot--${s.status}" title="${esc(COURSE_MAP.get(s.courseId).courseName)} — ${STATUS_LABEL[s.status]}"></span>`)
      .join("");
    return `<button type="button" class="att-month__day${date === today ? " att-month__day--today" : ""}" data-date="${date}" aria-label="Ngày ${i + 1}/${month}: ${monthSessions.filter((s) => s.date === date).length} buổi học. Nhấn để xem tuần">
      <span class="att-month__num">${i + 1}</span><span class="att-dots">${dots}</span></button>`;
  });

  monthEl.innerHTML = [...heads, ...empties, ...days].join("");
  titleEl.textContent = `Tháng ${pad(month)}/${year}`;
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

/** Chuyển tuần/tháng: direction = -1 (trước), +1 (sau). */
const handleNavigate = (direction) => {
  state.viewDate = state.mode === "week"
    ? shiftDays(state.viewDate, direction * 7)
    : shiftMonth(state.viewDate, direction);
  renderView();
  animate(state.mode === "week" ? weekWrap : monthEl, direction);
};

/** Đang xem đúng tuần (hoặc tháng) chứa hôm nay chưa? */
const isViewingToday = () =>
  state.mode === "week"
    ? getWeekRange(state.viewDate).start === getWeekRange(today).start
    : state.viewDate.slice(0, 7) === today.slice(0, 7); // so "YYYY-MM"

/** Về hôm nay; hướng trượt phụ thuộc đang ở quá khứ hay tương lai.
 *  Nếu đang xem đúng tuần/tháng hiện tại thì bỏ qua: không vẽ lại, không chạy hiệu ứng. */
const handleToday = () => {
  if (isViewingToday()) return;
  const direction = state.viewDate < today ? 1 : -1;
  state.viewDate = today;
  renderView();
  animate(state.mode === "week" ? weekWrap : monthEl, direction);
};

/** Click vào các nút điều khiển: dùng 1 listener cho cả thanh (event delegation). */
const handleControlsClick = (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;
  if (btn.id === "btn-prev-week") handleNavigate(-1);
  else if (btn.id === "btn-next-week") handleNavigate(1);
  else if (btn.id === "btn-today") handleToday();
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
 * - Buổi "upcoming": chưa thể điểm danh -> báo toast.
 * - Buổi đã diễn ra: đổi trạng thái bằng nextStatus(), lưu, vẽ lại đúng thẻ đó + bảng thống kê.
 */
const handleSessionClick = (event) => {
  const card = event.target.closest(".ui-session");
  if (!card) return;

  const session = state.sessions.find((s) => s.sessionId === card.dataset.sessionId);
  if (!session) return;

  if (session.status === "upcoming") {
    showToast("warning", "Chưa thể điểm danh", "Buổi học này chưa diễn ra nên không thể đánh dấu.");
    return;
  }

  const updated = { ...session, status: nextStatus(session.status) };
  state.sessions = state.sessions.map((s) => (s.sessionId === updated.sessionId ? updated : s));
  saveSessions(state.sessions);

  card.outerHTML = sessionCardHtml(updated).trim();
  gridEl.querySelector(`[data-session-id="${updated.sessionId}"]`)?.focus(); // giữ focus cho người dùng bàn phím

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


// ---------- Gắn sự kiện (mỗi vùng chỉ 1 listener) ----------
controlsEl.addEventListener("click", handleControlsClick);
$("btn-mode").addEventListener("click", handleToggleMode);
$("course-filter").addEventListener("change", handleFilterChange);
gridEl.addEventListener("click", handleSessionClick);
monthEl.addEventListener("click", handleMonthClick);

// ---------- Khởi động ----------
renderView();
getAllCourseStats(state.sessions, COURSES, loadSettings(), today).forEach((st) => {
  state.levels.set(st.courseId, st.level);                // ghi nhận mức ban đầu, không báo khi mới tải trang
  if (st.level === "danger") state.alerted.add(st.courseId);
});
renderStats();
