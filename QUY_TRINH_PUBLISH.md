# 🚀 Quy Trình Publish Version Mới

## 📋 Mục Đích

Khi bạn có code mới và muốn người dùng trên máy khác tự động nhận được cập nhật, bạn cần:
1. **Tăng version** trong `package.json`
2. **Chạy script** `publish-release.bat`
3. **Xong!** App trên máy khác sẽ tự động thông báo và cập nhật

---

## ✅ Quy Trình Chi Tiết

### Bước 1: Tăng Version

Mở file `package.json`, tìm dòng `"version"` và tăng lên:

```json
{
  "version": "1.0.4",  // Tăng từ 1.0.3 → 1.0.4
  ...
}
```

**Quy tắc tăng version:**
- `1.0.3` → `1.0.4`: Sửa lỗi nhỏ (patch)
- `1.0.3` → `1.1.0`: Tính năng mới (minor)
- `1.0.3` → `2.0.0`: Thay đổi lớn (major)

### Bước 2: Chạy Script Publish

Mở Command Prompt trong thư mục dự án và chạy:

```cmd
publish-release.bat
```

### Bước 3: Script Tự Động Làm Gì?

Script sẽ tự động thực hiện:

1. ✅ **Commit code** (nếu có thay đổi)
2. ✅ **Push code** lên GitHub
3. ✅ **Tạo git tag** `v1.0.4`
4. ✅ **Push tag** lên GitHub
5. ✅ **Build React app**
6. ✅ **Build Electron**
7. ✅ **Build installer** (.exe)
8. ✅ **Publish lên GitHub Releases**

**Thời gian:** Khoảng 2-5 phút tùy máy tính

### Bước 4: Kiểm Tra

Sau khi script chạy xong, kiểm tra:
- **GitHub Releases**: https://github.com/keytration7-star/DonHang_360/releases
- File installer: `Đơn Hàng 360 Setup 1.0.4.exe` đã được upload

---

## 📱 App Trên Máy Khác Sẽ Tự Động Cập Nhật

### Khi Người Dùng Mở App:

1. **Tự động kiểm tra cập nhật** khi app khởi động
2. **Kiểm tra lại mỗi 4 giờ** nếu app đang chạy
3. **Khi có version mới** (ví dụ: 1.0.4):
   - Hiển thị thông báo: *"Có bản cập nhật mới v1.0.4. Bạn có muốn tải xuống ngay bây giờ?"*
   - Người dùng chọn **"Tải xuống"** hoặc **"Bỏ qua"**
   - Nếu chọn tải xuống:
     - App tự động tải file cập nhật
     - Hiển thị tiến trình tải
     - Sau khi tải xong: *"Cập nhật đã sẵn sàng. Bạn có muốn khởi động lại để cập nhật không?"*
     - Nếu chọn "Khởi động lại ngay": App sẽ tự động cài đặt và khởi động lại với version mới

### Người Dùng Cũng Có Thể Kiểm Tra Thủ Công:

- Vào **Settings** (Cài đặt)
- Ở cuối trang, click nút **"Kiểm tra cập nhật"**
- App sẽ kiểm tra ngay lập tức

---

## ⚙️ Cấu Hình Cần Thiết (Chỉ Làm 1 Lần)

### GitHub Token

Để script có thể publish lên GitHub, bạn cần GitHub token:

1. **Tạo file `.env.github`** trong thư mục gốc
2. **Copy token vào file** (chỉ 1 dòng, không có dấu ngoặc kép):
   ```
   ghp_your_token_here
   ```

**Cách lấy GitHub token:**
1. Vào https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Chọn quyền **`repo`** (full control)
4. Copy token và paste vào file `.env.github`

---

## 🔍 Kiểm Tra Auto-Update Hoạt Động

### Trên Máy Phát Triển (Của Bạn):

1. Chạy `publish-release.bat` với version mới
2. Kiểm tra GitHub Releases có file mới không
3. ✅ Xong!

### Trên Máy Người Dùng:

1. Mở app (version cũ, ví dụ: 1.0.3)
2. App tự động kiểm tra cập nhật
3. Nếu có version mới (1.0.4), app sẽ thông báo
4. Người dùng chọn tải xuống và cập nhật

---

## 📝 Ví Dụ Thực Tế

### Tình Huống: Bạn vừa sửa lỗi và muốn publish

1. **Sửa code** (ví dụ: sửa lỗi hiển thị)
2. **Tăng version**: `1.0.3` → `1.0.4` trong `package.json`
3. **Chạy script**: `publish-release.bat`
4. **Đợi script chạy xong** (2-5 phút)
5. **Kiểm tra**: https://github.com/keytration7-star/DonHang_360/releases
6. **Xong!** App trên máy khác sẽ tự động thông báo cập nhật

---

## ⚠️ Lưu Ý Quan Trọng

1. **Version phải tăng**: Không thể publish cùng version 2 lần
2. **GitHub token phải có quyền `repo`**: Để publish lên Releases
3. **Kết nối mạng ổn định**: Để upload file lên GitHub
4. **File `.env.github` không được commit**: Đã thêm vào `.gitignore`

---

## 🐛 Xử Lý Lỗi

### Lỗi: "Tag đã tồn tại"
- **Giải pháp**: Tăng version lên số cao hơn

### Lỗi: "GitHub token không hợp lệ"
- **Giải pháp**: Tạo token mới và cập nhật vào `.env.github`

### Lỗi: "Build failed"
- **Giải pháp**: Kiểm tra lỗi trong console và sửa code

### App trên máy khác không nhận cập nhật
- **Kiểm tra**: App có đang chạy version production không (không phải dev mode)
- **Kiểm tra**: GitHub Releases có file mới không
- **Thử**: Click "Kiểm tra cập nhật" thủ công trong Settings

---

## 📞 Tóm Tắt

```
1. Tăng version trong package.json
2. Chạy: publish-release.bat
3. Đợi script chạy xong
4. Xong! App trên máy khác sẽ tự động cập nhật
```

**Đơn giản vậy thôi! 🎉**

