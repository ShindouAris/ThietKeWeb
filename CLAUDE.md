# LHU Attendance Tracker — Đồ án Thiết kế Web (111101, ĐH Lạc Hồng)

## Bối cảnh
Web quản lý Thời khóa biểu & Chuyên cần cho sinh viên. Web tĩnh, chạy trên GitHub Pages.
Đây là đồ án học tập: code phải dễ đọc, có chú thích tiếng Việt ngắn gọn, ưu tiên cách viết
đơn giản mà sinh viên năm 2 giải thích được khi bị giảng viên hỏi.

## Ràng buộc kỹ thuật (BẮT BUỘC)
- Chỉ HTML5, CSS3, JavaScript thuần (ES Modules). KHÔNG framework, KHÔNG thư viện CSS/JS, KHÔNG build tool.
- Dữ liệu mẫu nằm trong js/data.js; thay đổi của người dùng lưu bằng localStorage qua js/storage.js.
- Lịch tuần dựng bằng CSS Grid; các ca học trong ô căn bằng Flexbox.
- Responsive: desktop ≥ 1024px lưới 7 cột; mobile < 768px chuyển thành danh sách theo ngày.
- Ưu tiên map / filter / reduce thay cho vòng for. Dùng event delegation cho lưới lịch.
- Không được có lỗi trong Console.
- Chạy thử bằng: npx serve . (ES Modules không chạy khi mở file:// trực tiếp).

## Cấu trúc
/assets  /css (styles.css, schedule.css, profile.css)  /docs
/js: data.js · storage.js · logic.js · schedule.js · dashboard.js · profile.js
index.html (Dashboard) · schedule.html (Thời khóa biểu & Điểm danh) · profile.html (Hồ sơ & Cài đặt)

## Quy tắc "hộp cát" — chỉ sửa file thuộc phạm vi của task hiện tại
| Vai trò | File được sửa | Tiền tố class CSS |
|---|---|---|
| Nhóm trưởng | data.js, storage.js, README.md | — |
| UI/UX | styles.css, schedule.css, phần khung HTML | .ui- |
| Data Logic | logic.js (hàm thuần, KHÔNG đụng DOM) | — |
| Feature | schedule.js | .att- |
| Dashboard & Profile | dashboard.js, profile.js, profile.css | .pf- |
Nếu cần thay đổi file ngoài phạm vi, DỪNG LẠI và báo cho tôi thay vì tự sửa.

## Data Contract (không đổi tên thuộc tính)
STUDENT { studentId, fullName, email, phone, className }
COURSES [{ courseId, courseName, credits, lecturer, room, color, totalSessions }]
SESSIONS [{ sessionId, courseId, date "YYYY-MM-DD", shift 1-4, periodStart, periodEnd, room,
            status "present"|"absent"|"excused"|"upcoming" }]
SETTINGS { absenceLimit: 0.2, warningAt: 0.15, notifyEnabled: true }

## Quy tắc tính
- Tỷ lệ đi học = present / (số buổi đã diễn ra, tức status khác "upcoming"); nếu mẫu = 0 thì trả 0, không chia cho 0.
- Tỷ lệ nghỉ = (absent + excused) / totalSessions.
- Mức: < warningAt → "safe"; warningAt..absenceLimit → "warning"; > absenceLimit → "danger" (hiện nhắc nhở).

## Giao diện
Màu chủ đạo xanh dương LHU, khai báo trong :root của styles.css. Font hệ thống. Giao diện tiếng Việt.

## Git
Commit message dạng: [Tên-tính-năng] Mô tả ngắn (VD: [Schedule] Thêm click đánh dấu buổi học).