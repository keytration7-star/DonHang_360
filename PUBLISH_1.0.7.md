# 🚀 Hướng Dẫn Publish Version 1.0.7

## 📋 Tình Trạng

- **Code version**: `1.0.7` ✅
- **App đang chạy**: `1.0.6` 
- **Version 1.0.7 chưa được publish** ❌

## ✅ Cách Publish

### Bước 1: Chạy Script

Mở PowerShell hoặc CMD và chạy:
```cmd
.\publish-release.bat
```

### Bước 2: Trả Lời Các Câu Hỏi

Khi script hỏi, nhập như sau:

1. **"Tag v1.0.7 đã tồn tại trên local. Bạn có muốn tiếp tục? (y/n):"**
   → Nhập: **`y`** và nhấn Enter

2. **"Bạn có muốn commit và push code? (y/n):"**
   → Nhập: **`y`** và nhấn Enter

3. **"Nhập commit message (hoặc Enter để dùng mặc định):"**
   → Nhấn Enter để dùng mặc định: "Release v1.0.7"

### Bước 3: Đợi Script Chạy Xong

Script sẽ tự động:
- ✅ Commit code
- ✅ Push lên GitHub
- ✅ Tạo tag v1.0.7
- ✅ Build React app
- ✅ Build Electron
- ✅ Build installer (.exe)
- ✅ Publish lên GitHub Releases

### Bước 4: Kiểm Tra

Sau khi script chạy xong:
1. Kiểm tra GitHub Releases: https://github.com/keytration7-star/DonHang_360/releases
2. Phải có release **v1.0.7** với file **Đơn Hàng 360 Setup 1.0.7.exe**

### Bước 5: Test Auto-Update

1. Mở app (version 1.0.6)
2. Vào **Settings** (Cài đặt)
3. Click **"Kiểm tra cập nhật"**
4. App sẽ tự động tìm thấy version 1.0.7 mới
5. Hiển thị: **"Có bản cập nhật mới: v1.0.7"**

---

## 🎯 Kết Quả Mong Đợi

Sau khi publish xong:
- ✅ Version 1.0.7 có trên GitHub Releases
- ✅ App version 1.0.6 sẽ tự động tìm thấy version 1.0.7
- ✅ Người dùng có thể tải và cài đặt version mới

---

**Chạy script và chọn "y" khi được hỏi!** 🚀

