/**
 * Error handling utilities cho ứng dụng Đơn Hàng 360
 * Cung cấp các hàm xử lý lỗi và retry logic
 */

import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry một async function với exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
        logger.warn(`⚠️ Lỗi (lần thử ${attempt + 1}/${maxRetries + 1}), sẽ thử lại sau ${delay}ms:`, lastError.message);
        
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`❌ Đã thử ${maxRetries + 1} lần nhưng vẫn lỗi:`, lastError);
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Unknown error');
}

/**
 * Tạo user-friendly error message
 */
export function getUserFriendlyError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Firebase errors
    if (message.includes('permission_denied') || message.includes('permission denied')) {
      return 'Lỗi quyền truy cập Firebase. Vui lòng kiểm tra Database Rules trong Firebase Console.';
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại.';
    }
    
    // IndexedDB errors
    if (message.includes('indexeddb') || message.includes('quota')) {
      return 'Lỗi lưu trữ dữ liệu. Vui lòng thử lại hoặc xóa dữ liệu cũ.';
    }
    
    // File errors
    if (message.includes('file') || message.includes('excel')) {
      return 'Lỗi xử lý file Excel. Vui lòng kiểm tra định dạng file và thử lại.';
    }
    
    // Generic error
    return error.message || 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
  }
  
  return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
}

/**
 * Safe async function wrapper với error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    logger.error(errorMessage || 'Lỗi khi thực hiện thao tác:', error);
    return null;
  }
}

/**
 * Safe sync function wrapper với error handling
 */
export function safeSync<T>(
  fn: () => T,
  errorMessage?: string
): T | null {
  try {
    return fn();
  } catch (error) {
    logger.error(errorMessage || 'Lỗi khi thực hiện thao tác:', error);
    return null;
  }
}
