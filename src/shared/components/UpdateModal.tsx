import { Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface UpdateModalProps {
  updateInfo: {
    version: string;
    releaseNotes?: string;
  };
  onDownload: () => void;
  downloading?: boolean;
  downloadProgress?: number;
  downloaded?: boolean;
  onInstall?: () => void;
  downloadError?: string | null;
}

const UpdateModal = ({ 
  updateInfo, 
  onDownload,
  downloading = false,
  downloadProgress = 0,
  downloaded = false,
  onInstall,
  downloadError = null
}: UpdateModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <AlertCircle className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Có bản cập nhật mới</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Phiên bản {updateInfo.version}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Có bản cập nhật mới với các cải tiến và sửa lỗi. Vui lòng tải về và cài đặt để tiếp tục sử dụng.
          </p>
          
          {updateInfo.releaseNotes && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {updateInfo.releaseNotes}
              </p>
            </div>
          )}

          {/* Error */}
          {downloadError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{downloadError}</p>
            </div>
          )}

          {/* Download Progress */}
          {downloading && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Đang tải xuống...</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{Math.round(downloadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, downloadProgress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Downloaded */}
          {downloaded && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Đã tải xuống thành công!
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Nhấn "Cài đặt" để cài đặt cập nhật. Ứng dụng sẽ tự động đóng và mở installer.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {!downloaded ? (
            <button
              onClick={onDownload}
              disabled={downloading || !!downloadError}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {downloading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Đang tải...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Tải về
                </>
              )}
            </button>
          ) : (
            onInstall && (
              <button
                onClick={onInstall}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <RefreshCw size={18} />
                Cài đặt
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
