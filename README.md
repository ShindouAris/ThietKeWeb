# LHU Attendance Tracker

Đồ án môn Thiết kế Web (111101) — Đại học Lạc Hồng.

## Mô tả

Web tĩnh quản lý Thời khóa biểu & Chuyên cần cho sinh viên: xem lịch tuần/tháng, đánh dấu
có mặt / vắng / có phép, theo dõi tỷ lệ nghỉ từng môn và nhận cảnh báo khi sắp vượt giới hạn.
Chỉ dùng HTML5, CSS3, JavaScript thuần (ES Modules); dữ liệu người dùng lưu bằng localStorage.

| Trang | Nội dung |
|---|---|
| `index.html` | Tổng quan: tỷ lệ đi học, số môn cảnh báo, buổi hôm nay, 3 buổi sắp tới, chuyên cần từng môn |
| `schedule.html` | Thời khóa biểu tuần/tháng, điểm danh bằng click hoặc bàn phím, lọc theo môn, thống kê |
| `profile.html` | Hồ sơ sinh viên (validate Regex), giới hạn nghỉ, bật/tắt nhắc nhở, khôi phục dữ liệu mẫu |

## Link demo

<!-- Thay <tên-tài-khoản> và <tên-repo> sau khi bật GitHub Pages -->
https://<tên-tài-khoản>.github.io/<tên-repo>/

Bật GitHub Pages: vào repo trên GitHub → **Settings → Pages** → mục *Build and deployment* chọn
**Deploy from a branch**, branch `main`, thư mục `/ (root)` → **Save**. Sau 1–2 phút link ở trên sẽ hoạt động.
Dự án không có bước build nên đẩy code lên là chạy được.

## Chạy thử trên máy

ES Modules không chạy khi mở file trực tiếp (`file://`), cần một server tĩnh. Chọn một trong hai cách:

**Cách 1 — dòng lệnh (cần Node.js):**

```
npx serve .
```

Mở địa chỉ hiện ra (thường là http://localhost:3000).

**Cách 2 — VS Code:** cài extension *Live Server*, chuột phải `index.html` → **Open with Live Server**
(thường là http://127.0.0.1:5500).

Trang phụ để kiểm tra:

- `docs/ui-preview.html` — giao diện với dữ liệu giả, không cần JS.
- `docs/logic-test.html` — 64 ca kiểm thử cho `js/logic.js`, kết quả hiện trên trang và trong Console.

Muốn quay về dữ liệu ban đầu: trang **Hồ sơ & Cài đặt → Khôi phục dữ liệu mẫu**.

## Cấu trúc

```
index.html  schedule.html  profile.html
assets/   logo
css/      styles.css (biến, layout, toast) · schedule.css (lưới lịch) · profile.css (dashboard + hồ sơ)
js/       data.js · storage.js · logic.js · nav.js · schedule.js · dashboard.js · profile.js
docs/     ui-preview.html · logic-test.html
```

## Prompt nổi bật

Toàn bộ prompt nằm trong [prompt_log.md](prompt_log.md). Năm prompt tiêu biểu:

1. **Khởi tạo dự án (dòng 1).** Một prompt dựng toàn bộ khung: cấu trúc thư mục, 3 trang HTML semantic,
   dữ liệu mẫu 75 buổi có sẵn môn warning/danger để demo, và lớp lưu trữ localStorage.
2. **Lưới lịch responsive (dòng 2).** Cùng một HTML hiển thị thành lưới 7 cột trên desktop và danh sách
   theo ngày trên mobile, chỉ đổi CSS (Grid → Flexbox, `order` tính từ biến CSS).
3. **Logic thuần + kiểm thử (dòng 3).** Tách toàn bộ phép tính khỏi giao diện thành hàm thuần, kèm
   64 ca kiểm thử bằng `console.assert`. Kiểm thử đã bắt được 2 kỳ vọng sai ngay lần chạy đầu.
4. **Tính năng điểm danh (dòng 4).** Event delegation trên lưới lịch, chuyển tuần/tháng có hiệu ứng,
   cảnh báo khi môn vừa chuyển sang "danger" bằng toast và Notification API, không lặp lại.
5. **Sửa lỗi bố cục bằng ảnh chụp (dòng 12).** Mô tả lỗi bằng ảnh chụp màn hình; AI chỉ ra nguyên nhân
   (Grid kéo các thẻ cùng hàng cao bằng nhau) và sửa bằng `grid-column: 1 / -1` thay vì chỉ thu nhỏ thẻ.
