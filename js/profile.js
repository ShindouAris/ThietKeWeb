// profile.js — Trang Hồ sơ & Cài đặt (profile.html).
// Form HTML5 + kiểm tra bằng Regex (khi blur và khi submit), lưu qua storage.js.
import { setLeaveGuard } from "./nav.js"; // sidebar: không tải lại trang hiện tại; hỏi trước khi rời nếu chưa lưu
import { showToast, confirmDialog } from "./ui.js"; // toast + hộp xác nhận của trang
import {
  loadProfile, saveProfile,
  loadSettings, saveSettings,
  resetAll,
} from "./storage.js";

// ---------- Quy tắc kiểm tra ----------
// Mỗi trường: regex + thông báo lỗi tiếng Việt
const RULES = {
  studentId: { regex: /^\d{8}$/, message: "MSSV gồm đúng 8 chữ số." },
  fullName: {
    regex: /^\p{L}+(?:[\s.'-]+\p{L}+)+$/u,
    message: "Nhập đầy đủ họ và tên (ít nhất 2 từ, chỉ gồm chữ cái).",
  },
  email: {
    regex: /^[A-Za-z0-9._%+-]+@lhu\.edu\.vn$/i,
    message: "Email phải kết thúc bằng @lhu.edu.vn.",
  },
  phone: {
    regex: /^0(3|5|7|8|9)\d{8}$/,
    message: "SĐT gồm 10 số, bắt đầu 03, 05, 07, 08 hoặc 09.",
  },
  className: {
    regex: /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,19}$/,
    message: "Lớp gồm 2–20 ký tự (chữ, số, dấu - _ .).",
  },
};
const FIELDS = Object.keys(RULES);
const EMPTY_MESSAGE = "Vui lòng nhập thông tin này.";

/** Trả về thông báo lỗi của một ô ("" nếu hợp lệ). */
const validateValue = (name, value) => {
  const v = value.trim();
  if (v === "") return EMPTY_MESSAGE;
  return RULES[name].regex.test(v) ? "" : RULES[name].message;
};

// Chống chèn HTML khi in dữ liệu người dùng vào innerHTML
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Dựng giao diện ----------
const formHost = document.getElementById("profile-form");
const resetHost = document.getElementById("settings-form");

// Dựng một ô nhập: nhãn + input + chỗ hiện lỗi
const fieldHtml = ({ name, label, type = "text", extra = "" }) => `
  <div class="pf-field">
    <label class="pf-label" for="pf-${name}">${label}</label>
    <input class="pf-input" id="pf-${name}" name="${name}" type="${type}" ${extra}
           required aria-describedby="pf-err-${name}">
    <p class="pf-error" id="pf-err-${name}" role="alert"></p>
  </div>`;

formHost.innerHTML = `
  <div class="pf-summary" id="pf-summary" aria-live="polite"></div>
  <form class="pf-form" id="pf-form" novalidate>
    <fieldset class="pf-fieldset pf-fieldset--info">
      <legend>Thông tin sinh viên</legend>
      ${fieldHtml({ name: "studentId", label: "Mã số sinh viên (8 số)", extra: 'inputmode="numeric" maxlength="8" pattern="\\d{8}" autocomplete="off"' })}
      ${fieldHtml({ name: "fullName", label: "Họ và tên", extra: 'maxlength="60" autocomplete="name"' })}
      ${fieldHtml({ name: "email", label: "Email (@lhu.edu.vn)", type: "email", extra: 'autocomplete="email"' })}
      ${fieldHtml({ name: "phone", label: "Số điện thoại", type: "tel", extra: 'inputmode="tel" maxlength="10" pattern="0[35789]\\d{8}" autocomplete="tel"' })}
      ${fieldHtml({ name: "className", label: "Lớp", extra: 'maxlength="20"' })}
    </fieldset>

    <fieldset class="pf-fieldset pf-fieldset--settings">
      <legend>Cài đặt chuyên cần</legend>
      <div class="pf-field">
        <label class="pf-label" for="pf-limit">
          Giới hạn nghỉ tối đa: <output id="pf-limit-out" for="pf-limit">20%</output>
        </label>
        <input class="pf-range" id="pf-limit" name="limit" type="range" min="10" max="30" step="1" value="20">
        <p class="pf-hint">Nghỉ vượt mức này thì môn chuyển sang "Nguy hiểm". Mức "Cảnh báo" tự tính bằng 75% giới hạn (<span id="pf-warn-out">20% → 15%</span>).</p>
      </div>
      <label class="pf-check">
        <input type="checkbox" id="pf-notify" name="notifyEnabled"> Bật thông báo nhắc nhở chuyên cần
      </label>
    </fieldset>

    <div class="pf-actions" id="pf-actions">
      <button type="submit" class="ui-btn ui-btn--primary pf-save" id="pf-save">Lưu thay đổi</button>
      <p class="pf-unsaved" id="pf-unsaved" role="status" hidden>
        <span class="pf-unsaved__text">⚠ Bạn có thay đổi chưa được lưu.</span>
        <button type="button" class="ui-btn" id="pf-discard">Hủy thay đổi</button>
      </p>
      <p class="pf-status" id="pf-status" role="status"></p>
    </div>
  </form>`;

resetHost.innerHTML = `
  <div class="pf-danger-zone">
    <h3>Dữ liệu</h3>
    <p>Đưa hồ sơ, cài đặt và toàn bộ điểm danh về dữ liệu mẫu ban đầu.</p>
    <button type="button" class="ui-btn pf-reset" id="pf-reset">Khôi phục dữ liệu mẫu</button>
  </div>`;

// ---------- Tham chiếu DOM ----------
const form = document.getElementById("pf-form");
const saveBtn = document.getElementById("pf-save");
const statusEl = document.getElementById("pf-status");
const summaryEl = document.getElementById("pf-summary");
const limitInput = document.getElementById("pf-limit");
const limitOut = document.getElementById("pf-limit-out");
const notifyInput = document.getElementById("pf-notify");
const inputOf = (name) => document.getElementById(`pf-${name}`);
const actionsEl = document.getElementById("pf-actions");
const unsavedEl = document.getElementById("pf-unsaved");

/** Hiện giá trị thanh giới hạn và mức "Cảnh báo" tương ứng (= 75%, cùng công thức lúc lưu). */
const showLimit = (value) => {
  const limit = Number(value);
  limitOut.textContent = `${limit}%`;
  document.getElementById("pf-warn-out").textContent = `${limit}% → ${Math.round(limit * 0.75)}%`;
};

// ---------- Theo dõi thay đổi chưa lưu ----------

/** Chụp giá trị hiện tại của form thành 1 chuỗi để so sánh nhanh. */
const formSnapshot = () => JSON.stringify([
  ...FIELDS.map((name) => inputOf(name).value.trim()),
  limitInput.value,
  notifyInput.checked,
]);

let savedSnapshot = ""; // giá trị form ngay sau lần nạp / lưu gần nhất

/** Form có khác dữ liệu đã lưu không? (sửa rồi gõ lại như cũ thì coi như không đổi) */
const isDirty = () => formSnapshot() !== savedSnapshot;

/** Hiện / ẩn cảnh báo "chưa lưu"; khi có thay đổi thì thanh nút Lưu dính ở đáy màn hình. */
const updateUnsavedNotice = () => {
  const dirty = isDirty();
  unsavedEl.hidden = !dirty;
  actionsEl.classList.toggle("pf-actions--dirty", dirty);
};

/** Ghi nhận trạng thái hiện tại của form là "đã lưu". */
const markSaved = () => {
  savedSnapshot = formSnapshot();
  updateUnsavedNotice();
};

// ---------- Hiển thị / kiểm tra ----------

/** Hiện (hoặc xoá) lỗi đỏ dưới một ô. Trả về true nếu ô hợp lệ. */
const showFieldError = (name) => {
  const message = validateValue(name, inputOf(name).value);
  document.getElementById(`pf-err-${name}`).textContent = message;
  inputOf(name).setAttribute("aria-invalid", message ? "true" : "false");
  return message === "";
};

/** Cả form hợp lệ chưa? (không hiện lỗi, chỉ để bật/tắt nút Lưu) */
const isFormValid = () => FIELDS.every((name) => validateValue(name, inputOf(name).value) === "");

/** Nút Lưu chỉ bấm được khi mọi ô hợp lệ. */
const updateSaveButton = () => {
  saveBtn.disabled = !isFormValid();
};

/** Khung tóm tắt hồ sơ ở đầu trang (cập nhật ngay sau khi lưu). */
const renderSummary = (profile) => {
  summaryEl.innerHTML = `
    <h3 class="pf-summary__name">${esc(profile.fullName)}</h3>
    <p class="pf-summary__line">MSSV ${esc(profile.studentId)} · Lớp ${esc(profile.className)}</p>
    <p class="pf-summary__line">${esc(profile.email)} · ${esc(profile.phone)}</p>`;
};

/** Đổ dữ liệu đã lưu vào form. Ô đang sai (VD dữ liệu mẫu cũ) hiện lỗi ngay để người dùng sửa. */
const fillForm = () => {
  const profile = loadProfile();
  const settings = loadSettings();
  FIELDS.forEach((name) => {
    inputOf(name).value = profile[name] ?? "";
    const hasValue = inputOf(name).value.trim() !== "";
    if (hasValue) showFieldError(name);
    else {
      document.getElementById(`pf-err-${name}`).textContent = "";
      inputOf(name).setAttribute("aria-invalid", "false");
    }
  });
  limitInput.value = Math.round(settings.absenceLimit * 100);
  showLimit(limitInput.value);
  notifyInput.checked = Boolean(settings.notifyEnabled);
  renderSummary(profile);
  updateSaveButton();
  markSaved();
};

// ---------- Xử lý sự kiện ----------

/** Rời khỏi ô (blur): kiểm tra và hiện lỗi cho ô đó. */
const handleBlur = (event) => {
  const name = event.target.name;
  if (FIELDS.includes(name)) showFieldError(name);
};

/** Đang gõ: xoá lỗi nếu đã sửa đúng, rồi bật/tắt nút Lưu. Kéo thanh range thì cập nhật số %. */
const handleInput = (event) => {
  const { name } = event.target;
  if (FIELDS.includes(name) && validateValue(name, event.target.value) === "") showFieldError(name);
  if (name === "limit") showLimit(event.target.value);
  statusEl.textContent = "";
  updateSaveButton();
  updateUnsavedNotice();
};

/** Bấm Lưu (hoặc Enter): kiểm tra lại toàn bộ; hợp lệ thì lưu vào storage. */
const handleSubmit = (event) => {
  event.preventDefault();
  const results = FIELDS.map((name) => ({ name, ok: showFieldError(name) }));
  const firstBad = results.find((r) => !r.ok);
  if (firstBad) {
    inputOf(firstBad.name).focus();
    statusEl.textContent = "";
    return;
  }

  const profile = Object.fromEntries(FIELDS.map((name) => [name, inputOf(name).value.trim()]));
  const limit = Number(limitInput.value);
  saveProfile(profile);
  saveSettings({
    ...loadSettings(),
    absenceLimit: limit / 100,
    warningAt: Math.round(limit * 0.75) / 100, // mức cảnh báo luôn thấp hơn giới hạn
    notifyEnabled: notifyInput.checked,
  });

  renderSummary(profile);
  markSaved();
  statusEl.textContent = "Đã lưu thay đổi.";
};

/** Bấm "Hủy thay đổi": đưa form về dữ liệu đã lưu. */
const handleDiscard = () => {
  fillForm();
  statusEl.textContent = "";
  showToast("safe", "Đã hủy các thay đổi chưa lưu");
};

/** Khôi phục dữ liệu mẫu: hỏi xác nhận bằng hộp thoại của trang (không dùng confirm() của trình duyệt). */
const handleReset = async () => {
  const ok = await confirmDialog({
    title: "Khôi phục dữ liệu mẫu?",
    message: "Hồ sơ, cài đặt và toàn bộ điểm danh sẽ trở về ban đầu. Thao tác này không hoàn tác được.",
    confirmText: "Khôi phục",
    cancelText: "Hủy",
    danger: true,
  });
  if (!ok) return;
  resetAll();
  fillForm();
  statusEl.textContent = "";
  showToast("safe", "Đã khôi phục dữ liệu mẫu", "Hồ sơ, cài đặt và điểm danh đã về ban đầu.");
};

// ---------- Gắn sự kiện ----------
form.addEventListener("blur", handleBlur, true); // blur không nổi bọt nên dùng pha capture để ủy quyền
form.addEventListener("input", handleInput);
form.addEventListener("submit", handleSubmit);
document.getElementById("pf-reset").addEventListener("click", handleReset);
document.getElementById("pf-discard").addEventListener("click", handleDiscard);
setLeaveGuard(isDirty); // menu hỏi trước khi rời trang nếu còn thay đổi chưa lưu

// ---------- Khởi động ----------
fillForm();
