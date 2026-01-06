/**
 * Product Manager Page
 * Quản lý sản phẩm cho AI Module
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Save, X, Package } from 'lucide-react';
import { AIModule, Product, ProductVariant } from '../../../shared/types/aiChat';
import { aiChatDatabaseService } from '../../../core/services/aiChat/aiChatDatabaseService';
import { logger } from '../../../shared/utils/logger';
import { useParams, useNavigate } from 'react-router-dom';

const ProductManagerPage = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<AIModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    currency: 'VND',
    variants: [],
    features: [],
    tags: [],
    category: '',
  });
  const [newVariant, setNewVariant] = useState({ name: '', value: '', price: '' });

  useEffect(() => {
    if (moduleId) {
      loadModule();
    }
  }, [moduleId]);

  const loadModule = async () => {
    if (!moduleId) return;

    try {
      setLoading(true);
      const loadedModule = await aiChatDatabaseService.getModule(moduleId);
      if (!loadedModule) {
        alert('Module không tồn tại');
        navigate('/ai-chat');
        return;
      }
      setModule(loadedModule);
    } catch (error) {
      logger.error('Lỗi load module:', error);
      alert('Lỗi load module: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      currency: 'VND',
      variants: [],
      features: [],
      tags: [],
      category: '',
    });
    setEditingProduct(null);
    setNewVariant({ name: '', value: '', price: '' });
    setShowCreateModal(true);
  };

  const handleEdit = (product: Product) => {
    setFormData(product);
    setEditingProduct(product);
    setNewVariant({ name: '', value: '', price: '' });
    setShowCreateModal(true);
  };

  const handleDelete = async (productId: string) => {
    if (!module) return;

    if (!confirm(`Bạn có chắc muốn xóa sản phẩm "${module.products?.find(p => p.id === productId)?.name}"?`)) {
      return;
    }

    try {
      const updatedProducts = (module.products || []).filter(p => p.id !== productId);
      const updatedModule: AIModule = {
        ...module,
        products: updatedProducts,
        updatedAt: new Date().toISOString(),
      };
      await aiChatDatabaseService.saveModule(updatedModule);
      setModule(updatedModule);
      logger.log(`✅ Đã xóa sản phẩm: ${productId}`);
    } catch (error) {
      logger.error('❌ Lỗi xóa sản phẩm:', error);
      alert('Lỗi xóa sản phẩm: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleAddVariant = () => {
    if (!newVariant.name || !newVariant.value) {
      alert('Vui lòng nhập tên và giá trị variant');
      return;
    }

    const variant: ProductVariant = {
      id: `variant_${Date.now()}`,
      name: newVariant.name,
      value: newVariant.value,
      price: newVariant.price ? parseFloat(newVariant.price) : undefined,
    };

    setFormData({
      ...formData,
      variants: [...(formData.variants || []), variant],
    });
    setNewVariant({ name: '', value: '', price: '' });
  };

  const handleRemoveVariant = (variantId: string) => {
    setFormData({
      ...formData,
      variants: (formData.variants || []).filter(v => v.id !== variantId),
    });
  };

  const handleSave = async () => {
    if (!module) return;

    if (!formData.name?.trim()) {
      alert('Vui lòng nhập tên sản phẩm');
      return;
    }

    try {
      const now = new Date().toISOString();
      const product: Product = {
        id: editingProduct?.id || `product_${Date.now()}`,
        name: formData.name,
        description: formData.description,
        price: formData.price || 0,
        currency: formData.currency || 'VND',
        variants: formData.variants || [],
        features: formData.features || [],
        tags: formData.tags || [],
        category: formData.category,
        createdAt: editingProduct?.createdAt || now,
        updatedAt: now,
      };

      const existingProducts = module.products || [];
      const updatedProducts = editingProduct
        ? existingProducts.map(p => p.id === editingProduct.id ? product : p)
        : [...existingProducts, product];

      const updatedModule: AIModule = {
        ...module,
        products: updatedProducts,
        updatedAt: now,
      };

      await aiChatDatabaseService.saveModule(updatedModule);
      setModule(updatedModule);
      setShowCreateModal(false);
      setEditingProduct(null);
      logger.log(`✅ Đã ${editingProduct ? 'cập nhật' : 'tạo'} sản phẩm: ${product.name}`);
    } catch (error) {
      logger.error('❌ Lỗi lưu sản phẩm:', error);
      alert('Lỗi lưu sản phẩm: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      currency: 'VND',
      variants: [],
      features: [],
      tags: [],
      category: '',
    });
    setNewVariant({ name: '', value: '', price: '' });
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

  if (!module) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Module không tồn tại</p>
          <button
            onClick={() => navigate('/ai-chat')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const products = module.products || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/ai-chat')}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-2"
          >
            ← Quay lại
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Quản lý Sản phẩm - {module.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Thêm và quản lý sản phẩm cho AI Module
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus size={20} className="mr-2" />
          Thêm Sản phẩm
        </button>
      </div>

      {/* Products List */}
      {products.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Chưa có sản phẩm nào</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus size={20} className="mr-2" />
            Thêm Sản phẩm Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                      {product.description}
                    </p>
                  )}
                  <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {product.price.toLocaleString('vi-VN')} {product.currency}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {product.variants && product.variants.length > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Variants:</span> {product.variants.length}
                  </div>
                )}
                {product.features && product.features.length > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Features:</span> {product.features.length}
                  </div>
                )}
                {product.category && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Category:</span> {product.category}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(product)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <Edit size={16} className="mr-1" />
                  Sửa
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="inline-flex items-center justify-center px-3 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-200 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} />
                </button>
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
                {editingProduct ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm Mới'}
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
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="VD: Áo khoác nữ"
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
                  placeholder="Mô tả sản phẩm..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Giá *
                  </label>
                  <input
                    type="number"
                    value={formData.price || 0}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Đơn vị tiền tệ
                  </label>
                  <select
                    value={formData.currency || 'VND'}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="VD: Áo khoác"
                />
              </div>

              {/* Variants */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Variants
                </label>
                <div className="space-y-2 mb-2">
                  {formData.variants?.map((variant) => (
                    <div key={variant.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
                      <span className="flex-1 text-sm text-gray-900 dark:text-white">
                        {variant.name}: {variant.value}
                        {variant.price && ` (${variant.price.toLocaleString('vi-VN')} ${formData.currency})`}
                      </span>
                      <button
                        onClick={() => handleRemoveVariant(variant.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVariant.name}
                    onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                    placeholder="Tên variant (VD: Màu)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <input
                    type="text"
                    value={newVariant.value}
                    onChange={(e) => setNewVariant({ ...newVariant, value: e.target.value })}
                    placeholder="Giá trị (VD: Xanh)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <input
                    type="number"
                    value={newVariant.price}
                    onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                    placeholder="Giá (tùy chọn)"
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={handleAddVariant}
                    className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Features (phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={formData.features?.join(', ') || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    features: e.target.value.split(',').map(f => f.trim()).filter(f => f.length > 0),
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="VD: Chống nước, Có mũ, Có túi"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tags (phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t.length > 0),
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="VD: hot, new, sale"
                />
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

export default ProductManagerPage;

