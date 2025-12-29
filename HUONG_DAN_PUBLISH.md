# 📚 Hướng Dẫn Publish Code Mới Lên GitHub

## 🎯 Tóm Tắt Nhanh

Khi có code mới, bạn chỉ cần làm 3 bước:
1. **Tăng version** trong `package.json`
2. **Chạy script** `publish-release.bat`
3. **Xong!** App sẽ tự động publish lên GitHub

---

## 📝 Chi Tiết Từng Bước

### Bước 1: Tăng Version trong `package.json`

1. Mở file `package.json` trong thư mục gốc
2. Tìm dòng `"version": "1.0.2"` (hoặc version hiện tại)
3. Tăng version theo quy tắc:
   - **Patch** (sửa lỗi nhỏ): `1.0.2` → `1.0.3`
   - **Minor** (tính năng mới): `1.0.2` → `1.1.0`
   - **Major** (thay đổi lớn): `1.0.2` → `2.0.0`

**Ví dụ:**
```json
{
  "name": "donhang-360",
  "version": "1.0.3",  // ← Tăng từ 1.0.2 lên 1.0.3
  ...
}
```

### Bước 2: Chạy Script Publish

1. Mở **Command Prompt** hoặc **PowerShell** trong thư mục dự án
2. Chạy lệnh:
   ```cmd
   publish-release.bat
   ```
3. Script sẽ tự động:
   - ✅ Kiểm tra version
   - ✅ Commit và push code (nếu có thay đổi)
   - ✅ Tạo git tag `v1.0.3`
   - ✅ Build React app
   - ✅ Build Electron
   - ✅ Build installer (.exe)
   - ✅ Publish lên GitHub Releases

### Bước 3: Kiểm Tra Kết Quả

Sau khi script chạy xong, kiểm tra:
- **GitHub Releases**: https://github.com/keytration7-star/DonHang_360/releases
- **File installer**: `release\Đơn Hàng 360 Setup 1.0.3.exe`

---

## ⚙️ Cấu Hình GitHub Token (Chỉ Cần Làm 1 Lần)

### Cách 1: Tạo File `.env.github` (Khuyến nghị)

1. Tạo file `.env.github` trong thư mục gốc
2. Copy GitHub token vào file (chỉ 1 dòng, không có dấu ngoặc kép):
   ```
   ghp_your_token_here
   ```
3. File này đã được thêm vào `.gitignore` nên không bị commit

### Cách 2: Set Environment Variable

**Windows (CMD):**
```cmd
set GH_TOKEN=ghp_your_token_here
```

**Windows (PowerShell):**
```powershell
$env:GH_TOKEN="ghp_your_token_here"
```

**Lưu ý**: Environment variable chỉ tồn tại trong session hiện tại. Nếu đóng terminal, cần set lại.

---

## 🔧 Cách Lấy GitHub Token

1. Vào https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Đặt tên token (ví dụ: "DonHang360 Publish")
4. Chọn quyền **`repo`** (full control of private repositories)
5. Click **"Generate token"**
6. **Copy token ngay** (chỉ hiển thị 1 lần)

---

## 📋 Quy Trình Đầy Đủ (Ví Dụ)

Giả sử bạn vừa sửa code và muốn publish version `1.0.3`:

```cmd
# 1. Mở package.json, tăng version từ 1.0.2 → 1.0.3

# 2. Chạy script
publish-release.bat

# 3. Script sẽ hỏi:
# - "Bạn có muốn commit và push code? (y/n):" → Nhập "y"
# - Nhập commit message (hoặc Enter để dùng mặc định)

# 4. Đợi script build và publish (mất vài phút)

# 5. Xong! Kiểm tra tại: https://github.com/keytration7-star/DonHang_360/releases
```

---

## 🚨 Xử Lý Lỗi

### Lỗi: "Tag v1.0.3 đã tồn tại"
- **Nguyên nhân**: Version này đã được publish trước đó
- **Giải pháp**: Tăng version lên số cao hơn (ví dụ: `1.0.4`)

### Lỗi: "GitHub token không hợp lệ"
- **Nguyên nhân**: Token hết hạn hoặc không đúng
- **Giải pháp**: 
  1. Tạo token mới tại https://github.com/settings/tokens
  2. Cập nhật vào file `.env.github` hoặc set lại `GH_TOKEN`

### Lỗi: "Build failed"
- **Nguyên nhân**: Có lỗi trong code hoặc thiếu dependencies
- **Giải pháp**:
  1. Kiểm tra lỗi trong console
  2. Chạy `npm install` để cài lại dependencies
  3. Sửa lỗi code trước khi publish

### Lỗi: "Cannot push to GitHub"
- **Nguyên nhân**: Chưa có quyền hoặc chưa đăng nhập Git
- **Giải pháp**:
  1. Kiểm tra đã đăng nhập Git: `git config --global user.name`
  2. Push thủ công: `git push origin main`

---

## 💡 Mẹo & Lưu Ý

1. **Luôn test code trước khi publish**: Chạy `npm run dev` để test
2. **Commit message rõ ràng**: Mô tả những gì đã thay đổi
3. **Version phải tăng**: Không thể publish cùng version 2 lần
4. **GitHub token bảo mật**: Không commit token vào Git
5. **Kiểm tra release sau khi publish**: Đảm bảo file đã được upload

---

## 📞 Tóm Tắt Nhanh

```
1. Sửa code
2. Tăng version trong package.json
3. Chạy: publish-release.bat
4. Xong!
```

---

## 🔗 Liên Kết Hữu Ích

- **GitHub Releases**: https://github.com/keytration7-star/DonHang_360/releases
- **GitHub Tokens**: https://github.com/settings/tokens
- **Semantic Versioning**: https://semver.org/

---

**Chúc bạn publish thành công! 🚀**

