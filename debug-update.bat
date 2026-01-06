@echo off
chcp 65001 >nul
echo ========================================
echo   Debug Auto-Updater
echo ========================================
echo.

echo [INFO] Đang kiểm tra GitHub API và Releases...
echo.

node test-github-api.cjs

echo.
echo ========================================
echo   HOÀN TẤT
echo ========================================
echo.
pause

