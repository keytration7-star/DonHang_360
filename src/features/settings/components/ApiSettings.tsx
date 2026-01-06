/**
 * API Settings Component
 * Quản lý nhiều Pancake API keys
 */

import { useState, useEffect } from 'react';
import { pancakeConfigService } from '../../../core/services/pancakeConfigService';
import { pancakeApiService } from '../../../core/api/pancakeApiService';
import { PancakeApiConfig } from '../../../shared/types/pancakeApi';
import { logger } from '../../../shared/utils/logger';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Save, 
  X,
  TestTube,
  Key,
  Globe,
  Loader
} from 'lucide-react';

const DEFAULT_BASE_URL = 'https://pos.pages.fm/api/v1';

const ApiSettings = () => {
  const [configs, setConfigs] = useState<PancakeApiConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [key: string]: { success: boolean; message: string } }>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    apiKey: '',
    baseUrl: DEFAULT_BASE_URL,
  });

  // Load configs khi component mount
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = () => {
    const allConfigs = pancakeConfigService.getAllConfigs();
    setConfigs(allConfigs);
    
    // Set active config vào service
    const activeConfig = pancakeConfigService.getActiveConfig();
    if (activeConfig) {
      pancakeApiService.setConfig(activeConfig);
    }
  };

  const handleAdd = () => {
    setShowAddForm(true);
    setFormData({
      name: '',
      apiKey: '',
      baseUrl: DEFAULT_BASE_URL,
    });
  };

  const handleEdit = (config: PancakeApiConfig) => {
    setEditingId(config.id);
    setFormData({
      name: config.name,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
    });
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.apiKey.trim()) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    let isNewConfig = false;
    if (editingId) {
      // Update existing
      const existing = pancakeConfigService.getConfigById(editingId);
      if (existing) {
        const updated: PancakeApiConfig = {
          ...existing,
          name: formData.name.trim(),
          apiKey: formData.apiKey.trim(),
          baseUrl: formData.baseUrl.trim() || DEFAULT_BASE_URL,
        };
        pancakeConfigService.saveConfig(updated);
        logger.log(`✅ Đã cập nhật API config: ${updated.name}`);
      }
      setEditingId(null);
    } else {
      // Create new
      const newConfig = pancakeConfigService.createNewConfig({
        name: formData.name.trim(),
        apiKey: formData.apiKey.trim(),
        baseUrl: formData.baseUrl.trim() || DEFAULT_BASE_URL,
        isActive: false,
      });
      pancakeConfigService.saveConfig(newConfig);
      logger.log(`✅ Đã tạo API config mới: ${newConfig.name}`);
      isNewConfig = true;
    }

    loadConfigs();
    setShowAddForm(false);
    setFormData({
      name: '',
      apiKey: '',
      baseUrl: DEFAULT_BASE_URL,
    });

    // Dispatch event để notify các component khác (OrdersPage) fetch dữ liệu mới
    const event = new CustomEvent('apiConfigUpdated', {
      detail: { isNewConfig, configId: editingId || null }
    });
    window.dispatchEvent(event);
    logger.log('📡 Đã dispatch event apiConfigUpdated');
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      apiKey: '',
      baseUrl: DEFAULT_BASE_URL,
    });
  };

  const handleDelete = (configId: string) => {
    if (confirm('Bạn có chắc muốn xóa API config này?')) {
      pancakeConfigService.deleteConfig(configId);
      loadConfigs();
      logger.log(`✅ Đã xóa API config: ${configId}`);
    }
  };

  const handleSetActive = (configId: string) => {
    pancakeConfigService.setActiveConfig(configId);
    loadConfigs();
    
    // Set vào service
    const activeConfig = pancakeConfigService.getConfigById(configId);
    if (activeConfig) {
      pancakeApiService.setConfig(activeConfig);
      pancakeConfigService.updateLastUsed(configId);
    }
    
    logger.log(`✅ Đã set API config "${activeConfig?.name}" làm active`);
  };

  const handleTest = async (config: PancakeApiConfig) => {
    setTestingId(config.id);
    setTestResult({ ...testResult, [config.id]: { success: false, message: 'Đang test...' } });

    try {
      const result = await pancakeApiService.testConnection(config);
      setTestResult({ ...testResult, [config.id]: result });
      
      if (result.success) {
        logger.log(`✅ Test API "${config.name}" thành công`);
      } else {
        logger.error(`❌ Test API "${config.name}" thất bại: ${result.message}`);
      }
    } catch (error: any) {
      setTestResult({
        ...testResult,
        [config.id]: { success: false, message: error.message || 'Lỗi không xác định' },
      });
    } finally {
      setTestingId(null);
    }
  };

  const activeConfig = pancakeConfigService.getActiveConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cấu hình Pancake API</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Quản lý nhiều API keys để kết nối với Pancake POS
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus size={20} />
          Thêm API
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? 'Chỉnh sửa API' : 'Thêm API mới'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tên API <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ví dụ: API chính, API test"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Nhập API key từ Pancake"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Lấy API key từ: Setting → Advance → Third-party connection → Webhook/API
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder={DEFAULT_BASE_URL}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Mặc định: {DEFAULT_BASE_URL}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
              >
                <Save size={16} />
                Lưu
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
              >
                <X size={16} />
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configs List */}
      <div className="space-y-4">
        {configs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Key className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 dark:text-gray-400">
              Chưa có API config nào. Nhấn "Thêm API" để bắt đầu.
            </p>
          </div>
        ) : (
          configs.map((config) => (
            <div
              key={config.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${
                config.isActive ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {config.name}
                    </h3>
                    {config.isActive && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                        Đang sử dụng
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Globe size={14} />
                      <span>{config.baseUrl || DEFAULT_BASE_URL}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Key size={14} />
                      <span className="font-mono">{config.apiKey.substring(0, 20)}...</span>
                    </div>
                    {config.lastUsedAt && (
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Sử dụng lần cuối: {new Date(config.lastUsedAt).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </div>
                  
                  {/* Test Result */}
                  {testResult[config.id] && (
                    <div className={`mt-3 p-2 rounded-lg flex items-center gap-2 text-sm ${
                      testResult[config.id].success
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    }`}>
                      {testResult[config.id].success ? (
                        <CheckCircle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                      <span>{testResult[config.id].message}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  {!config.isActive && (
                    <button
                      onClick={() => handleSetActive(config.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                      Sử dụng
                    </button>
                  )}
                  <button
                    onClick={() => handleTest(config)}
                    disabled={testingId === config.id}
                    className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm disabled:opacity-50 flex items-center gap-1"
                  >
                    {testingId === config.id ? (
                      <Loader className="animate-spin" size={14} />
                    ) : (
                      <TestTube size={14} />
                    )}
                    Test
                  </button>
                  <button
                    onClick={() => handleEdit(config)}
                    className="px-3 py-1 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Hướng dẫn:</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>Lấy API key từ Pancake: Setting → Advance → Third-party connection → Webhook/API</li>
          <li>Bạn có thể tạo nhiều API config để test hoặc sử dụng nhiều tài khoản</li>
          <li>Chỉ một API config có thể được set làm "Đang sử dụng" tại một thời điểm</li>
          <li>API đang sử dụng sẽ được dùng trong tab "API Test"</li>
        </ul>
      </div>
    </div>
  );
};

export default ApiSettings;

