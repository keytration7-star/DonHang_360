@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Kiểm Tra GitHub Token
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
    echo [INFO] Vui lòng set GH_TOKEN hoặc tạo file .env.github
    pause
    exit /b 1
)

echo [INFO] Đang kiểm tra token...
echo.

REM Kiểm tra xem có curl không
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Không tìm thấy curl, không thể test token trực tiếp
    echo [INFO] Token đã được đọc: !TOKEN:~0,10!... (10 ký tự đầu)
    echo [INFO] Vui lòng kiểm tra token tại: https://github.com/settings/tokens
    pause
    exit /b 0
)

REM Test token với GitHub API
echo [INFO] Đang gửi request đến GitHub API...
curl -s -H "Authorization: token !TOKEN!" https://api.github.com/user > temp_token_test.json 2>nul

if %errorlevel% neq 0 (
    echo [ERROR] Không thể kết nối đến GitHub API
    echo [INFO] Kiểm tra kết nối mạng
    del temp_token_test.json 2>nul
    pause
    exit /b 1
)

REM Kiểm tra response
findstr /c:"\"login\"" temp_token_test.json >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Token hợp lệ!
    echo.
    echo [INFO] Thông tin user:
    findstr /c:"\"login\"" temp_token_test.json
    findstr /c:"\"name\"" temp_token_test.json
    echo.
    echo [INFO] Token có thể sử dụng để publish releases
) else (
    findstr /c:"Bad credentials" temp_token_test.json >nul 2>&1
    if %errorlevel% equ 0 (
        echo [ERROR] Token không hợp lệ hoặc hết hạn
        echo [INFO] Vui lòng tạo token mới tại: https://github.com/settings/tokens
        echo [INFO] Đảm bảo token có quyền "repo"
    ) else (
        findstr /c:"message" temp_token_test.json
        echo [ERROR] Có lỗi khi kiểm tra token
    )
)

del temp_token_test.json 2>nul
echo.
pause

