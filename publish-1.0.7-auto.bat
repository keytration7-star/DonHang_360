@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Publish Release 1.0.7 (Auto)
echo ========================================
echo.

REM Set version
set VERSION=1.0.7

REM Kiểm tra GitHub token
if exist .env.github (
    for /f "delims=" %%i in (.env.github) do set GH_TOKEN=%%i
    set GITHUB_TOKEN=!GH_TOKEN!
    echo [INFO] GitHub token đã được tìm thấy
) else (
    if defined GH_TOKEN (
        set GITHUB_TOKEN=%GH_TOKEN%
        echo [INFO] GitHub token từ environment variable
    ) else (
        echo [ERROR] Không tìm thấy GitHub token!
        echo Vui lòng tạo file .env.github hoặc set GH_TOKEN
        pause
        exit /b 1
    )
)

REM Commit và push code
echo [INFO] Đang commit và push code...
git add .
git commit -m "Release v%VERSION% - Cải thiện auto-updater"
if %errorlevel% neq 0 (
    echo [WARNING] Không thể commit (có thể không có thay đổi)
) else (
    echo [SUCCESS] Đã commit
)

git push origin main
if %errorlevel% neq 0 (
    echo [WARNING] Push code có thể có vấn đề, nhưng tiếp tục...
) else (
    echo [SUCCESS] Đã push code
)

REM Tạo và push tag
echo [INFO] Đang tạo tag v%VERSION%...
git tag -f "v%VERSION%" -m "Release v%VERSION%"
git push origin "v%VERSION%" --force
echo [SUCCESS] Đã push tag

REM Build và publish
echo [INFO] Đang build và publish...
echo [INFO] Điều này có thể mất vài phút...

set GH_TOKEN=!GITHUB_TOKEN!
set GITHUB_TOKEN=!GITHUB_TOKEN!

call npm run build:all

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   HOÀN TẤT
    echo ========================================
    echo.
    echo [SUCCESS] Đã publish Release v%VERSION% lên GitHub
    echo [INFO] Kiểm tra tại: https://github.com/keytration7-star/DonHang_360/releases
    echo.
) else (
    echo [ERROR] Build thất bại!
    pause
    exit /b 1
)

pause

