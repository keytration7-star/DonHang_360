#!/bin/bash

# Script clear cache và build lại app trên macOS/Linux
# Chạy: bash clear-cache-and-build.sh
# Hoặc: chmod +x clear-cache-and-build.sh && ./clear-cache-and-build.sh

echo "========================================"
echo "   Clear Cache và Build Lại App"
echo "========================================"
echo ""

echo "[INFO] Đang xóa cache và build files..."
echo ""

# Xóa thư mục dist
if [ -d "dist" ]; then
    echo "[INFO] Đang xóa thư mục dist..."
    rm -rf dist
    echo "[SUCCESS] Đã xóa dist"
else
    echo "[INFO] Không có thư mục dist"
fi

# Xóa thư mục dist-electron
if [ -d "dist-electron" ]; then
    echo "[INFO] Đang xóa thư mục dist-electron..."
    rm -rf dist-electron
    echo "[SUCCESS] Đã xóa dist-electron"
else
    echo "[INFO] Không có thư mục dist-electron"
fi

# Xóa node_modules/.vite cache
if [ -d "node_modules/.vite" ]; then
    echo "[INFO] Đang xóa Vite cache..."
    rm -rf node_modules/.vite
    echo "[SUCCESS] Đã xóa Vite cache"
fi

# Xóa release files cũ (tùy chọn)
read -p "Bạn có muốn xóa file release cũ? (y/n): " CLEAR_RELEASE
if [ "$CLEAR_RELEASE" = "y" ] || [ "$CLEAR_RELEASE" = "Y" ]; then
    if ls release/*.exe 1> /dev/null 2>&1 || ls release/*.dmg 1> /dev/null 2>&1 || ls release/*.app 1> /dev/null 2>&1; then
        echo "[INFO] Đang xóa file release cũ..."
        rm -f release/*.exe
        rm -f release/*.exe.blockmap
        rm -f release/*.dmg
        rm -f release/*.app
        rm -f release/*.zip
        rm -f release/latest.yml
        rm -f release/latest-mac.yml
        echo "[SUCCESS] Đã xóa file release cũ"
    else
        echo "[INFO] Không có file release cũ"
    fi
fi

echo ""
echo "[INFO] Đang build lại app..."
echo ""

# Build React app
echo "[STEP 1/3] Đang build React app..."
npm run build
if [ $? -ne 0 ]; then
    echo "[ERROR] Lỗi khi build React app"
    exit 1
fi
echo "[SUCCESS] Đã build React app"
echo ""

# Build Electron
echo "[STEP 2/3] Đang build Electron..."
npm run build:electron
if [ $? -ne 0 ]; then
    echo "[ERROR] Lỗi khi build Electron"
    exit 1
fi
echo "[SUCCESS] Đã build Electron"
echo ""

echo "========================================"
echo "   HOÀN TẤT!"
echo "========================================"
echo ""
echo "[INFO] Đã clear cache và build lại thành công"
echo ""


