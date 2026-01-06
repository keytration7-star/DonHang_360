@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Kiểm Tra Quyền GitHub Token
echo ========================================
echo.

REM Đọc token từ file .env.github hoặc biến môi trường
set TOKEN=
if "%GH_TOKEN%"=="" (
    echo [INFO] Đang đọc token từ file .env.github...
    if exist .env.github (
        for /f "usebackq delims=" %%a in (".env.github") do set TOKEN=%%a
    ) else (
        echo [ERROR] Không tìm thấy file .env.github
        echo [INFO] Vui lòng tạo file .env.github với nội dung là token
        pause
        exit /b 1
    )
) else (
    set TOKEN=%GH_TOKEN%
)

if "!TOKEN!"=="" (
    echo [ERROR] Không tìm thấy GitHub token
    pause
    exit /b 1
)

echo [INFO] Đang kiểm tra quyền token...
echo [INFO] Token: !TOKEN:~0,15!... (15 ký tự đầu)
echo.

REM Kiểm tra xem có curl không
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Không tìm thấy curl
    echo [INFO] Vui lòng cài đặt curl hoặc kiểm tra token tại: https://github.com/settings/tokens
    pause
    exit /b 1
)

REM Test token với GitHub API - Kiểm tra user info
echo [STEP 1/3] Kiểm tra token hợp lệ...
curl -s -H "Authorization: token !TOKEN!" https://api.github.com/user > temp_user.json 2>nul

findstr /c:"\"login\"" temp_user.json >nul 2>&1
if %errorlevel% neq 0 (
    findstr /c:"Bad credentials" temp_user.json >nul 2>&1
    if %errorlevel% equ 0 (
        echo [ERROR] Token không hợp lệ hoặc hết hạn
        del temp_user.json 2>nul
        pause
        exit /b 1
    ) else (
        echo [ERROR] Không thể xác minh token
        type temp_user.json
        del temp_user.json 2>nul
        pause
        exit /b 1
    )
)

echo [SUCCESS] Token hợp lệ!
type temp_user.json | findstr /c:"\"login\""
type temp_user.json | findstr /c:"\"name\""
del temp_user.json 2>nul
echo.

REM Test quyền repo - Kiểm tra có thể truy cập repository không
echo [STEP 2/3] Kiểm tra quyền truy cập repository...
curl -s -H "Authorization: token !TOKEN!" https://api.github.com/repos/keytration7-star/DonHang_360 > temp_repo.json 2>nul

findstr /c:"\"name\"" temp_repo.json >nul 2>&1
if %errorlevel% neq 0 (
    findstr /c:"Not Found" temp_repo.json >nul 2>&1
    if %errorlevel% equ 0 (
        echo [ERROR] Không tìm thấy repository hoặc không có quyền truy cập
        echo [INFO] Token có thể không có quyền "repo"
    ) else (
        findstr /c:"Bad credentials" temp_repo.json >nul 2>&1
        if %errorlevel% equ 0 (
            echo [ERROR] Token không hợp lệ
        ) else (
            echo [ERROR] Có lỗi khi kiểm tra repository
            type temp_repo.json
        )
    )
    del temp_repo.json 2>nul
    pause
    exit /b 1
)

echo [SUCCESS] Có quyền truy cập repository!
type temp_repo.json | findstr /c:"\"name\""
type temp_repo.json | findstr /c:"\"private\""
del temp_repo.json 2>nul
echo.

REM Test quyền releases - Kiểm tra có thể tạo releases không
echo [STEP 3/3] Kiểm tra quyền releases...
curl -s -H "Authorization: token !TOKEN!" https://api.github.com/repos/keytration7-star/DonHang_360/releases > temp_releases.json 2>nul

findstr /c:"\"tag_name\"" temp_releases.json >nul 2>&1
if %errorlevel% neq 0 (
    findstr /c:"Bad credentials" temp_releases.json >nul 2>&1
    if %errorlevel% equ 0 (
        echo [ERROR] Token không hợp lệ
    ) else (
        findstr /c:"Not Found" temp_releases.json >nul 2>&1
        if %errorlevel% equ 0 (
            echo [WARNING] Không tìm thấy releases (có thể chưa có release nào)
        ) else (
            echo [ERROR] Có lỗi khi kiểm tra releases
            type temp_releases.json
        )
    )
    del temp_releases.json 2>nul
    echo.
    echo [INFO] Token có thể không có quyền "repo" để publish releases
    echo [INFO] Vui lòng tạo token mới với quyền "repo" tại: https://github.com/settings/tokens
    pause
    exit /b 1
)

echo [SUCCESS] Có quyền truy cập releases!
echo [INFO] Số lượng releases: 
findstr /c:"\"tag_name\"" temp_releases.json | find /c /v ""
del temp_releases.json 2>nul
echo.

echo ========================================
echo   KẾT QUẢ
echo ========================================
echo [SUCCESS] Token hợp lệ và có đủ quyền!
echo [INFO] Token có thể sử dụng để publish releases
echo.
pause

