/**
 * AI Module Manager Page
 * Quản lý các AI Modules (tạo, chỉnh sửa, xóa)
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Settings, MessageSquare, Package, Image, X, Save, Copy, FileText, Upload, Facebook, TestTube, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { AIModule, AIProviderConfig } from '../../../shared/types/aiChat';
import { aiChatDatabaseService } from '../../../core/services/aiChat/aiChatDatabaseService';
import { facebookApiService } from '../../../core/services/aiChat/facebookApiService';
import { logger } from '../../../shared/utils/logger';
import { useNavigate } from 'react-router-dom';

const AIModuleManagerPage = () => {
  const navigate = useNavigate();
  const [modules, setModules] = useState<AIModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingModule, setEditingModule] = useState<AIModule | null>(null);
  const [formData, setFormData] = useState<Partial<AIModule>>({
    name: '',
    description: '',
    isActive: true,
    facebookPageId: '',
    facebookPageName: '',
    facebookPageAccessToken: '',
    aiProvider: {
      provider: 'auto',
      autoSelect: true,
      fallbackProvider: 'deepseek',
    },
    products: [],
    media: [],
  });
  const [testingFacebook, setTestingFacebook] = useState(false);
  const [facebookTestResult, setFacebookTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const allModules = await aiChatDatabaseService.getAllModules();
      setModules(allModules);
      logger.log(`✅ Đã load ${allModules.length} AI Modules`);
    } catch (error) {
      logger.error('❌ Lỗi load modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      isActive: true,
      aiProvider: {
        provider: 'auto',
        autoSelect: true,
        fallbackProvider: 'deepseek',
      },
      products: [],
      media: [],
    });
    setEditingModule(null);
    setShowCreateModal(true);
  };

  const handleEdit = (module: AIModule) => {
    setFormData(module);
    setEditingModule(module);
    setShowCreateModal(true);
  };

  const handleDelete = async (moduleId: string) => {
    if (!confirm(`Bạn có chắc muốn xóa module "${modules.find(m => m.id === moduleId)?.name}"?`)) {
      return;
    }

    try {
      await aiChatDatabaseService.deleteModule(moduleId);
      await loadModules();
      logger.log(`✅ Đã xóa module: ${moduleId}`);
    } catch (error) {
      logger.error('❌ Lỗi xóa module:', error);
      alert('Lỗi xóa module: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      alert('Vui lòng nhập tên module');
      return;
    }

    try {
      const now = new Date().toISOString();
      const module: AIModule = {
        id: editingModule?.id || `module_${Date.now()}`,
        name: formData.name,
        description: formData.description,
        facebookPageId: formData.facebookPageId,
        facebookPageName: formData.facebookPageName,
        facebookPageAccessToken: formData.facebookPageAccessToken,
        isActive: formData.isActive ?? true,
        aiProvider: formData.aiProvider || {
          provider: 'auto',
          autoSelect: true,
          fallbackProvider: 'deepseek',
        },
        products: formData.products || [],
        media: formData.media || [],
        trainingData: formData.trainingData,
        createdAt: editingModule?.createdAt || now,
        updatedAt: now,
      };

      await aiChatDatabaseService.saveModule(module);
      await loadModules();
      setShowCreateModal(false);
      setEditingModule(null);
      logger.log(`✅ Đã ${editingModule ? 'cập nhật' : 'tạo'} module: ${module.name}`);
    } catch (error) {
      logger.error('❌ Lỗi lưu module:', error);
      alert('Lỗi lưu module: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingModule(null);
    setFacebookTestResult(null);
    setFormData({
      name: '',
      description: '',
      isActive: true,
      facebookPageId: '',
      facebookPageName: '',
      facebookPageAccessToken: '',
      aiProvider: {
        provider: 'auto',
        autoSelect: true,
        fallbackProvider: 'deepseek',
      },
      products: [],
      media: [],
    });
  };

  const handleTestFacebookConnection = async () => {
    if (!formData.facebookPageId || !formData.facebookPageAccessToken) {
      alert('Vui lòng nhập Page ID và Access Token trước khi test');
      return;
    }

    try {
      setTestingFacebook(true);
      setFacebookTestResult(null);

      facebookApiService.initialize(formData.facebookPageId!, formData.facebookPageAccessToken!);
      const result = await facebookApiService.testConnection();

      setFacebookTestResult(result);
      
      // Nếu thành công, cập nhật Page Name
      if (result.success && result.pageInfo) {
        setFormData(prev => ({
          ...prev,
          facebookPageName: result.pageInfo!.name,
        }));
      }
    } catch (error) {
      setFacebookTestResult({
        success: false,
        message: 'Lỗi: ' + (error instanceof Error ? error.message : 'Unknown error'),
      });
    } finally {
      setTestingFacebook(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Quản lý AI Chat Modules
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Tạo và quản lý các module AI Chat cho từng Facebook Page
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus size={20} className="mr-2" />
          Tạo Module Mới
        </button>
      </div>

      {/* Modules List */}
      {modules.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Chưa có AI Module nào</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus size={20} className="mr-2" />
            Tạo Module Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <div
              key={module.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {module.name}
                  </h3>
                  {module.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {module.description}
                    </p>
                  )}
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  module.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {module.isActive ? 'Hoạt động' : 'Tạm dừng'}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {module.facebookPageName && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <MessageSquare size={16} className="mr-2" />
                    {module.facebookPageName}
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Settings size={16} className="mr-2" />
                  AI: {module.aiProvider.provider === 'auto' ? 'Tự động' : module.aiProvider.provider}
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Package size={16} className="mr-2" />
                  {module.products?.length || 0} sản phẩm
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Image size={16} className="mr-2" />
                  {module.media?.length || 0} media
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(module)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <Edit size={16} className="mr-1" />
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(module.id)}
                    className="inline-flex items-center justify-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-200 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/ai-chat/${module.id}/training`)}
                    className="inline-flex items-center justify-center px-2 py-1.5 border border-primary-300 dark:border-primary-600 rounded-md text-xs font-medium text-primary-700 dark:text-primary-200 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                    title="Training Data"
                  >
                    <FileText size={14} className="mr-1" />
                    Training
                  </button>
                  <button
                    onClick={() => navigate(`/ai-chat/${module.id}/conversations`)}
                    className="inline-flex items-center justify-center px-2 py-1.5 border border-primary-300 dark:border-primary-600 rounded-md text-xs font-medium text-primary-700 dark:text-primary-200 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                    title="Test Conversations"
                  >
                    <MessageCircle size={14} className="mr-1" />
                    Test
                  </button>
                  <button
                    onClick={() => navigate(`/ai-chat/${module.id}/products`)}
                    className="inline-flex items-center justify-center px-2 py-1.5 border border-primary-300 dark:border-primary-600 rounded-md text-xs font-medium text-primary-700 dark:text-primary-200 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                    title="Quản lý Sản phẩm"
                  >
                    <Package size={14} className="mr-1" />
                    Products
                  </button>
                  <button
                    onClick={() => navigate(`/ai-chat/${module.id}/media`)}
                    className="inline-flex items-center justify-center px-2 py-1.5 border border-primary-300 dark:border-primary-600 rounded-md text-xs font-medium text-primary-700 dark:text-primary-200 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                    title="Quản lý Media"
                  >
                    <Upload size={14} className="mr-1" />
                    Media
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingModule ? 'Chỉnh sửa Module' : 'Tạo Module Mới'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tên Module *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="VD: Shop Áo Khoác Nữ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Mô tả về module này..."
                />
              </div>

              {/* Facebook Page */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Facebook Page ID
                </label>
                <input
                  type="text"
                  value={formData.facebookPageId || ''}
                  onChange={(e) => setFormData({ ...formData, facebookPageId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="VD: 123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Facebook Page Name
                </label>
                <input
                  type="text"
                  value={formData.facebookPageName || ''}
                  onChange={(e) => setFormData({ ...formData, facebookPageName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="VD: Shop Áo Khoác Nữ"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Facebook Page Access Token
                  </label>
                  <button
                    type="button"
                    onClick={handleTestFacebookConnection}
                    disabled={testingFacebook || !formData.facebookPageId || !formData.facebookPageAccessToken}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-primary-700 dark:text-primary-200 bg-primary-50 dark:bg-primary-900/20 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <TestTube size={14} className="mr-1" />
                    {testingFacebook ? 'Đang test...' : 'Test Connection'}
                  </button>
                </div>
                <input
                  type="password"
                  value={formData.facebookPageAccessToken || ''}
                  onChange={(e) => setFormData({ ...formData, facebookPageAccessToken: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Paste access token..."
                />
                {facebookTestResult && (
                  <div className={`mt-2 p-2 rounded-md text-sm flex items-center gap-2 ${
                    facebookTestResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                  }`}>
                    {facebookTestResult.success ? (
                      <CheckCircle size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{facebookTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* AI Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  AI Provider
                </label>
                <select
                  value={formData.aiProvider?.provider || 'auto'}
                  onChange={(e) => setFormData({
                    ...formData,
                    aiProvider: {
                      ...formData.aiProvider,
                      provider: e.target.value as AIProviderConfig['provider'],
                    } as AIProviderConfig,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="auto">Tự động (ưu tiên free)</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                </select>
              </div>

              {formData.aiProvider?.provider !== 'auto' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={formData.aiProvider?.apiKey || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      aiProvider: {
                        ...formData.aiProvider,
                        apiKey: e.target.value,
                      } as AIProviderConfig,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Paste API key..."
                  />
                </div>
              )}

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive ?? true}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Module đang hoạt động
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  <Save size={16} className="inline mr-2" />
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIModuleManagerPage;

