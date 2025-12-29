import { useState, useEffect } from 'react';
import { Save, Database, Download, Upload, Trash2, Info, X, Settings as SettingsIcon, RefreshCw, CheckCircle } from 'lucide-react';
import { orderService } from '../services/orderService';
import { indexedDBService } from '../services/indexedDBService';

const Settings = () => {
  const [firebaseConfig, setFirebaseConfig] = useState({
    apiKey: localStorage.getItem('firebase_apiKey') || '',
    authDomain: localStorage.getItem('firebase_authDomain') || '',
    databaseURL: localStorage.getItem('firebase_databaseURL') || '',
    projectId: localStorage.getItem('firebase_projectId') || '',
    storageBucket: localStorage.getItem('firebase_storageBucket') || '',
    messagingSenderId: localStorage.getItem('firebase_messagingSenderId') || '',
    appId: localStorage.getItem('firebase_appId') || '',
  });

  const [storageInfo, setStorageInfo] = useState<{ count: number; estimatedSize: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('1.0.1');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');

  useEffect(() => {
    loadStorageInfo();
    // Lấy version từ Electron API nếu có
    if (window.electronAPI) {
      setAppVersion(window.electronAPI.getAppVersion());
    }
  }, []);

  const loadStorageInfo = async () => {
    try {
      const info = await orderService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Lỗi lấy thông tin storage:', error);
    }
  };

  const handleSave = () => {
    Object.entries(firebaseConfig).forEach(([key, value]) => {
      localStorage.setItem(`firebase_${key}`, value);
    });
    alert('Đã lưu cấu hình Firebase! Vui lòng khởi động lại ứng dụng để áp dụng thay đổi.');
    setShowFirebaseModal(false);
  };

  // Kiểm tra xem Firebase đã được cấu hình chưa
  const isFirebaseConfigured = () => {
    return !!(firebaseConfig.apiKey && firebaseConfig.databaseURL);
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const data = await orderService.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donhang360_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Đã xuất dữ liệu thành công!');
    } catch (error) {
      alert('Lỗi xuất dữ liệu: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setLoading(true);
        const text = await file.text();
        const confirm = window.confirm(
          'Bạn có chắc muốn import dữ liệu? Dữ liệu mới sẽ được thêm vào dữ liệu hiện có (không ghi đè).'
        );
        if (!confirm) return;

        const result = await orderService.importData(text);
        alert(
          `Import thành công!\n- Đã import: ${result.imported} đơn hàng\n- Lỗi: ${result.errors} đơn hàng`
        );
        await loadStorageInfo();
        // Reload page để cập nhật dữ liệu
        window.location.reload();
      } catch (error) {
        alert('Lỗi import dữ liệu: ' + (error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    const confirm = window.confirm(
      'CẢNH BÁO: Bạn có chắc muốn xóa TOÀN BỘ dữ liệu? Hành động này không thể hoàn tác!\n\nVui lòng xuất dữ liệu backup trước khi xóa!'
    );
    if (!confirm) return;

    const confirm2 = window.confirm('Bạn thực sự chắc chắn muốn xóa TẤT CẢ dữ liệu?');
    if (!confirm2) return;

    try {
      setLoading(true);
      // Xóa từ IndexedDB
      await indexedDBService.clearAll();
      alert('Đã xóa toàn bộ dữ liệu!');
      await loadStorageInfo();
      window.location.reload();
    } catch (error) {
      alert('Lỗi xóa dữ liệu: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Cài đặt</h1>
      </div>

      {/* Storage Info */}
      {storageInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={20} className="text-blue-600" />
            <h3 className="font-semibold text-blue-800">Thông tin lưu trữ</h3>
          </div>
          <div className="text-sm text-blue-700">
            <p>Tổng số đơn hàng: <strong>{storageInfo.count.toLocaleString()}</strong></p>
            <p>Dung lượng ước tính: <strong>{formatSize(storageInfo.estimatedSize)}</strong></p>
          </div>
        </div>
      )}

      {/* Firebase Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={24} className="text-primary-600" />
            <h2 className="text-xl font-semibold">Cấu hình Firebase (Tùy chọn)</h2>
          </div>
          <button
            onClick={() => setShowFirebaseModal(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 transition-colors"
          >
            <SettingsIcon size={20} />
            {isFirebaseConfigured() ? 'Chỉnh sửa cấu hình' : 'Cấu hình Firebase'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Cấu hình Firebase để đồng bộ dữ liệu giữa các thiết bị. Nếu không cấu hình, dữ liệu sẽ chỉ lưu trên máy tính này.
        </p>
        {isFirebaseConfigured() && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>✓ Firebase đã được cấu hình</strong>
            </p>
            <p className="text-xs text-green-700 mt-1">
              Database URL: {firebaseConfig.databaseURL.substring(0, 50)}...
            </p>
          </div>
        )}
      </div>

      {/* Firebase Configuration Modal */}
      {showFirebaseModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={() => setShowFirebaseModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Database size={24} className="text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-800">Cấu hình Firebase</h2>
              </div>
              <button
                onClick={() => setShowFirebaseModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Hướng dẫn:</strong> Để lấy thông tin cấu hình Firebase, vào Firebase Console → Project Settings → General → Your apps → Web app.
                  Copy các thông tin tương ứng vào các ô bên dưới.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firebaseConfig.apiKey}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, apiKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="AIza..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth Domain</label>
                  <input
                    type="text"
                    value={firebaseConfig.authDomain}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, authDomain: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="your-project.firebaseapp.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firebaseConfig.databaseURL}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, databaseURL: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="https://your-project.firebaseio.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">URL của Firebase Realtime Database</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                  <input
                    type="text"
                    value={firebaseConfig.projectId}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, projectId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="your-project-id"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Storage Bucket</label>
                  <input
                    type="text"
                    value={firebaseConfig.storageBucket}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, storageBucket: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="your-project.appspot.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Messaging Sender ID</label>
                  <input
                    type="text"
                    value={firebaseConfig.messagingSenderId}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, messagingSenderId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App ID</label>
                  <input
                    type="text"
                    value={firebaseConfig.appId}
                    onChange={(e) => setFirebaseConfig({ ...firebaseConfig, appId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="1:123456789:web:abc123"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Lưu ý:</strong> Chỉ cần điền <strong>API Key</strong> và <strong>Database URL</strong> là đủ để sử dụng Firebase Realtime Database.
                    Các trường khác là tùy chọn.
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={handleSave}
                    disabled={!firebaseConfig.apiKey || !firebaseConfig.databaseURL}
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save size={20} />
                    Lưu cấu hình
                  </button>
                  <button
                    onClick={() => setShowFirebaseModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quản lý dữ liệu</h2>
        <p className="text-sm text-gray-600 mb-4">
          Xuất/nhập dữ liệu để sao lưu hoặc chuyển sang máy tính khác.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleExport}
            disabled={loading}
            className="bg-green-500 text-white p-4 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Xuất dữ liệu (Backup)
          </button>

          <button
            onClick={handleImport}
            disabled={loading}
            className="bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload size={20} />
            Nhập dữ liệu (Restore)
          </button>

          <button
            onClick={handleClearAll}
            disabled={loading}
            className="bg-red-500 text-white p-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Trash2 size={20} />
            Xóa toàn bộ dữ liệu
          </button>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Lưu ý:</strong> Dữ liệu được lưu vĩnh viễn trên máy tính này bằng IndexedDB (hỗ trợ lưu trữ lớn, nhanh).
            Bạn có thể xuất dữ liệu để sao lưu hoặc chuyển sang máy tính khác.
          </p>
        </div>
      </div>

      {/* App Version & Update - Compact */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Phiên bản:</span>
            <span className="text-sm font-medium text-gray-800">v{appVersion}</span>
            {updateStatus && (
              <span className={`text-xs ${updateStatus.includes('mới nhất') ? 'text-green-600' : updateStatus.includes('Lỗi') ? 'text-red-600' : 'text-blue-600'}`}>
                {updateStatus.includes('mới nhất') && <CheckCircle size={12} className="inline mr-1" />}
                {updateStatus.length > 30 ? updateStatus.substring(0, 30) + '...' : updateStatus}
              </span>
            )}
          </div>
          {window.electronAPI && (
            <button
              onClick={async () => {
                setCheckingUpdate(true);
                setUpdateStatus('Đang kiểm tra...');
                try {
                  const result = await window.electronAPI!.checkForUpdates();
                  if (result.error) {
                    setUpdateStatus(`Lỗi: ${result.error.substring(0, 50)}`);
                  } else if (result.updateInfo) {
                    setUpdateStatus(`Có cập nhật v${result.updateInfo.version}`);
                  } else {
                    setUpdateStatus('Đã là mới nhất');
                  }
                } catch (error) {
                  setUpdateStatus(`Lỗi: ${error instanceof Error ? error.message.substring(0, 30) : 'Không thể kiểm tra'}`);
                } finally {
                  setCheckingUpdate(false);
                }
              }}
              disabled={checkingUpdate}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={checkingUpdate ? 'animate-spin' : ''} />
              {checkingUpdate ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
