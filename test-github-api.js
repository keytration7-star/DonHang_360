// Script test GitHub API để kiểm tra releases
const https = require('https');

const owner = 'keytration7-star';
const repo = 'DonHang_360';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

console.log('🔍 ========== KIỂM TRA GITHUB API ==========');
console.log('');

// Test 1: Kiểm tra repository
console.log('1️⃣ Kiểm tra Repository:');
testAPI(`https://api.github.com/repos/${owner}/${repo}`, (data) => {
  if (data) {
    console.log('   ✅ Repository tồn tại');
    console.log('      - Name:', data.name);
    console.log('      - Private:', data.private ? '✅ Có (CẦN TOKEN!)' : '❌ Không (Public)');
    console.log('      - Visibility:', data.visibility || 'N/A');
    console.log('');
    
    // Test 2: Kiểm tra releases
    console.log('2️⃣ Kiểm tra Releases:');
    testAPI(`https://api.github.com/repos/${owner}/${repo}/releases`, (releases) => {
      if (releases && Array.isArray(releases)) {
        console.log(`   ✅ Tìm thấy ${releases.length} releases`);
        if (releases.length > 0) {
          console.log('   - Latest release:');
          const latest = releases[0];
          console.log('      - Tag:', latest.tag_name);
          console.log('      - Name:', latest.name);
          console.log('      - Published:', latest.published_at);
          console.log('      - Draft:', latest.draft);
          console.log('      - Prerelease:', latest.prerelease);
          console.log('      - Assets:', latest.assets?.length || 0, 'files');
          
          // Liệt kê assets
          if (latest.assets && latest.assets.length > 0) {
            console.log('      - Files:');
            latest.assets.forEach((asset) => {
              const hasYml = asset.name === 'latest.yml';
              const hasExe = asset.name.includes('.exe');
              console.log(`         ${hasYml ? '✅' : hasExe ? '📦' : '📄'} ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`);
            });
          }
          
          // Kiểm tra latest.yml
          const hasLatestYml = latest.assets?.some((a) => a.name === 'latest.yml');
          if (!hasLatestYml) {
            console.log('      ⚠️ KHÔNG CÓ latest.yml - Đây là vấn đề!');
            console.log('         electron-updater CẦN file này để check updates');
          }
        }
        console.log('');
        
        // Test 3: Kiểm tra latest.yml
        console.log('3️⃣ Kiểm tra file latest.yml:');
        const latestYmlUrl = `https://github.com/${owner}/${repo}/releases/latest/download/latest.yml`;
        testFile(latestYmlUrl, (exists, content) => {
          if (exists) {
            console.log('   ✅ File latest.yml tồn tại');
            console.log('      - URL:', latestYmlUrl);
            if (content) {
              console.log('      - Nội dung (200 ký tự đầu):');
              console.log('        ' + content.substring(0, 200).replace(/\n/g, '\n        '));
            }
          } else {
            console.log('   ❌ File latest.yml KHÔNG tồn tại');
            console.log('      - URL:', latestYmlUrl);
            console.log('      - Nguyên nhân: Release chưa được publish hoặc electron-builder chưa upload');
          }
          console.log('');
          
          // Tóm tắt
          console.log('📋 ========== TÓM TẮT ==========');
          console.log('');
          if (data.private) {
            console.log('⚠️ Repository là PRIVATE');
            console.log('   - Giải pháp: Chuyển sang PUBLIC hoặc thêm token');
          } else {
            console.log('✅ Repository là PUBLIC');
          }
          console.log('');
          if (releases && releases.length > 0) {
            console.log(`✅ Có ${releases.length} releases`);
            const latest = releases[0];
            const hasLatestYml = latest.assets?.some((a) => a.name === 'latest.yml');
            if (hasLatestYml) {
              console.log('✅ Có file latest.yml');
              console.log('   → App CÓ THỂ check được updates');
            } else {
              console.log('❌ KHÔNG có file latest.yml');
              console.log('   → App KHÔNG THỂ check được updates');
              console.log('   → Cần publish release lại với electron-builder');
            }
          } else {
            console.log('❌ KHÔNG có releases');
            console.log('   → App KHÔNG THỂ check được updates');
            console.log('   → Cần publish release');
          }
        });
      }
    });
  } else {
    console.log('   ❌ Repository không tồn tại hoặc không thể truy cập');
    console.log('      - Có thể repository là PRIVATE và không có token');
    console.log('      - Hoặc repository không tồn tại');
  }
});

function testAPI(url, callback) {
  const options = {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'electron-updater-debug'
    }
  };
  
  if (token) {
    options.headers['Authorization'] = `token ${token}`;
  }
  
  https.get(url, options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          callback(JSON.parse(data));
        } catch (e) {
          console.log('   ❌ Lỗi parse JSON:', e.message);
          callback(null);
        }
      } else if (res.statusCode === 404) {
        console.log('   ❌ 404 Not Found');
        callback(null);
      } else {
        console.log(`   ❌ Lỗi ${res.statusCode}:`, res.statusMessage);
        console.log('   - Response:', data.substring(0, 200));
        callback(null);
      }
    });
  }).on('error', (err) => {
    console.log('   ❌ Lỗi kết nối:', err.message);
    callback(null);
  });
}

function testFile(url, callback) {
  https.get(url, (res) => {
    if (res.statusCode === 200) {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        callback(true, data);
      });
    } else if (res.statusCode === 404) {
      callback(false, null);
    } else {
      console.log(`   ❌ Lỗi ${res.statusCode}:`, res.statusMessage);
      callback(false, null);
    }
  }).on('error', (err) => {
    console.log('   ❌ Lỗi kết nối:', err.message);
    callback(false, null);
  });
}

