// nav.js — Hành vi dùng chung của thanh điều hướng (sidebar / thanh dưới trên mobile).
// Được import bởi dashboard.js, schedule.js, profile.js.

const nav = document.querySelector(".ui-nav");

/**
 * Bấm vào mục của trang đang mở (aria-current="page") thì không làm gì,
 * tránh tải lại trang và mất trạng thái đang xem (tuần, bộ lọc...).
 * Dùng event delegation: 1 listener cho cả menu. Áp dụng cả chuột lẫn phím Enter.
 */
const handleNavClick = (event) => {
  if (event.target.closest('[aria-current="page"]')) event.preventDefault();
};

nav?.addEventListener("click", handleNavClick);
