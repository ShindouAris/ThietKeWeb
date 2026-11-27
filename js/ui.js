// ui.js — Thành phần giao diện dùng chung: toast và hộp xác nhận của chính trang web.
// Thay cho alert() / confirm() / prompt() của trình duyệt (không tùy biến được giao diện,
// chặn cả trang và trông khác nhau giữa các trình duyệt).
// Style nằm trong styles.css (.ui-toast, .ui-dialog).

const TOAST_MS = 5000;     // toast tự ẩn sau 5 giây
const TOAST_HIDE_MS = 250; // khớp với transition của .ui-toast--hide

import { esc } from "./utils.js"; // chống chèn HTML khi đưa chuỗi vào innerHTML

// ======================================================================
// TOAST
// ======================================================================

/** Lấy vùng chứa toast (#toast-stack có sẵn trong HTML); thiếu thì tự tạo để hàm luôn chạy được. */
const getStack = () => {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    stack.className = "ui-toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.append(stack);
  }
  return stack;
};

/** Ẩn toast có hiệu ứng rồi xoá khỏi DOM. */
const dismissToast = (toast) => {
  if (!toast || toast.classList.contains("ui-toast--hide")) return;
  toast.classList.add("ui-toast--hide");
  setTimeout(() => toast.remove(), TOAST_HIDE_MS);
};

/**
 * Hiện toast ở góc trên phải. Toast trùng nội dung đang hiện thì bỏ qua (tránh spam khi bấm liên tục).
 * @param {"safe"|"warning"|"danger"} kind Màu của toast.
 * @param {string} title Dòng tiêu đề (in đậm).
 * @param {string} [text] Nội dung phụ.
 */
export const showToast = (kind, title, text = "") => {
  const stack = getStack();
  const key = `${title}|${text}`;
  if ([...stack.children].some((t) => t.dataset.key === key)) return;

  const toast = document.createElement("div");
  toast.className = `ui-toast ui-toast--${kind}`;
  toast.dataset.key = key;
  toast.innerHTML = `
    <div class="ui-toast__body">
      <p class="ui-toast__title">${esc(title)}</p>
      ${text ? `<p class="ui-toast__text">${esc(text)}</p>` : ""}
    </div>
    <button type="button" class="ui-toast__close" aria-label="Đóng thông báo">&times;</button>`;
  stack.append(toast);
  setTimeout(() => dismissToast(toast), TOAST_MS);
};

/** Bấm nút × trên bất kỳ toast nào: 1 listener cho cả trang (event delegation). */
const handleToastClose = (event) => {
  const btn = event.target.closest(".ui-toast__close");
  if (btn) dismissToast(btn.closest(".ui-toast"));
};
document.addEventListener("click", handleToastClose);

// ======================================================================
// HỘP XÁC NHẬN (dùng thẻ <dialog> của HTML5)
// showModal() tự lo: làm mờ nền, giữ focus bên trong hộp, phím Esc để đóng,
// và trả focus về nút đã mở hộp khi đóng.
// ======================================================================

let dialogEl = null; // tạo 1 lần, dùng lại cho mọi lần hỏi

/** Dựng thẻ <dialog> lần đầu cần dùng. */
const getDialog = () => {
  if (dialogEl) return dialogEl;
  dialogEl = document.createElement("dialog");
  dialogEl.className = "ui-dialog";
  dialogEl.setAttribute("aria-labelledby", "ui-dialog-title");
  dialogEl.setAttribute("aria-describedby", "ui-dialog-message");
  dialogEl.innerHTML = `
    <form method="dialog" class="ui-dialog__box">
      <h2 class="ui-dialog__title" id="ui-dialog-title"></h2>
      <p class="ui-dialog__message" id="ui-dialog-message"></p>
      <div class="ui-dialog__actions">
        <button type="submit" class="ui-btn" value="cancel" data-role="cancel"></button>
        <button type="submit" class="ui-btn ui-btn--primary" value="ok" data-role="ok"></button>
      </div>
    </form>`;
  // Bấm ra vùng nền mờ bên ngoài hộp = Hủy
  dialogEl.addEventListener("click", (event) => {
    if (event.target === dialogEl) dialogEl.close("cancel");
  });
  document.body.append(dialogEl);
  return dialogEl;
};

/**
 * Hỏi xác nhận bằng hộp thoại của trang (thay cho window.confirm).
 * Dùng với await: const ok = await confirmDialog({...}); if (!ok) return;
 * @param {Object} options
 * @param {string} options.title Câu hỏi chính.
 * @param {string} [options.message] Giải thích thêm (hậu quả của thao tác).
 * @param {string} [options.confirmText="Đồng ý"] Chữ trên nút xác nhận.
 * @param {string} [options.cancelText="Hủy"] Chữ trên nút hủy.
 * @param {boolean} [options.danger=false] true = nút xác nhận màu đỏ (thao tác không hoàn tác được).
 * @returns {Promise<boolean>} true nếu người dùng bấm xác nhận; false nếu Hủy, Esc hoặc bấm ra ngoài.
 */
export const confirmDialog = ({ title, message = "", confirmText = "Đồng ý", cancelText = "Hủy", danger = false }) => {
  const dialog = getDialog();
  dialog.querySelector(".ui-dialog__title").textContent = title;
  dialog.querySelector(".ui-dialog__message").textContent = message;
  const okBtn = dialog.querySelector('[data-role="ok"]');
  const cancelBtn = dialog.querySelector('[data-role="cancel"]');
  okBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;
  okBtn.classList.toggle("ui-btn--danger", danger);

  return new Promise((resolve) => {
    // returnValue = value của nút submit đã bấm; Esc / bấm ngoài để lại "cancel"
    dialog.returnValue = "cancel";
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
    dialog.showModal();
    // Thao tác nguy hiểm: focus sẵn vào nút Hủy để lỡ bấm Enter cũng không mất dữ liệu
    (danger ? cancelBtn : okBtn).focus();
  });
};
