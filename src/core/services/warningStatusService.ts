/**
 * Service quản lý trạng thái xử lý cảnh báo đơn hàng
 * Lưu trữ trong localStorage với key: 'warning_statuses'
 */

import { logger } from '../../shared/utils/logger';

export type WarningProcessStatus = 'processed' | 'completed' | 'compensated' | null;

interface WarningStatusData {
  status: WarningProcessStatus;
  note?: string;
  processedAt: string; // ISO date string
}

interface WarningStatuses {
  [orderId: string]: WarningStatusData;
}

const STORAGE_KEY = 'warning_statuses';

class WarningStatusService {
  private statuses: WarningStatuses = {};

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load trạng thái từ localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.statuses = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Lỗi load trạng thái cảnh báo từ localStorage:', error);
      this.statuses = {};
    }
  }

  /**
   * Lưu trạng thái vào localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.statuses));
    } catch (error) {
      logger.error('Lỗi lưu trạng thái cảnh báo vào localStorage:', error);
    }
  }

  /**
   * Lấy trạng thái xử lý của một đơn hàng
   */
  getStatus(orderId: string): WarningStatusData | null {
    return this.statuses[orderId] || null;
  }

  /**
   * Đặt trạng thái xử lý cho một đơn hàng
   */
  setStatus(orderId: string, status: WarningProcessStatus, note?: string): void {
    if (!status) {
      // Xóa trạng thái nếu set null
      delete this.statuses[orderId];
    } else {
      this.statuses[orderId] = {
        status,
        note,
        processedAt: new Date().toISOString(),
      };
    }
    this.saveToStorage();
  }

  /**
   * Xóa trạng thái của một đơn hàng
   */
  removeStatus(orderId: string): void {
    delete this.statuses[orderId];
    this.saveToStorage();
  }

  /**
   * Lấy tất cả các đơn đã xử lý
   */
  getAllProcessedOrders(): Array<{ orderId: string; data: WarningStatusData }> {
    return Object.entries(this.statuses)
      .map(([orderId, data]) => ({ orderId, data }))
      .filter(({ data }) => data.status !== null);
  }

  /**
   * Xóa tất cả trạng thái (reset)
   */
  clearAll(): void {
    this.statuses = {};
    this.saveToStorage();
  }
}

// Export singleton instance
export const warningStatusService = new WarningStatusService();

