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
for /f "tokens=2 delims=:," %%a in ('findstr /c:"\"version\"" package.json') do (
    set VERSION=%%a
    set VERSION=!VERSION:"=!
    set VERSION=!VERSION: =!
)
echo [INFO] Phiên bản hiện tại: %VERSION%
echo.

REM Kiểm tra xem tag đã tồn tại chưa
git tag -l "v%VERSION%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Tag v%VERSION% đã tồn tại!
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
git diff --quiet
if %errorlevel% neq 0 (
    echo [INFO] Phát hiện thay đổi chưa commit
    set /p COMMIT="Bạn có muốn commit và push code? (y/n): "
    if /i "!COMMIT!"=="y" (
        echo.
        echo [INFO] Đang commit code...
        git add .
        set /p COMMIT_MSG="Nhập commit message (Enter để dùng mặc định): "
        if "!COMMIT_MSG!"=="" set COMMIT_MSG=Release v%VERSION%
        git commit -m "!COMMIT_MSG!"
        if %errorlevel% neq 0 (
            echo [ERROR] Lỗi khi commit
            pause
            exit /b 1
        )
        echo [INFO] Đang push code lên GitHub...
        git push origin main
        if %errorlevel% neq 0 (
            echo [ERROR] Lỗi khi push code
            pause
            exit /b 1
        )
        echo [SUCCESS] Đã push code lên GitHub
        echo.
    )
)

REM Tạo git tag
echo [INFO] Đang tạo git tag v%VERSION%...
git tag -a "v%VERSION%" -m "Release v%VERSION%"
if %errorlevel% neq 0 (
    echo [WARNING] Không thể tạo tag (có thể đã tồn tại)
) else (
    echo [SUCCESS] Đã tạo tag v%VERSION%
)

REM Push tag lên GitHub
echo [INFO] Đang push tag lên GitHub...
git push origin "v%VERSION%"
if %errorlevel% neq 0 (
    echo [WARNING] Không thể push tag (có thể đã tồn tại trên remote)
) else (
    echo [SUCCESS] Đã push tag lên GitHub
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
    pause
    exit /b 1
)
echo [SUCCESS] Đã build Electron
echo.

REM Build và publish với electron-builder
echo [STEP 3/3] Đang build installer và publish lên GitHub...
echo [INFO] Sử dụng GitHub token để publish...
REM Set token cho electron-builder (cần set trước khi chạy)
set GH_TOKEN=%GH_TOKEN%
set GITHUB_TOKEN=%GH_TOKEN%
call npm run build:all
if %errorlevel% neq 0 (
    echo [ERROR] Lỗi khi build hoặc publish
    echo [INFO] Thử build không publish: npm run build:all
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
echo [INFO] Phiên bản: v%VERSION%
echo [INFO] Tag: v%VERSION%
echo [INFO] Release đã được tạo trên GitHub
echo [INFO] File installer: release\DonHang360 Setup %VERSION%.exe
echo.
echo [INFO] App sẽ tự động thông báo cập nhật cho người dùng
echo [INFO] Kiểm tra tại: https://github.com/keytration7-star/DonHang_360/releases
echo.
pause

