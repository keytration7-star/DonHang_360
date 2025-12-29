# Hướng dẫn Cập nhật Tự động từ GitHub

## Cấu hình Auto-Update

App đã được cấu hình để tự động kiểm tra và cập nhật từ GitHub Releases.

## 🚀 Cách Publish Release (Nhanh nhất)

### Sử dụng script tự động:

1. **Cấu hình GitHub Token** (chỉ cần làm 1 lần):
   - Tạo file `.env.github` trong thư mục gốc
   - Copy token vào file đó: `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`
   - Hoặc set environment variable: `set GH_TOKEN=your_token_here`

2. **Tăng version trong `package.json`**:
   ```json
   "version": "1.0.1"
   ```

3. **Chạy script**:
   ```batch
   publish-release.bat
   ```

Script sẽ tự động:
- ✅ Commit và push code lên GitHub
- ✅ Tạo git tag với version
- ✅ Build React app
- ✅ Build Electron
- ✅ Build installer (.exe)
- ✅ Publish lên GitHub Releases
- ✅ App sẽ tự động thông báo cập nhật cho người dùng

### 1. Cấu hình GitHub Token (Khi build)

Khi build app để publish lên GitHub, bạn cần set GitHub token:

**Windows (PowerShell):**
```powershell
$env:GH_TOKEN="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"
npm run build:all
```

**Windows (CMD):**
```cmd
set GH_TOKEN=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
npm run build:all
```

**Linux/Mac:**
```bash
export GH_TOKEN="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"
npm run build:all
```

### 2. Tạo Release trên GitHub

1. Tăng version trong `package.json` (ví dụ: `1.0.0` → `1.0.1`)
2. Commit và push code:
   ```bash
   git add .
   git commit -m "Release v1.0.1"
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```
3. Build và publish:
   ```bash
   npm run build:all
   ```
   File sẽ được tự động upload lên GitHub Releases

### 3. Cách App Tự Động Cập Nhật

- App sẽ tự động kiểm tra cập nhật khi khởi động
- Kiểm tra lại mỗi 4 giờ
- Khi có bản cập nhật mới, app sẽ hiển thị thông báo
- Người dùng có thể chọn tải xuống ngay hoặc bỏ qua
- Sau khi tải xong, app sẽ hỏi có muốn khởi động lại để cập nhật không

### 4. Lưu ý Bảo Mật

⚠️ **QUAN TRỌNG**: GitHub token trong file này chỉ là ví dụ. Trong thực tế:
- Không commit token vào git
- Sử dụng GitHub Secrets khi dùng GitHub Actions
- Hoặc set token qua environment variable khi build local

### 5. Cấu hình GitHub Actions (Tùy chọn)

Nếu muốn tự động build và release khi push tag, file `.github/workflows/release.yml` đã được tạo sẵn.

Cần thêm GitHub token vào Secrets:
1. Vào GitHub repo → Settings → Secrets and variables → Actions
2. Thêm secret mới tên `GITHUB_TOKEN` với giá trị là token của bạn

