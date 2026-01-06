#!/bin/bash

# Script tự động build khi file thay đổi (watch mode)
# Sử dụng: bash auto-build.sh
# Sẽ tự động build mỗi khi file trong src/ hoặc electron/ thay đổi

echo "👀 Đang theo dõi thay đổi file..."
echo "📝 Script sẽ tự động build khi bạn sửa code trong src/ hoặc electron/"
echo "🛑 Nhấn Ctrl+C để dừng"
echo ""

# Kiểm tra xem có fswatch không (macOS)
if ! command -v fswatch &> /dev/null; then
    echo "⚠️  fswatch chưa được cài đặt."
    echo "📦 Cài đặt: brew install fswatch"
    echo ""
    echo "💡 Hoặc sử dụng script build.sh thủ công: bash build.sh"
    exit 1
fi

# Hàm build
build_app() {
    echo ""
    echo "🔄 Phát hiện thay đổi file, đang build..."
    echo ""
    
    npm run build
    if [ $? -eq 0 ]; then
        npm run build:electron
        if [ $? -eq 0 ]; then
            echo "✅ Build thành công!"
        else
            echo "❌ Lỗi khi build Electron"
        fi
    else
        echo "❌ Lỗi khi build React app"
    fi
    
    echo ""
    echo "👀 Đang tiếp tục theo dõi..."
}

# Theo dõi thay đổi trong src/ và electron/
fswatch -o src/ electron/ | while read f; do
    build_app
done

