#!/bin/bash

# Script sửa lỗi Permission denied cho node_modules

echo "🔧 Đang sửa quyền thực thi cho node_modules..."

# Sửa quyền cho tất cả file trong .bin
chmod +x node_modules/.bin/* 2>/dev/null

# Xóa quarantine attributes (macOS security)
xattr -d com.apple.quarantine node_modules/.bin/* 2>/dev/null || true

# Xóa quarantine cho toàn bộ node_modules
xattr -dr com.apple.quarantine node_modules 2>/dev/null || true

echo "✅ Đã sửa quyền!"
echo ""
echo "💡 Nếu vẫn lỗi, thử cài lại dependencies:"
echo "   rm -rf node_modules package-lock.json"
echo "   npm install"

