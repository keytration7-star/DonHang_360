# Hướng dẫn Publish Release

## 📋 Yêu cầu

1. Git đã được cài đặt và cấu hình
2. Node.js và npm đã được cài đặt
3. GitHub token (Personal Access Token với quyền `repo`)

## 🔑 Cấu hình GitHub Token

### Cách 1: Tạo file `.env.github`
1. Tạo file `.env.github` trong thư mục gốc
2. Copy token vào file:
   ```
   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
   ```
3. File này đã được thêm vào `.gitignore` nên không bị commit

### Cách 2: Set Environment Variable
```batch
set GH_TOKEN=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
```

## 🚀 Các bước Publish Release

### Bước 1: Tăng Version
Mở `package.json` và tăng version:
```json
{
  "version": "1.0.1"  // Tăng từ 1.0.0 lên 1.0.1
}
```

### Bước 2: Chạy Script
Chạy file `publish-release.bat`:
```batch
publish-release.bat
```

Script sẽ tự động:
1. ✅ Kiểm tra version trong package.json
2. ✅ Commit và push code (nếu có thay đổi)
3. ✅ Tạo git tag `v1.0.1`
4. ✅ Push tag lên GitHub
5. ✅ Build React app
6. ✅ Build Electron
7. ✅ Build installer (.exe)
8. ✅ Publish lên GitHub Releases

### Bước 3: Kiểm tra
- Kiểm tra GitHub Releases: https://github.com/keytration7-star/DonHang_360/releases
- File installer sẽ có tên: `DonHang360 Setup 1.0.1.exe`

## 📱 Cách App Tự Động Cập Nhật

Khi người dùng mở app:
1. App tự động kiểm tra cập nhật khi khởi động
2. Kiểm tra lại mỗi 4 giờ
3. Nếu có bản cập nhật mới:
   - Hiển thị thông báo: "Có bản cập nhật mới v1.0.1"
   - Người dùng chọn "Tải xuống" hoặc "Bỏ qua"
   - Nếu chọn tải xuống, app sẽ tự động tải và cài đặt
   - Sau khi tải xong, hỏi có muốn khởi động lại để cập nhật không

## 🔧 Build Thủ Công (Nếu cần)

Nếu script không hoạt động, có thể build thủ công:

```batch
REM 1. Set GitHub token
set GH_TOKEN=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

REM 2. Build React
npm run build

REM 3. Build Electron
npm run build:electron

REM 4. Build và publish
npm run build:all

REM Hoặc build không publish
npm run build:all:no-publish
```

## ⚠️ Lưu ý

1. **Version phải tăng**: Không thể publish cùng version 2 lần
2. **Git tag phải unique**: Mỗi version chỉ có 1 tag
3. **GitHub token phải có quyền `repo`**: Để publish lên Releases
4. **File `.env.github` không được commit**: Đã thêm vào `.gitignore`

## 🐛 Xử lý Lỗi

### Lỗi: "GitHub token không hợp lệ"
- Kiểm tra token có đúng không
- Đảm bảo token có quyền `repo`

### Lỗi: "Tag đã tồn tại"
- Tăng version trong package.json
- Hoặc xóa tag cũ: `git tag -d v1.0.1` và `git push origin :refs/tags/v1.0.1`

### Lỗi: "Build failed"
- Kiểm tra xem đã cài đủ dependencies: `npm install`
- Kiểm tra lỗi trong console

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
- File `publish-release.bat` có chạy được không
- GitHub token có hợp lệ không
- Version trong package.json đã tăng chưa

