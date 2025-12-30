# 🔄 Hướng Dẫn Cài Lại App Version Mới

## ❓ Tại Sao Cần Cài Lại?

Khi bạn đã publish version mới (ví dụ: 1.0.3) nhưng app đang chạy version cũ (1.0.1 hoặc 1.0.2), bạn cần cài lại file exe mới để:

1. ✅ App hiển thị đúng version hiện tại
2. ✅ Auto-updater hoạt động đúng cho các version sau
3. ✅ Có các tính năng và sửa lỗi mới nhất

---

## 📥 Cách Cài Lại App

### Bước 1: Tải File Exe Mới

1. Vào GitHub Releases: https://github.com/keytration7-star/DonHang_360/releases
2. Tìm version mới nhất (ví dụ: **v1.0.3**)
3. Tải file: **Đơn Hàng 360 Setup 1.0.3.exe**

Hoặc nếu bạn đã build local:
- File nằm trong thư mục `release\`
- Tên file: `Đơn Hàng 360 Setup 1.0.3.exe`

### Bước 2: Cài Đặt

1. **Đóng app hiện tại** (nếu đang chạy)
2. Chạy file **Đơn Hàng 360 Setup 1.0.3.exe**
3. Làm theo hướng dẫn cài đặt
4. Chọn **"Cài đặt đè lên"** hoặc **"Gỡ cài đặt cũ rồi cài mới"**

### Bước 3: Kiểm Tra

1. Mở app mới
2. Vào **Settings** (Cài đặt)
3. Kiểm tra version ở cuối trang → Phải hiển thị **v1.0.3**

---

## 🔄 Auto-Update Sau Này

Sau khi cài lại version 1.0.3, app sẽ tự động:
- ✅ Kiểm tra cập nhật khi khởi động
- ✅ Kiểm tra lại mỗi 4 giờ
- ✅ Tự động thông báo khi có version mới (1.0.4, 1.1.0, v.v.)

**Bạn không cần cài lại thủ công nữa!** App sẽ tự động cập nhật.

---

## ⚠️ Lưu Ý

1. **Dữ liệu sẽ được giữ nguyên**: IndexedDB và dữ liệu local không bị mất khi cài lại
2. **Cài đặt đè lên**: Không cần gỡ cài đặt cũ, chỉ cần chạy file exe mới
3. **Backup dữ liệu** (tùy chọn): Nếu lo lắng, có thể export dữ liệu trước khi cài lại:
   - Vào Settings → Quản lý dữ liệu → Xuất dữ liệu (Backup)

---

## 🐛 Nếu Gặp Vấn Đề

### App vẫn hiển thị version cũ
- Đảm bảo đã đóng app hoàn toàn trước khi cài
- Thử gỡ cài đặt cũ rồi cài lại mới

### Không tìm thấy file exe
- Kiểm tra thư mục `release\` trong project
- Hoặc tải từ GitHub Releases

### Lỗi khi cài đặt
- Chạy file exe với quyền Administrator
- Kiểm tra xem có app nào đang chạy không

---

**Sau khi cài lại, app sẽ tự động cập nhật cho các version sau! 🚀**

