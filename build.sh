#!/bin/bash

# Script tự động build app sau khi sửa code
# Chạy: bash build.sh

echo "🔨 Bắt đầu build app..."
echo ""

# Bước 1: Build React app
echo "📦 [1/3] Đang build React app..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Lỗi khi build React app"
    exit 1
fi
echo "✅ Đã build React app"
echo ""

# Bước 2: Build Electron
echo "⚡ [2/3] Đang build Electron..."
npm run build:electron
if [ $? -ne 0 ]; then
    echo "❌ Lỗi khi build Electron"
    exit 1
fi
echo "✅ Đã build Electron"
echo ""

# Bước 3: Tạo installer (tùy chọn)
read -p "Bạn có muốn tạo file installer? (y/n): " CREATE_INSTALLER
if [ "$CREATE_INSTALLER" = "y" ] || [ "$CREATE_INSTALLER" = "Y" ]; then
    echo "📦 [3/3] Đang tạo installer..."
    electron-builder --mac --win --publish never
    if [ $? -ne 0 ]; then
        echo "❌ Lỗi khi tạo installer"
        exit 1
    fi
    echo "✅ Đã tạo installer"
else
    echo "⏭️  Bỏ qua tạo installer"
fi

echo ""
echo "✅ HOÀN TẤT! Code mới đã được build."
echo ""

