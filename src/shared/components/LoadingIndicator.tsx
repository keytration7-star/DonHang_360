/**
 * Loading Indicator Component
 * Hiển thị trạng thái tải dữ liệu với 2 kích thước: nhỏ (compact) và lớn (detailed)
 */

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff, X } from 'lucide-react';
import { useApiOrderStore } from '../../core/store/apiOrderStore';
import { useProgressStore } from '../../core/store/progressStore';

interface LoadingIndicatorProps {
  /** Kích thước: 'compact' (nhỏ, góc màn hình), 'detailed' (lớn, chi tiết), hoặc 'inline' (trong header) */
  variant?: 'compact' | 'detailed' | 'inline';
  /** Vị trí hiển thị (chỉ áp dụng cho compact) */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export default function LoadingIndicator({ 
  variant = 'compact', 
  position = 'top-right' 
}: LoadingIndicatorProps) {
  const { loading, isFetching, error, lastFetchTime, isPolling } = useApiOrderStore();
  const { isActive: progressActive, progress, taskName, current, total, detail } = useProgressStore();
  const [showDetailed, setShowDetailed] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isDetailedOpen, setIsDetailedOpen] = useState(variant === 'detailed');

  // Cập nhật thời gian cập nhật cuối cùng
  useEffect(() => {
    if (lastFetchTime) {
      setLastUpdateTime(new Date(lastFetchTime));
    }
  }, [lastFetchTime]);

  // Lắng nghe event để đóng modal detailed
  useEffect(() => {
    if (variant === 'detailed') {
      const handleClose = () => setIsDetailedOpen(false);
      window.addEventListener('closeLoadingIndicator', handleClose);
      return () => window.removeEventListener('closeLoadingIndicator', handleClose);
    }
  }, [variant]);

  // Tự động mở khi variant='detailed'
  useEffect(() => {
    if (variant === 'detailed') {
      setIsDetailedOpen(true);
    } else {
      setIsDetailedOpen(false);
    }
  }, [variant]);

  // Format thời gian
  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Tính thời gian từ lần cập nhật cuối
  const getTimeSinceUpdate = () => {
    if (!lastUpdateTime) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdateTime.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s trước`;
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    return `${Math.floor(diff / 3600)} giờ trước`;
  };

  // Inline variant - Hiển thị trong header, bên cạnh ngày giờ
  if (variant === 'inline') {
    const isActuallyLoading = loading || isFetching || progressActive;
    
    // Tính toán progress: ưu tiên progressStore, nếu không có thì dùng current/total hoặc indeterminate
    let displayProgress = 0;
    let displayPercent = '0%';
    
    if (progressActive) {
      // Có progress từ progressStore - dùng trực tiếp
      displayProgress = progress;
      displayPercent = `${Math.round(progress)}%`;
    } else if (loading || isFetching) {
      // Đang tải nhưng không có progressStore - tính dựa trên current/total nếu có
      if (current !== undefined && total !== undefined && total > 0) {
        displayProgress = Math.round((current / total) * 100);
        displayPercent = `${displayProgress}%`;
      } else {
        // Không có thông tin progress - hiển thị indeterminate (animation)
        displayProgress = 0;
        displayPercent = '...';
      }
    }
    
    return (
      <div className="flex items-center gap-3">
        {/* Thanh % tải dữ liệu - chỉ hiển thị khi đang tải thật (không phải polling) */}
        {isActuallyLoading && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-[120px]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {progressActive ? (taskName || 'Đang tải...') : 'Đang tải...'}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                  {displayPercent}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                {displayPercent === '...' ? (
                  // Indeterminate progress - animation
                  <div 
                    className="bg-blue-600 dark:bg-blue-400 h-1 rounded-full animate-pulse"
                    style={{ width: '60%' }}
                  />
                ) : (
                  // Determinate progress - hiển thị % thực tế
                  <div 
                    className="bg-blue-600 dark:bg-blue-400 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${displayProgress}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Trạng thái đồng bộ tự động - chỉ hiển thị khi KHÔNG đang tải */}
        {isPolling && !isActuallyLoading && (
          <>
            <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Đồng bộ tự động</span>
          </>
        )}
        
        {/* Trạng thái sẵn sàng - chỉ hiển thị khi không có gì active */}
        {!isActuallyLoading && !isPolling && lastUpdateTime && (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Cập nhật: {formatTime(lastUpdateTime)}
            </span>
          </>
        )}
      </div>
    );
  }

  // Compact variant - Biểu tượng nhỏ ở góc màn hình
  if (variant === 'compact') {
    const positionClasses = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
    };

    // Chỉ hiển thị khi đang loading hoặc có progress
    if (!loading && !progressActive && !isPolling) {
      return null;
    }

    return (
      <div 
        className={`fixed ${positionClasses[position]} z-50 transition-all duration-300`}
        onMouseEnter={() => setShowDetailed(true)}
        onMouseLeave={() => setShowDetailed(false)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            {loading || progressActive ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            ) : isPolling ? (
              <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            )}
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {loading || progressActive ? 'Đang tải...' : isPolling ? 'Đang đồng bộ' : 'Sẵn sàng'}
            </span>
          </div>

          {/* Progress bar nếu có */}
          {progressActive && (
            <div className="mb-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-1">
                <div 
                  className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {taskName && (
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{taskName}</p>
              )}
              {current !== undefined && total !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {current} / {total} đơn
                </p>
              )}
            </div>
          )}

          {/* Status info */}
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            {lastUpdateTime && (
              <div className="flex items-center gap-1">
                <span>Cập nhật:</span>
                <span className="font-mono">{formatTime(lastUpdateTime)}</span>
              </div>
            )}
            {isPolling && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Wifi className="w-3 h-3" />
                <span>Đồng bộ tự động</span>
              </div>
            )}
          </div>

          {/* Error indicator */}
          {error && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <XCircle className="w-3 h-3" />
              <span className="truncate">Lỗi: {error}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Detailed variant - Modal lớn với thông tin chi tiết
  // Chỉ hiển thị khi variant='detailed' và isDetailedOpen=true
  if (variant !== 'detailed' || !isDetailedOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setIsDetailedOpen(false)}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header với nút đóng */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {loading || progressActive ? (
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            ) : error ? (
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {loading || progressActive ? 'Đang tải dữ liệu' : error ? 'Lỗi tải dữ liệu' : 'Tải dữ liệu hoàn tất'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loading || progressActive ? 'Vui lòng đợi...' : error ? error : 'Dữ liệu đã được cập nhật'}
              </p>
            </div>
          </div>
          {/* Nút đóng - luôn hiển thị */}
          <button
            onClick={() => setIsDetailedOpen(false)}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Đóng"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress bar */}
        {progressActive && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{taskName}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div 
                className="bg-blue-600 dark:bg-blue-400 h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${progress}%` }}
              >
                {progress > 10 && (
                  <span className="text-xs text-white font-medium">{progress}%</span>
                )}
              </div>
            </div>
            {current !== undefined && total !== undefined && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Đang xử lý: <span className="font-semibold">{current}</span> / <span className="font-semibold">{total}</span> đơn hàng
              </p>
            )}
            {detail && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{detail}</p>
            )}
          </div>
        )}

        {/* Status details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Trạng thái:</span>
            <span className={`font-medium ${
              loading || progressActive 
                ? 'text-blue-600 dark:text-blue-400' 
                : error 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-green-600 dark:text-green-400'
            }`}>
              {loading || progressActive ? 'Đang tải' : error ? 'Lỗi' : 'Hoàn tất'}
            </span>
          </div>

          {isPolling && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Đồng bộ tự động:</span>
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Wifi className="w-4 h-4" />
                <span className="font-medium">Đang bật</span>
              </div>
            </div>
          )}

          {lastUpdateTime && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cập nhật lần cuối:</span>
              <span className="font-mono text-gray-900 dark:text-white">
                {formatTime(lastUpdateTime)} ({getTimeSinceUpdate()})
              </span>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Lỗi</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!loading && !progressActive && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setIsDetailedOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

