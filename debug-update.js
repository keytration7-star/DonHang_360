// Script debug để kiểm tra auto-updater
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Mock app.getVersion() nếu chạy standalone
if (!app) {
  const packageJson = require('./package.json');
  global.app = {
    getVersion: () => packageJson.version,
    getName: () => packageJson.name,
  };
}

async function debugAutoUpdater() {
  console.log('🔍 ========== DEBUG AUTO-UPDATER ==========');
  console.log('');
  
  // 1. Kiểm tra version
  console.log('1️⃣ Kiểm tra Version:');
  const currentVersion = app.getVersion();
  console.log('   - Version hiện tại:', currentVersion);
  console.log('   - App name:', app.getName());
  console.log('');
  
  // 2. Kiểm tra electron-updater
  console.log('2️⃣ Kiểm tra electron-updater:');
  try {
    const electronUpdater = require('electron-updater');
    const autoUpdater = electronUpdater.autoUpdater;
    console.log('   ✅ electron-updater đã được load');
    console.log('   - Version:', electronUpdater.version || 'N/A');
    console.log('');
    
    // 3. Kiểm tra feed URL
    console.log('3️⃣ Kiểm tra Feed URL:');
    try {
      // @ts-ignore
      const feedURL = autoUpdater.getFeedURL?.();
      console.log('   - Feed URL:', feedURL || 'Không thể lấy');
    } catch (e) {
      console.log('   ⚠️ Không thể lấy feed URL:', e.message);
    }
    console.log('');
    
    // 4. Cấu hình feed URL
    console.log('4️⃣ Cấu hình Feed URL:');
    const githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    const feedConfig = {
      provider: 'github',
      owner: 'keytration7-star',
      repo: 'DonHang_360',
    };
    if (githubToken) {
      feedConfig.token = githubToken;
      console.log('   ✅ Đã thêm GitHub token');
    } else {
      console.log('   ⚠️ Không có GitHub token');
    }
    
    try {
      // @ts-ignore
      autoUpdater.setFeedURL(feedConfig);
      console.log('   ✅ Đã setFeedURL thành công');
    } catch (e) {
      console.log('   ❌ Lỗi setFeedURL:', e.message);
    }
    console.log('');
    
    // 5. Kiểm tra GitHub API
    console.log('5️⃣ Kiểm tra GitHub API:');
    const https = require('https');
    const url = 'https://api.github.com/repos/keytration7-star/DonHang_360/releases/latest';
    
    await new Promise((resolve, reject) => {
      const options = {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'electron-updater-debug'
        }
      };
      
      if (githubToken) {
        options.headers['Authorization'] = `token ${githubToken}`;
      }
      
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(data);
              console.log('   ✅ Tìm thấy latest release:');
              console.log('      - Tag:', release.tag_name);
              console.log('      - Name:', release.name);
              console.log('      - Published:', release.published_at);
              console.log('      - Draft:', release.draft);
              console.log('      - Prerelease:', release.prerelease);
              console.log('      - Assets:', release.assets?.length || 0, 'files');
              
              // Kiểm tra latest.yml
              const hasLatestYml = release.assets?.some((a: any) => a.name === 'latest.yml');
              console.log('      - Có latest.yml:', hasLatestYml ? '✅ Có' : '❌ Không');
              
              // Kiểm tra exe
              const hasExe = release.assets?.some((a: any) => a.name.includes('.exe'));
              console.log('      - Có file exe:', hasExe ? '✅ Có' : '❌ Không');
              
              resolve(release);
            } catch (e) {
              console.log('   ❌ Lỗi parse JSON:', e.message);
              resolve(null);
            }
          } else if (res.statusCode === 404) {
            console.log('   ❌ 404 Not Found - Release không tồn tại');
            console.log('      - Có thể:');
            console.log('        1. Repository là PRIVATE');
            console.log('        2. Release chưa được tạo');
            console.log('        3. Repository không tồn tại');
            resolve(null);
          } else {
            console.log('   ❌ Lỗi:', res.statusCode, res.statusMessage);
            console.log('      - Response:', data.substring(0, 200));
            resolve(null);
          }
        });
      }).on('error', (err) => {
        console.log('   ❌ Lỗi kết nối:', err.message);
        resolve(null);
      });
    });
    console.log('');
    
    // 6. Kiểm tra latest.yml
    console.log('6️⃣ Kiểm tra file latest.yml:');
    const latestYmlUrl = 'https://github.com/keytration7-star/DonHang_360/releases/latest/download/latest.yml';
    
    await new Promise((resolve) => {
      https.get(latestYmlUrl, (res) => {
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            console.log('   ✅ File latest.yml tồn tại');
            console.log('      - Nội dung (100 ký tự đầu):', data.substring(0, 100));
            resolve(null);
          });
        } else if (res.statusCode === 404) {
          console.log('   ❌ File latest.yml không tồn tại (404)');
          console.log('      - URL:', latestYmlUrl);
          console.log('      - Nguyên nhân: Release chưa được publish hoặc electron-builder chưa upload');
          resolve(null);
        } else {
          console.log('   ❌ Lỗi:', res.statusCode, res.statusMessage);
          resolve(null);
        }
      }).on('error', (err) => {
        console.log('   ❌ Lỗi kết nối:', err.message);
        resolve(null);
      });
    });
    console.log('');
    
    // 7. Test checkForUpdates
    console.log('7️⃣ Test checkForUpdates:');
    console.log('   - Đang gọi autoUpdater.checkForUpdates()...');
    
    // Setup event handlers
    autoUpdater.on('checking-for-update', () => {
      console.log('   📡 Event: checking-for-update');
    });
    
    autoUpdater.on('update-available', (info) => {
      console.log('   ✅ Event: update-available');
      console.log('      - Version:', info.version);
      console.log('      - Info:', JSON.stringify(info, null, 2));
    });
    
    autoUpdater.on('update-not-available', (info) => {
      console.log('   ℹ️ Event: update-not-available');
      console.log('      - Info:', JSON.stringify(info, null, 2));
    });
    
    autoUpdater.on('error', (err) => {
      console.log('   ❌ Event: error');
      console.log('      - Error:', err.message);
      console.log('      - Stack:', err.stack);
    });
    
    try {
      const result = await autoUpdater.checkForUpdates();
      console.log('   ✅ checkForUpdates() hoàn thành');
      console.log('      - Result:', JSON.stringify(result, null, 2));
    } catch (err) {
      console.log('   ❌ Lỗi checkForUpdates():', err.message);
      console.log('      - Stack:', err.stack);
    }
    console.log('');
    
    console.log('✅ ========== HOÀN TẤT DEBUG ==========');
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
    console.error('   - Message:', error.message);
    console.error('   - Stack:', error.stack);
  }
}

// Chạy debug
if (require.main === module) {
  debugAutoUpdater().then(() => {
    console.log('\nNhấn Ctrl+C để thoát...');
    // Giữ process chạy để xem kết quả
    setTimeout(() => process.exit(0), 5000);
  }).catch(err => {
    console.error('Lỗi:', err);
    process.exit(1);
  });
}

module.exports = { debugAutoUpdater };

