#!/bin/bash

# Script publish release lên GitHub cho macOS/Linux
# Chạy: bash publish-release.sh
# Hoặc: chmod +x publish-release.sh && ./publish-release.sh

echo "========================================"
echo "   Đơn Hàng 360 - Publish Release"
echo "========================================"
echo ""

# Kiểm tra xem có git không
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git chưa được cài đặt hoặc không có trong PATH"
    exit 1
fi

# Kiểm tra xem có npm không
if ! command -v npm &> /dev/null; then
    echo "[ERROR] NPM chưa được cài đặt hoặc không có trong PATH"
    exit 1
fi

# Đọc version từ package.json
VERSION=$(grep -o '"version": *"[^"]*"' package.json | cut -d'"' -f4)

if [ -z "$VERSION" ]; then
    echo "[ERROR] Không thể đọc version từ package.json"
    exit 1
fi

echo "[INFO] Phiên bản hiện tại: $VERSION"
echo ""

# Kiểm tra xem tag đã tồn tại chưa (kiểm tra cả local và remote)
LOCAL_TAG_EXISTS=1
REMOTE_TAG_EXISTS=1

if git tag -l "v$VERSION" | grep -q "v$VERSION"; then
    LOCAL_TAG_EXISTS=0
fi

# Kiểm tra trên remote
if git ls-remote --tags origin "v$VERSION" | grep -q "v$VERSION"; then
    REMOTE_TAG_EXISTS=0
fi

if [ $LOCAL_TAG_EXISTS -eq 0 ]; then
    echo "[WARNING] Tag v$VERSION đã tồn tại trên local!"
    read -p "Bạn có muốn tiếp tục? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "[INFO] Đã hủy"
        exit 0
    fi
elif [ $REMOTE_TAG_EXISTS -eq 0 ]; then
    echo "[WARNING] Tag v$VERSION đã tồn tại trên remote!"
    read -p "Bạn có muốn tiếp tục? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "[INFO] Đã hủy"
        exit 0
    fi
fi

# Kiểm tra GitHub token
if [ -z "$GH_TOKEN" ]; then
    echo "[WARNING] Biến môi trường GH_TOKEN chưa được set"
    echo "[INFO] Đang thử đọc từ file .env.github..."
    if [ -f ".env.github" ]; then
        # Đọc file với encoding UTF-8, loại bỏ BOM và whitespace
        # Sử dụng LC_ALL=C để tránh lỗi encoding với sed
        GH_TOKEN=$(LC_ALL=C cat .env.github | LC_ALL=C sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | LC_ALL=C sed 's/\r$//' | head -n 1)
        
        # Nếu vẫn rỗng, thử cách khác (đọc trực tiếp không qua sed)
        if [ -z "$GH_TOKEN" ]; then
            GH_TOKEN=$(head -n 1 .env.github | LC_ALL=C tr -d '\r\n\t ')
        fi
        
        # Nếu vẫn rỗng, thử đọc với iconv (convert encoding)
        if [ -z "$GH_TOKEN" ] && command -v iconv &> /dev/null; then
            GH_TOKEN=$(iconv -f UTF-8 -t UTF-8 .env.github 2>/dev/null | head -n 1 | LC_ALL=C tr -d '\r\n\t ')
        fi
        
        # Kiểm tra xem có đọc được không
        if [ -n "$GH_TOKEN" ]; then
            echo "[SUCCESS] Đã đọc token từ .env.github"
        fi
    fi
    if [ -z "$GH_TOKEN" ]; then
        echo "[ERROR] Không thể đọc token từ file .env.github"
        echo ""
        echo "Cách khắc phục:"
        echo "1. Kiểm tra file .env.github có nội dung không:"
        echo "   cat .env.github"
        echo ""
        echo "2. Tạo lại file với encoding đúng:"
        echo "   echo 'your_token_here' > .env.github"
        echo ""
        echo "3. Hoặc set environment variable:"
        echo "   export GH_TOKEN=your_token_here"
        echo ""
        echo "Lưu ý: Token phải có quyền 'repo' để publish releases"
        echo "Tạo token tại: https://github.com/settings/tokens"
        exit 1
    fi
fi

# Kiểm tra token có hợp lệ không (test với GitHub API)
echo "[INFO] Đang kiểm tra GitHub token..."
TOKEN_VALID=0
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GH_TOKEN" https://api.github.com/user)
    if [ "$HTTP_CODE" = "200" ]; then
        TOKEN_VALID=1
    else
        # Thử với format Bearer
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/user)
        if [ "$HTTP_CODE" = "200" ]; then
            TOKEN_VALID=1
        fi
    fi
fi

if [ $TOKEN_VALID -eq 0 ]; then
    echo "[WARNING] Không thể xác minh token (có thể do không có curl hoặc token không hợp lệ)"
    echo "[INFO] Sẽ tiếp tục với token hiện tại, nếu lỗi 401 thì token không hợp lệ"
    echo ""
else
    echo "[SUCCESS] GitHub token hợp lệ"
    echo ""
fi

echo "[INFO] GitHub token đã được tìm thấy"
echo ""

# Kiểm tra xem có thay đổi chưa commit không
if ! git diff --quiet HEAD; then
    echo "[INFO] Phát hiện thay đổi chưa commit"
    read -p "Bạn có muốn commit và push code? (y/n): " COMMIT
    if [ "$COMMIT" = "y" ] || [ "$COMMIT" = "Y" ]; then
        echo ""
        echo "[INFO] Đang commit code..."
        
        # Add files
        git add -A
        
        # Kiểm tra xem có gì để commit không
        if git diff --cached --quiet; then
            echo "[INFO] Không có thay đổi để commit (có thể đã commit trước đó)"
        else
            read -p "Nhập commit message (Enter để dùng mặc định): " COMMIT_MSG
            if [ -z "$COMMIT_MSG" ]; then
                COMMIT_MSG="Release v$VERSION"
            fi
            
            git commit -m "$COMMIT_MSG"
            if [ $? -ne 0 ]; then
                echo "[ERROR] Lỗi khi commit"
                exit 1
            fi
            echo "[SUCCESS] Đã commit thành công"
        fi
        
        # Push code lên GitHub (sử dụng token trong URL)
        echo "[INFO] Đang push code lên GitHub..."
        
        # Lấy remote URL và thay thế bằng URL có token
        REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
        if [ -n "$REMOTE_URL" ]; then
            # Nếu là HTTPS URL, thêm token vào
            if [[ "$REMOTE_URL" == https://* ]]; then
                # Extract owner và repo từ URL (format: https://github.com/owner/repo.git)
                if [[ "$REMOTE_URL" =~ https://github.com/([^/]+)/([^/]+)\.git$ ]] || [[ "$REMOTE_URL" =~ https://github.com/([^/]+)/([^/]+)$ ]]; then
                    OWNER="${BASH_REMATCH[1]}"
                    REPO="${BASH_REMATCH[2]}"
                    # Push với token trong URL
                    PUSH_URL="https://${GH_TOKEN}@github.com/${OWNER}/${REPO}.git"
                    echo "[INFO] Đang push với token..."
                    git push "$PUSH_URL" main
                else
                    # Fallback: thử cách khác - replace URL trực tiếp
                    PUSH_URL=$(echo "$REMOTE_URL" | sed "s|https://|https://${GH_TOKEN}@|")
                    echo "[INFO] Đang push với token (fallback)..."
                    git push "$PUSH_URL" main
                fi
            else
                # Nếu là SSH URL, push bình thường
                git push origin main
            fi
        else
            git push origin main
        fi
        
        if [ $? -eq 0 ]; then
            echo "[SUCCESS] Đã push code lên GitHub"
            echo ""
        else
            echo "[ERROR] Lỗi khi push code"
            echo "[INFO] Kiểm tra:"
            echo "   - Kết nối mạng có ổn không"
            echo "   - Quyền truy cập GitHub có đúng không"
            echo "   - Code đã được commit chưa"
            echo ""
            echo "[WARNING] Tiếp tục với các bước build và publish..."
            echo ""
        fi
    fi
fi

# Tạo git tag (chỉ tạo nếu chưa tồn tại)
if [ $LOCAL_TAG_EXISTS -ne 0 ]; then
    echo "[INFO] Đang tạo git tag v$VERSION..."
    git tag -a "v$VERSION" -m "Release v$VERSION"
    if [ $? -ne 0 ]; then
        echo "[WARNING] Không thể tạo tag"
    else
        echo "[SUCCESS] Đã tạo tag v$VERSION"
    fi
else
    echo "[INFO] Tag v$VERSION đã tồn tại trên local, bỏ qua tạo tag"
fi

# Push tag lên GitHub (chỉ push nếu chưa tồn tại trên remote)
if [ $REMOTE_TAG_EXISTS -ne 0 ]; then
    echo "[INFO] Đang push tag lên GitHub..."
    
    # Lấy remote URL và thay thế bằng URL có token
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [ -n "$REMOTE_URL" ]; then
        # Nếu là HTTPS URL, thêm token vào
        if [[ "$REMOTE_URL" == https://* ]]; then
            # Extract owner và repo từ URL (format: https://github.com/owner/repo.git)
            if [[ "$REMOTE_URL" =~ https://github.com/([^/]+)/([^/]+)\.git$ ]] || [[ "$REMOTE_URL" =~ https://github.com/([^/]+)/([^/]+)$ ]]; then
                OWNER="${BASH_REMATCH[1]}"
                REPO="${BASH_REMATCH[2]}"
                # Push tag với token trong URL
                PUSH_URL="https://${GH_TOKEN}@github.com/${OWNER}/${REPO}.git"
                echo "[INFO] Đang push tag với token..."
                git push "$PUSH_URL" "v$VERSION"
            else
                # Fallback: thử cách khác - replace URL trực tiếp
                PUSH_URL=$(echo "$REMOTE_URL" | sed "s|https://|https://${GH_TOKEN}@|")
                echo "[INFO] Đang push tag với token (fallback)..."
                git push "$PUSH_URL" "v$VERSION"
            fi
        else
            # Nếu là SSH URL, push bình thường
            git push origin "v$VERSION"
        fi
    else
        git push origin "v$VERSION"
    fi
    
    if [ $? -ne 0 ]; then
        echo "[WARNING] Không thể push tag (có thể đã tồn tại trên remote)"
    else
        echo "[SUCCESS] Đã push tag lên GitHub"
    fi
else
    echo "[INFO] Tag v$VERSION đã tồn tại trên remote, bỏ qua push tag"
fi
echo ""

# Xóa file release cũ trong thư mục release (đảm bảo chỉ có file mới nhất)
echo "[INFO] Đang xóa file release cũ trong thư mục release..."
if ls release/*.exe 1> /dev/null 2>&1 || ls release/*.dmg 1> /dev/null 2>&1 || ls release/*.app 1> /dev/null 2>&1 || ls release/*.zip 1> /dev/null 2>&1; then
    rm -f release/*.exe
    rm -f release/*.exe.blockmap
    rm -f release/*.dmg
    rm -f release/*.app
    rm -f release/*.zip
    rm -f release/latest.yml
    rm -f release/latest-mac.yml
    echo "[SUCCESS] Đã xóa file release cũ"
else
    echo "[INFO] Không có file release cũ để xóa"
fi
echo ""

# Build app
echo "[INFO] Đang build ứng dụng..."
echo "[INFO] Điều này có thể mất vài phút..."
echo ""

# Build React app
echo "[STEP 1/3] Đang build React app..."
npm run build
if [ $? -ne 0 ]; then
    echo "[ERROR] Lỗi khi build React app"
    echo "[INFO] Kiểm tra lỗi ở trên để biết chi tiết"
    exit 1
fi
echo "[SUCCESS] Đã build React app"
echo ""

# Build Electron
echo "[STEP 2/3] Đang build Electron..."
npm run build:electron
if [ $? -ne 0 ]; then
    echo "[ERROR] Lỗi khi build Electron"
    echo "[INFO] Kiểm tra lỗi ở trên để biết chi tiết"
    exit 1
fi
echo "[SUCCESS] Đã build Electron"
echo ""

# Xóa file release cũ trước khi build mới
echo "[INFO] Đang xóa file release cũ trong thư mục release trước khi build..."
rm -f release/*.exe release/*.exe.blockmap release/*.dmg release/*.app release/*.zip release/latest.yml release/latest-mac.yml
echo ""

# Build và publish với electron-builder
echo "[STEP 3/3] Đang build installer và publish lên GitHub..."
echo "[INFO] Sử dụng GitHub token để publish..."
echo "[INFO] Token: ${GH_TOKEN:0:10}... (10 ký tự đầu)"

# Set token cho electron-builder
export GH_TOKEN="$GH_TOKEN"
export GITHUB_TOKEN="$GH_TOKEN"

echo "[INFO] Đang build với electron-builder..."
echo "[INFO] Environment variables đã được set: GH_TOKEN, GITHUB_TOKEN"
echo "[INFO] Token: ${GH_TOKEN:0:15}... (15 ký tự đầu)"

echo "[INFO] Đang build installer và publish với electron-builder..."
echo "[INFO] Token đã được set trong environment: GH_TOKEN, GITHUB_TOKEN"
npx electron-builder --publish always
BUILD_RESULT=$?

# Kiểm tra xem release đã được tạo trên GitHub chưa
echo ""
echo "[INFO] Đang kiểm tra xem release đã được tạo trên GitHub chưa..."
RELEASE_EXISTS=0
if command -v curl &> /dev/null; then
    # Sử dụng curl để kiểm tra release
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GH_TOKEN" "https://api.github.com/repos/keytration7-star/DonHang_360/releases/tags/v$VERSION")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "[SUCCESS] Release v$VERSION đã được tạo thành công trên GitHub!"
        RELEASE_EXISTS=1
    fi
else
    # Nếu không có curl, chỉ dựa vào errorlevel
    if [ $BUILD_RESULT -eq 0 ]; then
        RELEASE_EXISTS=1
    fi
fi

# Nếu release đã tồn tại trên GitHub, coi như thành công
if [ $RELEASE_EXISTS -eq 1 ]; then
    echo "[SUCCESS] Đã build và publish thành công!"
    echo ""
else
    # Nếu errorlevel khác 0 và release chưa tồn tại, mới báo lỗi
    if [ $BUILD_RESULT -ne 0 ]; then
        echo ""
        echo "[ERROR] Lỗi khi build hoặc publish"
        echo ""
        echo "[INFO] Nguyên nhân có thể:"
        echo "  1. GitHub token không hợp lệ hoặc hết hạn (lỗi 401)"
        echo "  2. Token không có quyền \"repo\" để publish releases"
        echo "  3. Kết nối mạng có vấn đề"
        echo "  4. Version đã tồn tại trên GitHub Releases"
        echo ""
        echo "[INFO] Cách khắc phục:"
        echo "  1. Tạo token mới tại: https://github.com/settings/tokens"
        echo "     - Chọn quyền \"repo\" (full control of private repositories)"
        echo "     - Copy token và cập nhật vào file .env.github"
        echo "  2. Kiểm tra token có quyền \"repo\" không"
        echo "  3. Kiểm tra kết nối mạng"
        echo "  4. Kiểm tra version đã tồn tại tại: https://github.com/keytration7-star/DonHang_360/releases"
        echo ""
        echo "[INFO] Có thể thử build không publish: npm run build:all:no-publish"
        echo "[INFO] File installer vẫn được tạo tại: release/"
        echo ""
        exit 1
    fi
fi

echo "[SUCCESS] Đã build và publish thành công!"
echo ""

# Tóm tắt
echo "========================================"
echo "   HOÀN TẤT!"
echo "========================================"
echo ""
echo "[INFO] Phiên bản: v$VERSION"
echo "[INFO] Tag: v$VERSION"
echo "[INFO] Release đã được tạo trên GitHub"
echo "[INFO] File installer: release/"
echo ""
echo "[INFO] App sẽ tự động thông báo cập nhật cho người dùng"
echo "[INFO] Kiểm tra tại: https://github.com/keytration7-star/DonHang_360/releases"
echo ""

