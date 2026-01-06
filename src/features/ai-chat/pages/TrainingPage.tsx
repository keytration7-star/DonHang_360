/**
 * Training Page
 * Import training form và preview parsed data
 */

import { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, Save, X, CheckCircle, AlertCircle, Eye, Edit } from 'lucide-react';
import { AIModule, ParsedForm } from '../../../shared/types/aiChat';
import { formParserService } from '../../../core/services/aiChat/formParserService';
import { aiChatDatabaseService } from '../../../core/services/aiChat/aiChatDatabaseService';
import { logger } from '../../../shared/utils/logger';
import { useParams, useNavigate } from 'react-router-dom';

const TrainingPage = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<AIModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [formText, setFormText] = useState('');
  const [parsedForm, setParsedForm] = useState<ParsedForm | null>(null);
  const [previewMode, setPreviewMode] = useState<'form' | 'parsed'>('form');
  const [saving, setSaving] = useState(false);

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
      
      // Load existing training data
      if (loadedModule.trainingData?.rawFormText) {
        setFormText(loadedModule.trainingData.rawFormText);
        // Parse lại để preview
        try {
          const parsed = formParserService.parseForm(loadedModule.trainingData.rawFormText);
          setParsedForm(parsed);
        } catch (error) {
          logger.error('Lỗi parse form hiện có:', error);
        }
      }
    } catch (error) {
      logger.error('Lỗi load module:', error);
      alert('Lỗi load module: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFormText(text);
      parseForm(text);
    };
    reader.readAsText(file);
  };

  const parseForm = useCallback((text: string) => {
    try {
      const parsed = formParserService.parseForm(text);
      setParsedForm(parsed);
      setPreviewMode('parsed');
      logger.log('✅ Đã parse form thành công');
    } catch (error) {
      logger.error('❌ Lỗi parse form:', error);
      alert('Lỗi parse form: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, []);

  const handleParse = () => {
    if (!formText.trim()) {
      alert('Vui lòng nhập hoặc upload form');
      return;
    }
    parseForm(formText);
  };

  const handleSave = async () => {
    if (!module || !formText.trim()) {
      alert('Vui lòng nhập form trước khi lưu');
      return;
    }

    if (!parsedForm) {
      alert('Vui lòng parse form trước khi lưu');
      return;
    }

    try {
      setSaving(true);
      const updatedModule: AIModule = {
        ...module,
        trainingData: {
          ...parsedForm,
          rawFormText: formText,
        },
        updatedAt: new Date().toISOString(),
      };

      await aiChatDatabaseService.saveModule(updatedModule);
      setModule(updatedModule);
      logger.log('✅ Đã lưu training data');
      alert('Đã lưu training data thành công!');
    } catch (error) {
      logger.error('❌ Lỗi lưu training data:', error);
      alert('Lỗi lưu: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
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

  if (!module) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
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
            Training Data - {module.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Import và parse training form cho AI Module
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewMode(previewMode === 'form' ? 'parsed' : 'form')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            {previewMode === 'form' ? (
              <>
                <Eye size={16} className="mr-2" />
                Xem Parsed
              </>
            ) : (
              <>
                <Edit size={16} className="mr-2" />
                Xem Form
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !parsedForm}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} className="mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu Training Data'}
          </button>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload Training Form
          </h2>
          <label className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
            <Upload size={16} className="mr-2" />
            Upload File
            <input
              type="file"
              accept=".txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          value={formText}
          onChange={(e) => setFormText(e.target.value)}
          placeholder="Paste hoặc nhập training form ở đây..."
          rows={15}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleParse}
            disabled={!formText.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText size={16} className="mr-2" />
            Parse Form
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {previewMode === 'parsed' && parsedForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Parsed Data Preview
          </h2>

          <div className="space-y-6">
            {/* Product Info */}
            {parsedForm.productInfo && (
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                  Thông tin Sản phẩm
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Tên:</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {parsedForm.productInfo.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Giá:</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {parsedForm.productInfo.price.toLocaleString('vi-VN')} {parsedForm.productInfo.currency}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Mô tả:</span>
                    <p className="text-gray-900 dark:text-white">
                      {parsedForm.productInfo.description || 'N/A'}
                    </p>
                  </div>
                  {parsedForm.productInfo.variants && parsedForm.productInfo.variants.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Variants:</span>
                      <p className="text-gray-900 dark:text-white">
                        {parsedForm.productInfo.variants.join(', ')}
                      </p>
                    </div>
                  )}
                  {parsedForm.productInfo.features && parsedForm.productInfo.features.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Features:</span>
                      <p className="text-gray-900 dark:text-white">
                        {parsedForm.productInfo.features.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sales Flow */}
            {parsedForm.salesFlow && parsedForm.salesFlow.length > 0 && (
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                  Sales Flow ({parsedForm.salesFlow.length} bước)
                </h3>
                <div className="space-y-2">
                  {parsedForm.salesFlow.map((step) => (
                    <div key={step.step} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                          Bước {step.step}:
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{step.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                          {step.triggers && step.triggers.length > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Triggers: {step.triggers.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Communication Style */}
            {parsedForm.communicationStyle && (
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                  Communication Style
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Tone:</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {parsedForm.communicationStyle.tone}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Language:</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {parsedForm.communicationStyle.language}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Use Emojis:</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {parsedForm.communicationStyle.useEmojis ? 'Có' : 'Không'}
                    </p>
                  </div>
                  {parsedForm.communicationStyle.abbreviations && parsedForm.communicationStyle.abbreviations.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Abbreviations:</span>
                      <p className="text-gray-900 dark:text-white">
                        {parsedForm.communicationStyle.abbreviations.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Common Questions */}
            {parsedForm.commonQuestions && parsedForm.commonQuestions.length > 0 && (
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                  Common Questions ({parsedForm.commonQuestions.length})
                </h3>
                <div className="space-y-3">
                  {parsedForm.commonQuestions.map((qa, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">
                        Q: {qa.question}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        A: {qa.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!parsedForm.productInfo && !parsedForm.salesFlow && !parsedForm.communicationStyle && !parsedForm.commonQuestions && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <AlertCircle size={32} className="mx-auto mb-2" />
                <p>Không tìm thấy dữ liệu được parse. Vui lòng kiểm tra lại form.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Message */}
      {module.trainingData && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
          <p className="text-green-800 dark:text-green-200">
            Training data đã được lưu. AI Module đã sẵn sàng sử dụng.
          </p>
        </div>
      )}
    </div>
  );
};

export default TrainingPage;

