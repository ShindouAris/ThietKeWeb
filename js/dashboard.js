// dashboard.js — Trang Tổng quan (index.html).
// Lấy dữ liệu từ storage.js, tính toán bằng logic.js, định dạng bằng utils.js; chỉ lo dựng giao diện.
// Style (.pf-) nằm trong css/profile.css.
import "./nav.js"; // sidebar: bấm trang đang mở thì không tải lại
import { COURSES } from "./data.js";
import { loadSessions, loadProfile, loadSettings } from "./storage.js";
import { getOverallStats, getUpcomingSessions } from "./logic.js";
import { todayIso, addDays, ddmm, ddmmyyyy, pct, esc, dayName, SHIFT_PERIODS, STATUS_LABEL, LEVEL_LABEL } from "./utils.js";

const COURSE_MAP = new Map(COURSES.map((c) => [c.courseId, c]));

/** Lời chào theo giờ trong ngày. */
const greetingByHour = (hour) => (hour < 11 ? "Chào buổi sáng" : hour < 13 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối");

/** Lấy phần tử theo id; chưa có thì tạo mới và chèn ngay sau `afterEl`. */
const ensureEl = (id, tag, className, afterEl) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement(tag);
    el.id = id;
    el.className = className;
    afterEl.after(el);
  }
  return el;
};

// ---------- Các khối giao diện ----------

/** Một dòng buổi học trong widget. `withDate` = true thì hiện thêm thứ + ngày. */
const sessionItemHtml = (s, withDate) => {
  const course = COURSE_MAP.get(s.courseId);
  const [from, to] = SHIFT_PERIODS[s.shift];
  const when = withDate ? `${dayName(s.date)} ${ddmm(s.date)} · ` : "";
  return `
    <li class="pf-session" style="--course-color:${esc(course.color)}">
      <span class="pf-session__time">${when}Ca ${s.shift} · Tiết ${from}–${to}</span>
      <span class="pf-session__name">${esc(course.courseName)}</span>
      <span class="pf-session__meta">Phòng ${esc(s.room)} · ${STATUS_LABEL[s.status]}</span>
    </li>`;
};

/** Vòng tròn tỷ lệ đi học (vẽ bằng conic-gradient trong CSS, --p = phần trăm). */
const ringHtml = (rate, label) => `
  <div class="pf-ring" style="--p:${(rate * 100).toFixed(1)}" role="img" aria-label="${esc(label)}">
    <span class="pf-ring__value">${pct(rate)}</span>
  </div>`;

/** Một môn trong danh sách: progress bar % chuyên cần, nhãn mức, banner nếu danger. */
const courseItemHtml = (st, settings) => {
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
        Nghỉ ${st.absent + st.excused}/${st.total} · Còn được nghỉ <strong>${st.remaining}</strong> buổi
      </p>
      ${banner}
    </li>`;
};

// ---------- Dựng trang ----------
const render = () => {
  const today = todayIso();
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
  const heading = document.querySelector(".ui-main h2");
  const greetEl = ensureEl("pf-greeting", "p", "pf-greeting", heading);
  greetEl.innerHTML = `${greetingByHour(new Date().getHours())}, <strong>${esc(profile.fullName)}</strong>!
    <span class="pf-greeting__date">${dayName(today)}, ${ddmmyyyy(today)}</span>`;

  // 2) Nhắc buổi chưa điểm danh (khung #alerts có sẵn trong index.html)
  const alertsEl = document.getElementById("alerts");
  const unmarked = overall.unmarked;
  alertsEl.innerHTML = unmarked.length
    ? `<div class="pf-notice" role="status">
         <span>Bạn có <strong>${unmarked.length}</strong> buổi đã qua nhưng chưa điểm danh
           (sớm nhất: ${dayName(unmarked[0].date)} ${ddmm(unmarked[0].date)}).</span>
         <a class="ui-btn" href="schedule.html">Điểm danh ngay</a>
       </div>`
    : "";

  // 3) Widget (CSS Grid), đặt sau khung nhắc nhở
  const widgetsEl = ensureEl("pf-widgets", "section", "pf-widgets", alertsEl); // thứ tự: lời chào → nhắc nhở → widget
  widgetsEl.setAttribute("aria-label", "Tổng quan nhanh");
  widgetsEl.innerHTML = `
    <article class="pf-widget pf-widget--rate">
      <h3 class="pf-widget__title">Tỷ lệ đi học chung</h3>
      <div class="pf-widget__row">
        ${ringHtml(overall.attendRate, `Tỷ lệ đi học chung ${pct(overall.attendRate)}`)}
        <p class="pf-widget__sub">${overall.attended}/${overall.held} buổi<br>đã diễn ra</p>
      </div>
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

  // 4) Danh sách môn (khung #course-cards có sẵn trong index.html).
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
