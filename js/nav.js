// nav.js — Hành vi dùng chung của thanh điều hướng (sidebar / thanh dưới trên mobile).
// Được import bởi dashboard.js, schedule.js, profile.js.
import { confirmDialog } from "./ui.js";

const nav = document.querySelector(".ui-nav");

// Hàm do trang đăng ký: trả về true nếu trang còn thay đổi chưa lưu (VD form Hồ sơ).
let hasUnsavedChanges = () => false;

/**
 * Trang gọi hàm này để menu biết khi nào cần hỏi trước khi rời trang.
 * @param {() => boolean} check Hàm trả về true nếu còn thay đổi chưa lưu.
 */
export const setLeaveGuard = (check) => {
  hasUnsavedChanges = check;
};

/**
 * Click vào menu (event delegation: 1 listener cho cả menu, áp dụng cả chuột lẫn phím Enter).
 * - Mục của trang đang mở (aria-current="page"): không làm gì, tránh tải lại trang.
 * - Mục trang khác khi còn thay đổi chưa lưu: hỏi bằng hộp thoại của trang trước khi rời đi.
 */
const handleNavClick = async (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  if (link.matches('[aria-current="page"]')) {
    event.preventDefault();
    return;
  }
  if (!hasUnsavedChanges()) return; // không có gì chưa lưu: chuyển trang bình thường

  event.preventDefault();
  const leave = await confirmDialog({
    title: "Rời trang khi chưa lưu?",
    message: "Bạn có thay đổi chưa được lưu. Nếu rời trang bây giờ, các thay đổi này sẽ mất.",
    confirmText: "Rời trang",
    cancelText: "Ở lại",
    danger: true,
  });
  if (leave) window.location.href = link.href;
};

nav?.addEventListener("click", handleNavClick);
