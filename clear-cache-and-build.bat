@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Clear Cache và Build Lại App
echo ========================================
echo.

echo [INFO] Đang xóa cache và build files...
echo.

REM Xóa thư mục dist
if exist dist (
    echo [INFO] Đang xóa thư mục dist...
    rmdir /s /q dist
    echo [SUCCESS] Đã xóa dist
) else (
    echo [INFO] Không có thư mục dist
)

REM Xóa thư mục dist-electron
if exist dist-electron (
    echo [INFO] Đang xóa thư mục dist-electron...
    rmdir /s /q dist-electron
    echo [SUCCESS] Đã xóa dist-electron
) else (
    echo [INFO] Không có thư mục dist-electron
)

REM Xóa node_modules/.vite cache
if exist node_modules\.vite (
    echo [INFO] Đang xóa Vite cache...
    rmdir /s /q node_modules\.vite
    echo [SUCCESS] Đã xóa Vite cache
)

REM Xóa release files cũ (tùy chọn)
set /p CLEAR_RELEASE="Bạn có muốn xóa file release cũ? (y/n): "
if /i "!CLEAR_RELEASE!"=="y" (
    if exist release\*.exe (
        echo [INFO] Đang xóa file release cũ...
        del /q release\*.exe
        del /q release\*.exe.blockmap
        del /q release\latest.yml
        echo [SUCCESS] Đã xóa file release cũ
    )
)

echo.
echo [INFO] Đang build lại app...
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

echo ========================================
echo   HOÀN TẤT!
echo ========================================
echo.
echo [INFO] Đã clear cache và build lại thành công
echo [INFO] Bây giờ bạn có thể test app hoặc build installer
echo.
pause

