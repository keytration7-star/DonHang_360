import { Order } from '../types/order';

const STORAGE_KEY = 'donhang360_orders';

class LocalStorageService {
  async getOrders(): Promise<Order[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data) as Order[];
      }
      return [];
    } catch (error) {
      console.error('Lỗi đọc dữ liệu từ localStorage:', error);
      return [];
    }
  }

  async addOrders(orders: Order[]): Promise<void> {
    try {
      const currentOrders = await this.getOrders();
      const ordersMap = new Map<string, Order>();
      
      // Thêm các đơn hàng hiện có
      currentOrders.forEach(order => {
        ordersMap.set(order.trackingNumber, order);
      });
      
      // Thêm/cập nhật các đơn hàng mới - batch update để tối ưu
      orders.forEach(order => {
        ordersMap.set(order.trackingNumber, order);
      });
      
      // Lưu lại - sử dụng requestIdleCallback nếu có để không block UI
      const allOrders = Array.from(ordersMap.values());
      
      // Chia nhỏ dữ liệu nếu quá lớn để tránh block UI
      if (allOrders.length > 1000) {
        // Lưu từng batch nhỏ
        const batchSize = 500;
        for (let i = 0; i < allOrders.length; i += batchSize) {
          const batch = allOrders.slice(i, i + batchSize);
          // Lưu batch hiện tại
          if (i === 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(batch));
          } else {
            // Merge với batch trước
            const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Order[];
            const merged = [...existing, ...batch];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          }
          // Yield để UI không bị block
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allOrders));
      }
    } catch (error) {
      console.error('Lỗi lưu dữ liệu vào localStorage:', error);
      throw error;
    }
  }

  async updateOrderStatus(trackingNumber: string, status: Order['status']): Promise<void> {
    try {
      const orders = await this.getOrders();
      const order = orders.find(o => o.trackingNumber === trackingNumber);
      if (order) {
        order.status = status;
        order.updatedAt = new Date().toISOString();
        await this.addOrders([order]);
      }
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái đơn hàng:', error);
      throw error;
    }
  }

  async updateOrdersStatus(trackingNumbers: string[], status: Order['status']): Promise<void> {
    try {
      const orders = await this.getOrders();
      trackingNumbers.forEach(trackingNumber => {
        const order = orders.find(o => o.trackingNumber === trackingNumber);
        if (order) {
          order.status = status;
          order.updatedAt = new Date().toISOString();
        }
      });
      await this.addOrders(orders);
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái nhiều đơn hàng:', error);
      throw error;
    }
  }

  async deleteOrder(id: string): Promise<void> {
    try {
      const orders = await this.getOrders();
      const filteredOrders = orders.filter(o => o.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredOrders));
    } catch (error) {
      console.error('Lỗi xóa đơn hàng:', error);
      throw error;
    }
  }
}

export const localStorageService = new LocalStorageService();

