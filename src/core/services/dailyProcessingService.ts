import { logger } from '../../shared/utils/logger';

export interface ProcessingHistory {
  orderId: string;
  trackingNumber: string;
  processedDates: string[]; // ISO date strings - các ngày đã xử lý
  lastProcessedDate?: string; // Ngày xử lý gần nhất
  processCount: number; // Số lần đã xử lý
  notes?: string; // Ghi chú khi xử lý
}

class DailyProcessingService {
  private readonly STORAGE_KEY = 'daily_processing_history';

  /**
   * Lấy lịch sử xử lý của một đơn hàng
   */
  getProcessingHistory(orderId: string): ProcessingHistory | undefined {
    try {
      const allHistory = this.getAllHistory();
      return allHistory[orderId];
    } catch (error) {
      logger.error('Lỗi đọc lịch sử xử lý từ localStorage:', error);
      return undefined;
    }
  }

  /**
   * Lấy tất cả lịch sử xử lý
   */
  getAllHistory(): Record<string, ProcessingHistory> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      logger.error('Lỗi đọc lịch sử xử lý từ localStorage:', error);
      return {};
    }
  }

  /**
   * Kiểm tra xem đơn hàng đã được xử lý trong ngày hôm nay chưa
   */
  isProcessedToday(orderId: string): boolean {
    const history = this.getProcessingHistory(orderId);
    if (!history || !history.lastProcessedDate) {
      return false;
    }

    const today = new Date();
    const lastProcessed = new Date(history.lastProcessedDate);
    
    // So sánh ngày (bỏ qua giờ)
    return (
      today.getFullYear() === lastProcessed.getFullYear() &&
      today.getMonth() === lastProcessed.getMonth() &&
      today.getDate() === lastProcessed.getDate()
    );
  }

  /**
   * Đánh dấu đơn hàng đã được xử lý trong ngày hôm nay
   */
  markAsProcessed(orderId: string, trackingNumber: string, note?: string): void {
    try {
      const allHistory = this.getAllHistory();
      const today = new Date().toISOString();
      
      let history = allHistory[orderId];
      if (!history) {
        history = {
          orderId,
          trackingNumber,
          processedDates: [],
          processCount: 0,
        };
      }

      // Chỉ thêm nếu chưa xử lý trong ngày hôm nay
      if (!this.isProcessedToday(orderId)) {
        history.processedDates.push(today);
        history.processCount += 1;
        history.lastProcessedDate = today;
        if (note) {
          history.notes = note;
        }
        
        allHistory[orderId] = history;
        this.saveHistory(allHistory);
        
        // Dispatch custom event để Layout cập nhật badge
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('dailyProcessingUpdated'));
        }
        
        logger.log(`✅ Đã đánh dấu đơn ${trackingNumber} (${orderId}) đã xử lý. Số lần xử lý: ${history.processCount}`);
      } else {
        // Nếu đã xử lý hôm nay, chỉ cập nhật note nếu có
        if (note) {
          history.notes = note;
          allHistory[orderId] = history;
          this.saveHistory(allHistory);
          
          // Dispatch custom event để Layout cập nhật badge
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('dailyProcessingUpdated'));
          }
        }
      }
    } catch (error) {
      logger.error('Lỗi lưu lịch sử xử lý vào localStorage:', error);
    }
  }

  /**
   * Xóa lịch sử xử lý của một đơn hàng (nếu cần reset)
   */
  clearProcessingHistory(orderId: string): void {
    try {
      const allHistory = this.getAllHistory();
      delete allHistory[orderId];
      this.saveHistory(allHistory);
      logger.log(`🗑️ Đã xóa lịch sử xử lý cho đơn ${orderId}`);
    } catch (error) {
      logger.error('Lỗi xóa lịch sử xử lý từ localStorage:', error);
    }
  }

  /**
   * Lưu lịch sử vào localStorage
   */
  private saveHistory(history: Record<string, ProcessingHistory>): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      logger.error('Lỗi lưu lịch sử xử lý vào localStorage:', error);
    }
  }

  /**
   * Lấy số lần xử lý của một đơn hàng
   */
  getProcessCount(orderId: string): number {
    const history = this.getProcessingHistory(orderId);
    return history?.processCount || 0;
  }
}

export const dailyProcessingService = new DailyProcessingService();

