import { create } from 'zustand';
import { Order, OrderStatus } from '../types/order';
import { orderService } from '../services/orderService';

interface OrderStore {
  orders: Order[];
  loading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  addOrders: (orders: Order[]) => Promise<{ saved: number; updated: number; errors: number; duplicateCount: number }>;
  updateOrderStatus: (trackingNumber: string, status: OrderStatus) => Promise<void>;
  updateOrdersStatus: (trackingNumbers: string[], status: OrderStatus) => Promise<void>;
  getOrderByTrackingNumber: (trackingNumber: string) => Order | undefined;
  searchOrders: (query: string) => Order[];
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  loading: false,
  error: null,

  fetchOrders: async () => {
    console.log('📦 OrderStore - fetchOrders bắt đầu');
    set({ loading: true, error: null });
    try {
      console.log('📦 OrderStore - đang gọi orderService.getAllOrders()...');
      const orders = await orderService.getAllOrders();
      console.log(`📦 OrderStore - đã nhận được ${orders.length} đơn hàng`);
      set({ orders, loading: false, error: null });
      console.log('✅ OrderStore - fetchOrders thành công');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể tải đơn hàng. Vui lòng thử lại.';
      console.error('❌ OrderStore - Lỗi tải đơn hàng:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      set({ orders: [], loading: false, error: errorMessage });
    }
  },

  addOrders: async (orders: Order[]) => {
    set({ loading: true, error: null });
    try {
      const result = await orderService.addOrders(orders);
      await get().fetchOrders();
      return result;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return { saved: 0, updated: 0, errors: orders.length, duplicateCount: 0 };
    }
  },

  updateOrderStatus: async (trackingNumber: string, status: OrderStatus) => {
    set({ loading: true, error: null });
    try {
      await orderService.updateOrderStatus(trackingNumber, status);
      await get().fetchOrders();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  updateOrdersStatus: async (trackingNumbers: string[], status: OrderStatus) => {
    set({ loading: true, error: null });
    try {
      await orderService.updateOrdersStatus(trackingNumbers, status);
      await get().fetchOrders();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  getOrderByTrackingNumber: (trackingNumber: string) => {
    return get().orders.find(order => order.trackingNumber === trackingNumber);
  },

  searchOrders: (query: string) => {
    const orders = get().orders;
    const lowerQuery = query.toLowerCase();
    return orders.filter(order =>
      order.trackingNumber.toLowerCase().includes(lowerQuery) ||
      order.customerName.toLowerCase().includes(lowerQuery) ||
      order.customerPhone.includes(query) ||
      order.customerAddress.toLowerCase().includes(lowerQuery)
    );
  },
}));

