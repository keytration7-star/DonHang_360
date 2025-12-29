# 🚀 Hướng dẫn Nhanh - Publish Release

## Bước 1: Cấu hình GitHub Token (Chỉ làm 1 lần)

Tạo file `.env.github` trong thư mục gốc và thêm token:
```
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
```

## Bước 2: Tăng Version

Mở `package.json` và tăng version:
```json
"version": "1.0.1"
```

## Bước 3: Chạy Script

Double-click vào file `publish-release.bat` hoặc chạy:
```batch
publish-release.bat
```

## ✅ Xong!

Script sẽ tự động:
- ✅ Push code lên GitHub
- ✅ Tạo tag và release
- ✅ Build file .exe
- ✅ Upload lên GitHub Releases
- ✅ App sẽ tự động thông báo cập nhật cho người dùng

## 📍 Kiểm tra

Sau khi chạy xong, kiểm tra tại:
https://github.com/keytration7-star/DonHang_360/releases

File installer: `release\DonHang360 Setup 1.0.1.exe`

