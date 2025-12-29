import { useState, useEffect } from 'react';
import { Save, Database, Download, Upload, Trash2, Info } from 'lucide-react';
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

  useEffect(() => {
    loadStorageInfo();
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
    alert('Đã lưu cấu hình Firebase! Vui lòng khởi động lại ứng dụng.');
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
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Database size={24} className="text-primary-600" />
          Cấu hình Firebase (Tùy chọn)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Cấu hình Firebase để đồng bộ dữ liệu giữa các thiết bị. Nếu không cấu hình, dữ liệu sẽ chỉ lưu trên máy tính này.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Database URL</label>
            <input
              type="text"
              value={firebaseConfig.databaseURL}
              onChange={(e) => setFirebaseConfig({ ...firebaseConfig, databaseURL: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://your-project.firebaseio.com"
            />
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

          <button
            onClick={handleSave}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2"
          >
            <Save size={20} />
            Lưu cấu hình
          </button>
        </div>
      </div>

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
    </div>
  );
};

export default Settings;
