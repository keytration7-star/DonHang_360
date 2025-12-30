# 🔧 Hướng Dẫn Sửa Lỗi: App Không Tìm Thấy Cập Nhật

## 🔍 Tình Trạng Hiện Tại

- **Version trong code**: `1.0.7`
- **App đang chạy**: `1.0.6`
- **Tags trên GitHub**: v1.0.1 - v1.0.6 (chưa có v1.0.7)

## ❌ Vấn Đề

App đang chạy version 1.0.6 nhưng không tìm thấy cập nhật v1.0.7 vì **version 1.0.7 chưa được publish lên GitHub**.

## ✅ Giải Pháp

### Bước 1: Publish Version 1.0.7

Chạy script publish:
```cmd
publish-release.bat
```

Khi script hỏi:
- **"Tag v1.0.7 đã tồn tại trên local. Bạn có muốn tiếp tục? (y/n):"** → Nhập **`y`**
- **"Bạn có muốn commit và push code? (y/n):"** → Nhập **`y`**
- **"Nhập commit message:"** → Nhấn Enter để dùng mặc định

Script sẽ:
1. Commit code
2. Push lên GitHub
3. Build app
4. Publish version 1.0.7 lên GitHub Releases

### Bước 2: Kiểm Tra

Sau khi script chạy xong:
1. Kiểm tra GitHub Releases: https://github.com/keytration7-star/DonHang_360/releases
2. Phải có release **v1.0.7** với file **Đơn Hàng 360 Setup 1.0.7.exe**

### Bước 3: Test Auto-Update

1. Mở app (version 1.0.6)
2. Vào **Settings** → Click **"Kiểm tra cập nhật"**
3. App sẽ tự động tìm thấy version 1.0.7 mới
4. Hiển thị thông báo: "Có bản cập nhật mới v1.0.7"

---

## 📝 Lưu Ý

- **Auto-updater chỉ hoạt động khi app đang chạy production build** (file exe đã cài), không phải dev mode
- **Version phải được publish lên GitHub** thì app mới tìm thấy
- **App sẽ tự động kiểm tra** khi khởi động và mỗi 4 giờ

---

## 🎯 Tóm Tắt

1. Chạy `publish-release.bat` để publish version 1.0.7
2. Chọn "y" khi script hỏi
3. Đợi script chạy xong
4. App version 1.0.6 sẽ tự động tìm thấy version 1.0.7

