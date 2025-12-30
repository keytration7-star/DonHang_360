@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Đơn Hàng 360 - Publish Release
echo ========================================
echo.

REM Kiểm tra xem có git không
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git chưa được cài đặt hoặc không có trong PATH
    pause
    exit /b 1
)

REM Kiểm tra xem có npm không
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] NPM chưa được cài đặt hoặc không có trong PATH
    pause
    exit /b 1
)

REM Đọc version từ package.json
set VERSION=
for /f "tokens=2 delims=:," %%a in ('findstr /c:"\"version\"" package.json') do (
    set VERSION=%%a
    set VERSION=!VERSION:"=!
    set VERSION=!VERSION: =!
)

if "!VERSION!"=="" (
    echo [ERROR] Không thể đọc version từ package.json
    pause
    exit /b 1
)

echo [INFO] Phiên bản hiện tại: !VERSION!
echo.

REM Kiểm tra xem tag đã tồn tại chưa (kiểm tra cả local và remote)
set LOCAL_TAG_EXISTS=1
set REMOTE_TAG_EXISTS=1

git tag -l "v!VERSION!" >nul 2>&1
if %errorlevel% equ 0 set LOCAL_TAG_EXISTS=0

REM Kiểm tra trên remote
git ls-remote --tags origin "v!VERSION!" >nul 2>&1
if %errorlevel% equ 0 set REMOTE_TAG_EXISTS=0

if !LOCAL_TAG_EXISTS! equ 0 (
    echo [WARNING] Tag v!VERSION! đã tồn tại trên local!
    set /p CONTINUE="Bạn có muốn tiếp tục? (y/n): "
    if /i not "!CONTINUE!"=="y" (
        echo [INFO] Đã hủy
        pause
        exit /b 0
    )
) else if !REMOTE_TAG_EXISTS! equ 0 (
    echo [WARNING] Tag v!VERSION! đã tồn tại trên remote!
    set /p CONTINUE="Bạn có muốn tiếp tục? (y/n): "
    if /i not "!CONTINUE!"=="y" (
        echo [INFO] Đã hủy
        pause
        exit /b 0
    )
)

REM Kiểm tra GitHub token
if "%GH_TOKEN%"=="" (
    echo [WARNING] Biến môi trường GH_TOKEN chưa được set
    echo [INFO] Đang thử đọc từ file .env.github...
    if exist .env.github (
        for /f "usebackq delims=" %%a in (".env.github") do set GH_TOKEN=%%a
    )
    if "!GH_TOKEN!"=="" (
        echo [ERROR] Vui lòng set GitHub token:
        echo   set GH_TOKEN=your_token_here
        echo   hoặc tạo file .env.github với nội dung là token
        pause
        exit /b 1
    )
)
echo [INFO] GitHub token đã được tìm thấy
echo.

REM Kiểm tra xem có thay đổi chưa commit không
git diff --quiet HEAD
set HAS_CHANGES=%errorlevel%

if !HAS_CHANGES! neq 0 (
    echo [INFO] Phát hiện thay đổi chưa commit
    set /p COMMIT="Bạn có muốn commit và push code? (y/n): "
    if /i "!COMMIT!"=="y" (
        echo.
        echo [INFO] Đang commit code...
        
        REM Thử add từng loại file để tránh lỗi
        git add *.ts *.tsx *.js *.jsx *.json *.md *.bat *.ico 2>nul
        git add src/ electron/ 2>nul
        git add -A 2>nul
        
        REM Kiểm tra xem có file nào được add không
        git diff --cached --quiet
        set HAS_STAGED=%errorlevel%
        
        if !HAS_STAGED! equ 0 (
            echo [WARNING] Không có file nào được add (có thể đã được add trước đó)
        ) else (
            echo [SUCCESS] Đã add files thành công
        )
        
        REM Kiểm tra xem có gì để commit không
        git diff --cached --quiet
        if %errorlevel% equ 0 (
            echo [INFO] Không có thay đổi để commit (có thể đã commit trước đó)
        ) else (
            set /p COMMIT_MSG="Nhập commit message (Enter để dùng mặc định): "
            if "!COMMIT_MSG!"=="" set COMMIT_MSG=Release v!VERSION!
            
            git commit -m "!COMMIT_MSG!"
            set COMMIT_RESULT=%errorlevel%
            if !COMMIT_RESULT! neq 0 (
                echo [ERROR] Lỗi khi commit (error code: !COMMIT_RESULT!)
                pause
                exit /b 1
            )
            echo [SUCCESS] Đã commit thành công
        )
        
        REM Push code lên GitHub
        echo [INFO] Đang push code lên GitHub...
        git push origin main
        set PUSH_RESULT=%errorlevel%
        
        REM Kiểm tra kết quả - errorlevel 0 = thành công
        if !PUSH_RESULT! equ 0 (
            echo [SUCCESS] Đã push code lên GitHub
            echo.
        ) else (
            echo [ERROR] Lỗi khi push code (error code: !PUSH_RESULT!)
            echo [INFO] Kiểm tra:
            echo   - Kết nối mạng có ổn không
            echo   - Quyền truy cập GitHub có đúng không
            echo   - Code đã được commit chưa
            echo.
            echo [WARNING] Tiếp tục với các bước build và publish...
            echo.
        )
    )
)

REM Tạo git tag (chỉ tạo nếu chưa tồn tại)
if !LOCAL_TAG_EXISTS! neq 0 (
    echo [INFO] Đang tạo git tag v!VERSION!...
    git tag -a "v!VERSION!" -m "Release v!VERSION!"
    if %errorlevel% neq 0 (
        echo [WARNING] Không thể tạo tag
    ) else (
        echo [SUCCESS] Đã tạo tag v!VERSION!
    )
) else (
    echo [INFO] Tag v!VERSION! đã tồn tại trên local, bỏ qua tạo tag
)

REM Push tag lên GitHub (chỉ push nếu chưa tồn tại trên remote)
if !REMOTE_TAG_EXISTS! neq 0 (
    echo [INFO] Đang push tag lên GitHub...
    git push origin "v!VERSION!"
    if %errorlevel% neq 0 (
        echo [WARNING] Không thể push tag (có thể đã tồn tại trên remote)
    ) else (
        echo [SUCCESS] Đã push tag lên GitHub
    )
) else (
    echo [INFO] Tag v!VERSION! đã tồn tại trên remote, bỏ qua push tag
)
echo.

REM Build app
echo [INFO] Đang build ứng dụng...
echo [INFO] Điều này có thể mất vài phút...
echo.

REM Build React app
echo [STEP 1/3] Đang build React app...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Lỗi khi build React app
    echo [INFO] Kiểm tra lỗi ở trên để biết chi tiết
    pause
    exit /b 1
)
echo [SUCCESS] Đã build React app
echo.

REM Build Electron
echo [STEP 2/3] Đang build Electron...
call npm run build:electron
if %errorlevel% neq 0 (
    echo [ERROR] Lỗi khi build Electron
    echo [INFO] Kiểm tra lỗi ở trên để biết chi tiết
    pause
    exit /b 1
)
echo [SUCCESS] Đã build Electron
echo.

REM Build và publish với electron-builder
echo [STEP 3/3] Đang build installer và publish lên GitHub...
echo [INFO] Sử dụng GitHub token để publish...
REM Set token cho electron-builder (cần set trước khi chạy)
set GH_TOKEN=!GH_TOKEN!
set GITHUB_TOKEN=!GH_TOKEN!
call npm run build:all
if %errorlevel% neq 0 (
    echo [ERROR] Lỗi khi build hoặc publish
    echo [INFO] Kiểm tra:
    echo   - GitHub token có hợp lệ không
    echo   - Kết nối mạng có ổn không
    echo   - Version đã được tăng chưa
    echo.
    echo [INFO] Có thể thử build không publish: npm run build:all:no-publish
    pause
    exit /b 1
)
echo [SUCCESS] Đã build và publish thành công!
echo.

REM Tóm tắt
echo ========================================
echo   HOÀN TẤT!
echo ========================================
echo.
echo [INFO] Phiên bản: v!VERSION!
echo [INFO] Tag: v!VERSION!
echo [INFO] Release đã được tạo trên GitHub
echo [INFO] File installer: release\Đơn Hàng 360 Setup !VERSION!.exe
echo.
echo [INFO] App sẽ tự động thông báo cập nhật cho người dùng
echo [INFO] Kiểm tra tại: https://github.com/keytration7-star/DonHang_360/releases
echo.
pause
