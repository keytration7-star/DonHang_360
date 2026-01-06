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

REM Kiểm tra token có hợp lệ không (test với GitHub API)
echo [INFO] Đang kiểm tra GitHub token...
set TOKEN_VALID=0
curl -s -H "Authorization: token !GH_TOKEN!" https://api.github.com/user >nul 2>&1
if %errorlevel% equ 0 (
    set TOKEN_VALID=1
) else (
    REM Thử với format khác
    curl -s -H "Authorization: Bearer !GH_TOKEN!" https://api.github.com/user >nul 2>&1
    if %errorlevel% equ 0 (
        set TOKEN_VALID=1
    )
)

if !TOKEN_VALID! equ 0 (
    echo [WARNING] Không thể xác minh token (có thể do không có curl hoặc token không hợp lệ)
    echo [INFO] Sẽ tiếp tục với token hiện tại, nếu lỗi 401 thì token không hợp lệ
    echo.
) else (
    echo [SUCCESS] GitHub token hợp lệ
    echo.
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

REM Xóa file exe cũ trong thư mục release (đảm bảo chỉ có file mới nhất)
echo [INFO] Đang xóa file exe cũ trong thư mục release...
if exist release\*.exe (
    del /q release\*.exe
    echo [SUCCESS] Đã xóa file exe cũ
) else (
    echo [INFO] Không có file exe cũ để xóa
)
if exist release\*.exe.blockmap (
    del /q release\*.exe.blockmap
    echo [SUCCESS] Đã xóa file blockmap cũ
)
if exist release\latest.yml (
    del /q release\latest.yml
    echo [SUCCESS] Đã xóa file latest.yml cũ
)
echo.
if exist release\*.exe (
    del /q release\*.exe
    echo [SUCCESS] Đã xóa file exe cũ
) else (
    echo [INFO] Không có file exe cũ để xóa
)
if exist release\*.exe.blockmap (
    del /q release\*.exe.blockmap
    echo [SUCCESS] Đã xóa file blockmap cũ
)
if exist release\latest.yml (
    del /q release\latest.yml
    echo [SUCCESS] Đã xóa file latest.yml cũ
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

REM Xóa file exe cũ trong thư mục release trước khi build mới (đảm bảo chỉ có file mới nhất)
echo [INFO] Đang xóa file exe cũ trong thư mục release trước khi build...
if exist release\*.exe (
    del /q release\*.exe
    echo [SUCCESS] Đã xóa file exe cũ
)
if exist release\*.exe.blockmap (
    del /q release\*.exe.blockmap
    echo [SUCCESS] Đã xóa file blockmap cũ
)
if exist release\latest.yml (
    del /q release\latest.yml
    echo [SUCCESS] Đã xóa file latest.yml cũ
)
echo.

REM Build và publish với electron-builder
echo [STEP 3/3] Đang build installer và publish lên GitHub...
echo [INFO] Sử dụng GitHub token để publish...
echo [INFO] Token: !GH_TOKEN:~0,10!... (10 ký tự đầu)

REM Set token cho electron-builder (cần set trước khi chạy)
REM electron-builder sử dụng GH_TOKEN hoặc GITHUB_TOKEN từ environment
set GH_TOKEN=!GH_TOKEN!
set GITHUB_TOKEN=!GH_TOKEN!

REM Export token cho npm (cần thiết cho electron-builder)
set "npm_config_gh_token=!GH_TOKEN!"
set "npm_config_github_token=!GH_TOKEN!"

REM Đảm bảo token được truyền vào npm process
REM electron-builder đọc token từ environment variables GH_TOKEN hoặc GITHUB_TOKEN
REM QUAN TRỌNG: Phải set trước khi gọi npm, và phải được export để npm process con nhận được
echo [INFO] Đang build với electron-builder...
echo [INFO] Environment variables đã được set: GH_TOKEN, GITHUB_TOKEN
echo [INFO] Token: !GH_TOKEN:~0,15!... (15 ký tự đầu)

REM Gọi electron-builder trực tiếp với token đã được set trong environment
REM (Đã build ở trên rồi, không cần build lại)
echo [INFO] Đang build installer và publish với electron-builder...
echo [INFO] Token đã được set trong environment: GH_TOKEN, GITHUB_TOKEN
call npx electron-builder --publish always
set BUILD_RESULT=%errorlevel%

REM Kiểm tra xem release đã được tạo trên GitHub chưa (kiểm tra thực tế thay vì chỉ dựa vào errorlevel)
echo.
echo [INFO] Đang kiểm tra xem release đã được tạo trên GitHub chưa...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    REM Sử dụng curl để kiểm tra release
    for /f "delims=" %%a in ('curl -s -H "Authorization: token !GH_TOKEN!" https://api.github.com/repos/keytration7-star/DonHang_360/releases/tags/v!VERSION!') do (
        echo %%a | findstr /c:"tag_name" >nul
        if %errorlevel% equ 0 (
            echo [SUCCESS] Release v!VERSION! đã được tạo thành công trên GitHub!
            set RELEASE_EXISTS=1
        ) else (
            set RELEASE_EXISTS=0
        )
    )
) else (
    REM Nếu không có curl, chỉ dựa vào errorlevel
    if !BUILD_RESULT! equ 0 (
        set RELEASE_EXISTS=1
    ) else (
        set RELEASE_EXISTS=0
    )
)

REM Nếu release đã tồn tại trên GitHub, coi như thành công
if !RELEASE_EXISTS! equ 1 (
    echo [SUCCESS] Đã build và publish thành công!
    echo.
    goto :publish_success
)

REM Nếu errorlevel khác 0 và release chưa tồn tại, mới báo lỗi
if !BUILD_RESULT! neq 0 (
    echo.
    echo [ERROR] Lỗi khi build hoặc publish
    echo.
    echo [INFO] Nguyên nhân có thể:
    echo   1. GitHub token không hợp lệ hoặc hết hạn (lỗi 401)
    echo   2. Token không có quyền "repo" để publish releases
    echo   3. Kết nối mạng có vấn đề
    echo   4. Version đã tồn tại trên GitHub Releases
    echo.
    echo [INFO] Cách khắc phục:
    echo   1. Tạo token mới tại: https://github.com/settings/tokens
    echo      - Chọn quyền "repo" (full control of private repositories)
    echo      - Copy token và cập nhật vào file .env.github
    echo   2. Kiểm tra token có quyền "repo" không
    echo   3. Kiểm tra kết nối mạng
    echo   4. Kiểm tra version đã tồn tại tại: https://github.com/keytration7-star/DonHang_360/releases
    echo.
    echo [INFO] Có thể thử build không publish: npm run build:all:no-publish
    echo [INFO] File installer vẫn được tạo tại: release\Đơn Hàng 360 Setup !VERSION!.exe
    echo.
    pause
    exit /b 1
)

:publish_success
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
