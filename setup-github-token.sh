#!/bin/bash

# Script hướng dẫn setup GitHub token
# Chạy: bash setup-github-token.sh

echo "========================================"
echo "   Setup GitHub Token"
echo "========================================"
echo ""

echo "Bạn có 2 cách để setup GitHub token:"
echo ""
echo "CÁCH 1: Tạo file .env.github (Khuyến nghị)"
echo "----------------------------------------"
echo "1. Tạo token tại: https://github.com/settings/tokens"
echo "   - Click 'Generate new token' -> 'Generate new token (classic)'"
echo "   - Đặt tên: 'DonHang 360 Release'"
echo "   - Chọn quyền: 'repo' (full control of private repositories)"
echo "   - Click 'Generate token'"
echo "   - Copy token (chỉ hiện 1 lần!)"
echo ""
echo "2. Tạo file .env.github:"
read -p "   Nhập token của bạn: " TOKEN
if [ -n "$TOKEN" ]; then
    echo "$TOKEN" > .env.github
    chmod 600 .env.github
    echo "   ✅ Đã lưu token vào .env.github"
    echo ""
else
    echo "   ❌ Token không được nhập"
    echo ""
fi

echo "CÁCH 2: Set environment variable"
echo "----------------------------------------"
echo "export GH_TOKEN=your_token_here"
echo ""
echo "Hoặc thêm vào ~/.zshrc hoặc ~/.bash_profile:"
echo "echo 'export GH_TOKEN=your_token_here' >> ~/.zshrc"
echo ""

if [ -f ".env.github" ]; then
    echo "✅ File .env.github đã tồn tại"
    echo "   Token: $(head -c 10 .env.github)..."
    echo ""
    read -p "Bạn có muốn test token không? (y/n): " TEST
    if [ "$TEST" = "y" ] || [ "$TEST" = "Y" ]; then
        TOKEN=$(head -n 1 .env.github | sed 's/[[:space:]]//g')
        if command -v curl &> /dev/null; then
            echo ""
            echo "[INFO] Đang test token..."
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $TOKEN" https://api.github.com/user)
            if [ "$HTTP_CODE" = "200" ]; then
                echo "✅ Token hợp lệ!"
            else
                echo "❌ Token không hợp lệ (HTTP $HTTP_CODE)"
            fi
        else
            echo "⚠️  Không có curl để test token"
        fi
    fi
fi

echo ""
echo "Sau khi setup token, bạn có thể chạy:"
echo "   bash publish-release.sh"
echo ""

