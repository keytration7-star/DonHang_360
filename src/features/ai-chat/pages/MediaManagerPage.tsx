/**
 * Media Manager Page
 * Upload và quản lý media (images, videos) với metadata
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Image as ImageIcon, Video, Trash2, Edit, Save, X, Search } from 'lucide-react';
import { AIModule, MediaItem, MediaMetadata } from '../../../shared/types/aiChat';
import { aiChatDatabaseService } from '../../../core/services/aiChat/aiChatDatabaseService';
import { mediaManager } from '../../../core/services/aiChat/mediaManager';
import { logger } from '../../../shared/utils/logger';
import { useParams, useNavigate } from 'react-router-dom';

const MediaManagerPage = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [module, setModule] = useState<AIModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [formData, setFormData] = useState<Partial<MediaMetadata>>({
    colors: [],
    productIds: [],
    variants: [],
    features: [],
    tags: [],
    description: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [newColor, setNewColor] = useState('');

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !module) return;

    try {
      const newMediaItems: MediaItem[] = [];

      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
          logger.warn(`⚠️ File không được hỗ trợ: ${file.name}`);
          continue;
        }

        const mediaItem = mediaManager.createMediaItemFromFile(
          file,
          isImage ? 'image' : 'video',
          {
            // Auto-parse colors from filename
            colors: mediaManager.parseColorsFromText(file.name),
          }
        );

        newMediaItems.push(mediaItem);
      }

      const updatedModule: AIModule = {
        ...module,
        media: [...(module.media || []), ...newMediaItems],
        updatedAt: new Date().toISOString(),
      };

      await aiChatDatabaseService.saveModule(updatedModule);
      setModule(updatedModule);
      logger.log(`✅ Đã upload ${newMediaItems.length} media items`);
    } catch (error) {
      logger.error('❌ Lỗi upload media:', error);
      alert('Lỗi upload media: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (mediaId: string) => {
    if (!module) return;

    if (!confirm('Bạn có chắc muốn xóa media này?')) {
      return;
    }

    try {
      const updatedMedia = (module.media || []).filter(m => m.id !== mediaId);
      const updatedModule: AIModule = {
        ...module,
        media: updatedMedia,
        updatedAt: new Date().toISOString(),
      };
      await aiChatDatabaseService.saveModule(updatedModule);
      setModule(updatedModule);
      logger.log(`✅ Đã xóa media: ${mediaId}`);
    } catch (error) {
      logger.error('❌ Lỗi xóa media:', error);
      alert('Lỗi xóa media: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleEdit = (media: MediaItem) => {
    setEditingMedia(media);
    setFormData(media.metadata);
    setNewColor('');
    setShowEditModal(true);
  };

  const handleAddColor = () => {
    if (!newColor.trim()) return;

    setFormData({
      ...formData,
      colors: [...(formData.colors || []), newColor.trim()],
    });
    setNewColor('');
  };

  const handleRemoveColor = (color: string) => {
    setFormData({
      ...formData,
      colors: (formData.colors || []).filter(c => c !== color),
    });
  };

  const handleSaveMetadata = async () => {
    if (!module || !editingMedia) return;

    try {
      const updatedMediaItem = mediaManager.updateMediaMetadata(editingMedia, formData);
      const updatedMedia = (module.media || []).map(m =>
        m.id === editingMedia.id ? updatedMediaItem : m
      );

      const updatedModule: AIModule = {
        ...module,
        media: updatedMedia,
        updatedAt: new Date().toISOString(),
      };

      await aiChatDatabaseService.saveModule(updatedModule);
      setModule(updatedModule);
      setShowEditModal(false);
      setEditingMedia(null);
      logger.log(`✅ Đã cập nhật metadata cho media: ${editingMedia.id}`);
    } catch (error) {
      logger.error('❌ Lỗi lưu metadata:', error);
      alert('Lỗi lưu metadata: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingMedia(null);
    setFormData({
      colors: [],
      productIds: [],
      variants: [],
      features: [],
      tags: [],
      description: '',
    });
    setNewColor('');
  };

  const filteredMedia = module
    ? searchQuery.trim()
      ? mediaManager.findMediaByQuery(module.media || [], searchQuery)
      : module.media || []
    : [];

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
            Quản lý Media - {module.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Upload và quản lý hình ảnh, video với metadata để AI tìm kiếm
          </p>
        </div>
        <label className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 cursor-pointer">
          <Upload size={20} className="mr-2" />
          Upload Media
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo màu sắc, sản phẩm, features..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          {module.media && module.media.length > 0 ? (
            <>
              <Search size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Không tìm thấy media nào với từ khóa "{searchQuery}"
              </p>
            </>
          ) : (
            <>
              <ImageIcon size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">Chưa có media nào</p>
              <label className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 cursor-pointer">
                <Upload size={20} className="mr-2" />
                Upload Media Đầu Tiên
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMedia.map((media) => (
            <div
              key={media.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* Media Preview */}
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-700">
                {media.type === 'image' ? (
                  <img
                    src={media.url}
                    alt={media.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video size={48} className="text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleEdit(media)}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-white text-gray-900 rounded-md text-sm font-medium hover:bg-gray-100 transition-opacity"
                  >
                    <Edit size={16} className="inline mr-1" />
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(media.id)}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-opacity"
                  >
                    <Trash2 size={16} className="inline mr-1" />
                    Xóa
                  </button>
                </div>
              </div>

              {/* Media Info */}
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">
                  {media.fileName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {(media.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
                {media.metadata.colors && media.metadata.colors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {media.metadata.colors.slice(0, 3).map((color, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 text-xs rounded"
                      >
                        {color}
                      </span>
                    ))}
                    {media.metadata.colors.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                        +{media.metadata.colors.length - 3}
                      </span>
                    )}
                  </div>
                )}
                {media.metadata.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {media.metadata.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Metadata Modal */}
      {showEditModal && editingMedia && (
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
                Chỉnh sửa Metadata
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Media Preview */}
              <div className="flex items-center gap-4 mb-4">
                {editingMedia.type === 'image' ? (
                  <img
                    src={editingMedia.url}
                    alt={editingMedia.fileName}
                    className="w-32 h-32 object-cover rounded-md"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center">
                    <Video size={32} className="text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{editingMedia.fileName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(editingMedia.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Màu sắc (cho tìm kiếm "áo xanh" -> gửi ảnh xanh)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddColor()}
                    placeholder="VD: blue, xanh, navy"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={handleAddColor}
                    className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
                  >
                    Thêm
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.colors?.map((color, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 text-sm rounded"
                    >
                      {color}
                      <button
                        onClick={() => handleRemoveColor(color)}
                        className="hover:text-primary-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Mô tả media này..."
                />
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
                  placeholder="VD: áo khoác, chống nước"
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
                  onClick={handleSaveMetadata}
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

export default MediaManagerPage;

