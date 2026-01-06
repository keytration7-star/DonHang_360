#!/bin/bash

# Script cài đặt Node.js trên Mac
# Chạy script này trong Terminal: bash cai-nodejs.sh

echo "🚀 Bắt đầu cài đặt Node.js..."
echo ""

# Kiểm tra xem đã có Node.js chưa
if command -v node &> /dev/null; then
    echo "✅ Node.js đã được cài đặt!"
    node --version
    npm --version
    exit 0
fi

# Kiểm tra Homebrew
if command -v brew &> /dev/null; then
    echo "📦 Tìm thấy Homebrew, đang cài Node.js qua Homebrew..."
    echo "⚠️  Bạn sẽ được yêu cầu nhập mật khẩu Mac"
    echo ""
    brew install node
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Cài đặt thành công!"
        echo ""
        echo "📝 Mở Terminal mới và chạy:"
        echo "   node --version"
        echo "   npm --version"
    else
        echo ""
        echo "❌ Cài đặt thất bại. Vui lòng thử cách khác."
        echo ""
        echo "💡 CÁCH KHÁC:"
        echo "1. Mở trình duyệt: https://nodejs.org/"
        echo "2. Tải phiên bản LTS (nút màu xanh)"
        echo "3. Mở file .pkg và làm theo hướng dẫn"
    fi
else
    echo "❌ Homebrew chưa được cài đặt."
    echo ""
    echo "💡 CÓ 2 CÁCH ĐỂ CÀI NODE.JS:"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "CÁCH 1: Tải từ website (DỄ NHẤT - Khuyến nghị)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "1. Mở trình duyệt và vào: https://nodejs.org/"
    echo "2. Click nút 'Download Node.js (LTS)' màu xanh"
    echo "3. File .pkg sẽ được tải về"
    echo "4. Double-click file .pkg để mở installer"
    echo "5. Làm theo hướng dẫn (Continue → Continue → Agree → Install)"
    echo "6. Nhập mật khẩu Mac khi được yêu cầu"
    echo "7. Mở Terminal mới và kiểm tra: node --version"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "CÁCH 2: Cài Homebrew trước, sau đó cài Node.js"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Chạy lệnh sau trong Terminal:"
    echo ""
    echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    echo ""
    echo "Sau khi cài Homebrew xong, chạy:"
    echo "  brew install node"
    echo ""
fi

