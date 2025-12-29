import { Order, OrderStatus } from '../types/order';
import { firebaseService } from './firebaseService';
import { indexedDBService } from './indexedDBService';
import { localStorageService } from './localStorageService';

class OrderService {
  private useFirebase(): boolean {
    // Kiểm tra xem Firebase đã được cấu hình chưa
    const apiKey = localStorage.getItem('firebase_apiKey') || import.meta.env.VITE_FIREBASE_API_KEY;
    const databaseURL = localStorage.getItem('firebase_databaseURL') || import.meta.env.VITE_FIREBASE_DATABASE_URL;
    return !!(apiKey && databaseURL);
  }

  // Migrate từ localStorage sang IndexedDB nếu cần
  private async migrateFromLocalStorage(): Promise<void> {
    try {
      const localOrders = await localStorageService.getOrders();
      if (localOrders.length > 0) {
        const indexedOrders = await indexedDBService.getOrders();
        if (indexedOrders.length === 0) {
          // Chỉ migrate nếu IndexedDB trống
          console.log('Đang chuyển dữ liệu từ localStorage sang IndexedDB...');
          await indexedDBService.addOrders(localOrders);
          console.log(`Đã chuyển ${localOrders.length} đơn hàng sang IndexedDB`);
        }
      }
    } catch (error) {
      console.warn('Lỗi migrate dữ liệu:', error);
    }
  }

  async getAllOrders(): Promise<Order[]> {
    // Migrate từ localStorage nếu cần (chỉ 1 lần)
    await this.migrateFromLocalStorage();
    
    // Ưu tiên IndexedDB (nhanh hơn, lưu trữ lớn hơn)
    let orders: Order[] = [];
    try {
      orders = await indexedDBService.getOrders();
    } catch (error) {
      console.warn('Lỗi lấy dữ liệu từ IndexedDB, thử localStorage:', error);
      try {
        orders = await localStorageService.getOrders();
      } catch (localError) {
        console.error('Lỗi lấy dữ liệu từ localStorage:', localError);
      }
    }

    // Nếu có Firebase và có dữ liệu trên Firebase, merge
    if (this.useFirebase() && orders.length === 0) {
      try {
        const firebaseOrders = await firebaseService.getOrders();
        if (firebaseOrders.length > 0) {
          await indexedDBService.addOrders(firebaseOrders);
          return firebaseOrders;
        }
      } catch (error) {
        console.warn('Lỗi lấy dữ liệu từ Firebase:', error);
      }
    }

    return orders;
  }

  async addOrders(orders: Order[]): Promise<{ saved: number; updated: number; errors: number; duplicateCount: number }> {
    // Luôn lưu vào IndexedDB trước (chính)
    let result = { saved: 0, updated: 0, errors: 0, duplicateCount: 0 };
    try {
      result = await indexedDBService.addOrders(orders);
    } catch (error) {
      console.warn('Lỗi lưu vào IndexedDB, thử localStorage:', error);
      // Fallback về localStorage nếu IndexedDB lỗi
      try {
        await localStorageService.addOrders(orders);
        result = { saved: orders.length, updated: 0, errors: 0, duplicateCount: 0 };
      } catch (localError) {
        result = { saved: 0, updated: 0, errors: orders.length, duplicateCount: 0 };
      }
    }
    
    // Nếu có Firebase, đồng bộ lên Firebase (song song)
    if (this.useFirebase()) {
      try {
        await firebaseService.addOrders(orders);
      } catch (error) {
        console.warn('Lỗi đồng bộ lên Firebase, dữ liệu đã được lưu local:', error);
      }
    }
    
    return result;
  }

  // Kiểm tra đơn trùng trước khi import
  async checkDuplicates(trackingNumbers: string[]): Promise<{ existing: string[]; new: string[] }> {
    return indexedDBService.checkDuplicates(trackingNumbers);
  }

  async updateOrderStatus(trackingNumber: string, status: OrderStatus): Promise<void> {
    // Cập nhật IndexedDB trước
    try {
      await indexedDBService.updateOrderStatus(trackingNumber, status);
    } catch (error) {
      console.warn('Lỗi cập nhật IndexedDB, thử localStorage:', error);
      await localStorageService.updateOrderStatus(trackingNumber, status);
    }
    
    // Nếu có Firebase, đồng bộ lên Firebase
    if (this.useFirebase()) {
      try {
        await firebaseService.updateOrderStatus(trackingNumber, status);
      } catch (error) {
        console.warn('Lỗi đồng bộ lên Firebase:', error);
      }
    }
  }

  async updateOrdersStatus(trackingNumbers: string[], status: OrderStatus): Promise<void> {
    // Cập nhật IndexedDB trước
    try {
      await indexedDBService.updateOrdersStatus(trackingNumbers, status);
    } catch (error) {
      console.warn('Lỗi cập nhật IndexedDB, thử localStorage:', error);
      await localStorageService.updateOrdersStatus(trackingNumbers, status);
    }
    
    // Nếu có Firebase, đồng bộ lên Firebase
    if (this.useFirebase()) {
      try {
        await firebaseService.updateOrdersStatus(trackingNumbers, status);
      } catch (error) {
        console.warn('Lỗi đồng bộ lên Firebase:', error);
      }
    }
  }

  async deleteOrder(id: string): Promise<void> {
    try {
      await indexedDBService.deleteOrder(id);
    } catch (error) {
      console.warn('Lỗi xóa từ IndexedDB, thử localStorage:', error);
      await localStorageService.deleteOrder(id);
    }
    
    if (this.useFirebase()) {
      try {
        await firebaseService.deleteOrder(id);
      } catch (error) {
        console.warn('Lỗi xóa trên Firebase:', error);
      }
    }
  }

  // Export dữ liệu để backup
  async exportData(): Promise<string> {
    return await indexedDBService.exportData();
  }

  // Import dữ liệu từ backup
  async importData(jsonData: string): Promise<{ imported: number; errors: number }> {
    return await indexedDBService.importData(jsonData);
  }

  // Lấy thông tin storage
  async getStorageInfo(): Promise<{ count: number; estimatedSize: number }> {
    return await indexedDBService.getStorageInfo();
  }
}

export const orderService = new OrderService();

