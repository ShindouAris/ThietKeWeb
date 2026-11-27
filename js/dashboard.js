// dashboard.js — Trang Tổng quan (index.html).
// Lấy dữ liệu từ storage.js, tính toán bằng logic.js, chỉ lo việc dựng giao diện.
import "./nav.js"; // sidebar: bấm trang đang mở thì không tải lại
import { COURSES } from "./data.js";
import { loadSessions, loadProfile, loadSettings } from "./storage.js";
import { getOverallStats, getUpcomingSessions } from "./logic.js";

// index.html chỉ nạp styles.css; style của widget (.pf-) nằm trong profile.css nên nạp thêm ở đây
const cssLink = document.createElement("link");
cssLink.rel = "stylesheet";
cssLink.href = "css/profile.css";
document.head.append(cssLink);

// ---------- Hằng số & hàm hiển thị ----------
const DAY_FULL = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]; // theo getDay()
const STATUS_LABEL = { present: "Có mặt", absent: "Vắng", excused: "Có phép", upcoming: "Sắp tới" };
const LEVEL_LABEL = { safe: "An toàn", warning: "Cảnh báo", danger: "Nguy hiểm" };
const SHIFT_PERIODS = { 1: "1–3", 2: "4–6", 3: "7–9", 4: "10–12" };
const COURSE_MAP = new Map(COURSES.map((c) => [c.courseId, c]));

const pad = (n) => String(n).padStart(2, "0");
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayName = (iso) => DAY_FULL[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const pct = (rate) => `${(rate * 100).toFixed(1).replace(".", ",")}%`;
// Chống chèn HTML khi đưa chuỗi người dùng nhập (họ tên...) vào innerHTML
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Lời chào theo giờ trong ngày. */
const greetingByHour = (hour) => (hour < 11 ? "Chào buổi sáng" : hour < 13 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối");

// ---------- Các khối giao diện ----------

/** Một dòng buổi học trong widget. `withDate` = true thì hiện thêm thứ + ngày. */
const sessionItemHtml = (s, withDate) => {
  const course = COURSE_MAP.get(s.courseId);
  const when = withDate ? `${dayName(s.date)} ${ddmm(s.date)} · ` : "";
  return `
    <li class="pf-session" style="--course-color:${esc(course.color)}">
      <span class="pf-session__time">${when}Ca ${s.shift} · Tiết ${SHIFT_PERIODS[s.shift]}</span>
      <span class="pf-session__name">${esc(course.courseName)}</span>
      <span class="pf-session__meta">Phòng ${esc(s.room)} · ${STATUS_LABEL[s.status]}</span>
    </li>`;
};

/** Một môn trong danh sách: progress bar % chuyên cần, nhãn mức, banner nếu danger. */
const courseItemHtml = (st, settings) => {
  const left = st.remaining;
  const banner = st.level === "danger" && settings.notifyEnabled
    ? `<div class="pf-banner" role="alert">
         <strong>Nguy cơ cấm thi!</strong> Bạn đã nghỉ ${st.absent + st.excused}/${st.total} buổi (${pct(st.absentRate)}),
         vượt giới hạn ${Math.round(settings.absenceLimit * 100)}%. Hãy đi học đầy đủ các buổi còn lại.
       </div>`
    : "";
  return `
    <li class="pf-course pf-course--${st.level}" style="--course-color:${esc(st.course.color)}">
      <div class="pf-course__head">
        <span class="pf-course__name">${esc(st.course.courseName)}</span>
        <span class="pf-badge pf-badge--${st.level}">${LEVEL_LABEL[st.level]}</span>
      </div>
      <p class="pf-course__meta">${esc(st.course.lecturer)} · Phòng ${esc(st.course.room)}</p>
      <div class="pf-bar" role="progressbar" aria-label="Chuyên cần ${esc(st.course.courseName)}"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(st.attendRate * 100)}">
        <div class="pf-bar__fill" style="width:${st.attendRate * 100}%"></div>
      </div>
      <p class="pf-course__text">
        Chuyên cần <strong>${pct(st.attendRate)}</strong> (${st.attended}/${st.held} buổi) ·
        Nghỉ ${st.absent + st.excused}/${st.total} · Còn được nghỉ <strong>${left}</strong> buổi
      </p>
      ${banner}
    </li>`;
};

// ---------- Dựng trang ----------
const render = () => {
  const today = toIso(new Date());
  const sessions = loadSessions();
  const settings = loadSettings();
  const profile = loadProfile();

  const overall = getOverallStats(sessions, COURSES, settings, today);
  const todaySessions = sessions
    .filter((s) => s.date === today)
    .sort((a, b) => a.shift - b.shift);
  // Buổi sắp tới tính từ ngày mai để không trùng với widget "Hôm nay"
  const upcoming = getUpcomingSessions(sessions, addDays(today, 1), 3);

  // 1) Lời chào
  const main = document.querySelector(".ui-main");
  let greetEl = document.getElementById("pf-greeting");
  if (!greetEl) {
    greetEl = document.createElement("p");
    greetEl.id = "pf-greeting";
    greetEl.className = "pf-greeting";
    main.querySelector("h2").after(greetEl);
  }
  greetEl.innerHTML = `${greetingByHour(new Date().getHours())}, <strong>${esc(profile.fullName)}</strong>!
    <span class="pf-greeting__date">${dayName(today)}, ${ddmm(today)}/${today.slice(0, 4)}</span>`;

  // 2) Widget (CSS Grid)
  let widgetsEl = document.getElementById("pf-widgets");
  if (!widgetsEl) {
    widgetsEl = document.createElement("section");
    widgetsEl.id = "pf-widgets";
    widgetsEl.className = "pf-widgets";
    widgetsEl.setAttribute("aria-label", "Tổng quan nhanh");
    greetEl.after(widgetsEl);
  }
  widgetsEl.innerHTML = `
    <article class="pf-widget">
      <h3 class="pf-widget__title">Tỷ lệ đi học chung</h3>
      <p class="pf-widget__big">${pct(overall.attendRate)}</p>
      <p class="pf-widget__sub">${overall.attended}/${overall.held} buổi đã diễn ra</p>
    </article>
    <article class="pf-widget">
      <h3 class="pf-widget__title">Môn cần chú ý</h3>
      <p class="pf-widget__pair">
        <span class="pf-count pf-count--warning"><strong>${overall.levelCounts.warning}</strong> cảnh báo</span>
        <span class="pf-count pf-count--danger"><strong>${overall.levelCounts.danger}</strong> nguy hiểm</span>
      </p>
      <p class="pf-widget__sub">trên tổng ${overall.courseCount} môn</p>
    </article>
    <article class="pf-widget pf-widget--today">
      <h3 class="pf-widget__title">Buổi học hôm nay</h3>
      ${todaySessions.length
        ? `<ul class="pf-list">${todaySessions.map((s) => sessionItemHtml(s, false)).join("")}</ul>`
        : `<p class="pf-empty">Hôm nay không có lịch học.</p>`}
    </article>
    <article class="pf-widget pf-widget--wide">
      <h3 class="pf-widget__title">3 buổi sắp tới</h3>
      ${upcoming.length
        ? `<ul class="pf-list pf-list--row">${upcoming.map((s) => sessionItemHtml(s, true)).join("")}</ul>`
        : `<p class="pf-empty">Không còn buổi học nào sắp tới.</p>`}
    </article>`;

  // 3) Danh sách môn (khung #course-cards có sẵn trong index.html).
  //    Môn "danger" đưa lên đầu (thẻ chiếm cả hàng, có banner); các môn khác giữ thứ tự gốc.
  const orderedStats = [
    ...overall.courseStats.filter((st) => st.level === "danger"),
    ...overall.courseStats.filter((st) => st.level !== "danger"),
  ];
  document.getElementById("course-cards").innerHTML = `
    <h3>Chuyên cần theo môn</h3>
    <ul class="pf-courses">${orderedStats.map((st) => courseItemHtml(st, settings)).join("")}</ul>`;
};

render();
