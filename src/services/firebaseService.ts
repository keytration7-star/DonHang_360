import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, onValue } from 'firebase/database';
import { Order, OrderStatus } from '../types/order';

function getFirebaseConfig() {
  return {
    apiKey: localStorage.getItem('firebase_apiKey') || import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: localStorage.getItem('firebase_authDomain') || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    databaseURL: localStorage.getItem('firebase_databaseURL') || import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
    projectId: localStorage.getItem('firebase_projectId') || import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: localStorage.getItem('firebase_storageBucket') || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: localStorage.getItem('firebase_messagingSenderId') || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: localStorage.getItem('firebase_appId') || import.meta.env.VITE_FIREBASE_APP_ID || ""
  };
}

function initializeFirebase() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return getDatabase(existingApps[0]);
  }
  
  const config = getFirebaseConfig();
  if (!config.apiKey || !config.databaseURL) {
    console.warn('Firebase chưa được cấu hình. Vui lòng cấu hình trong Settings.');
    return null;
  }
  
  try {
    const app = initializeApp(config);
    return getDatabase(app);
  } catch (error) {
    console.error('Lỗi khởi tạo Firebase:', error);
    return null;
  }
}

const database = initializeFirebase();

class FirebaseService {
  private getOrdersRef() {
    if (!database) {
      throw new Error('Firebase chưa được cấu hình. Vui lòng cấu hình trong Settings.');
    }
    return ref(database, 'orders');
  }

  async getOrders(): Promise<Order[]> {
    try {
      const ordersRef = this.getOrdersRef();
      const snapshot = await get(ordersRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.values(data) as Order[];
      }
      return [];
    } catch (error) {
      console.warn('Firebase chưa được cấu hình hoặc lỗi kết nối:', error);
      // Return empty array instead of throwing error
      return [];
    }
  }

  async addOrders(orders: Order[]): Promise<void> {
    try {
      const ordersRef = this.getOrdersRef();
      const currentOrders = await this.getOrders();
      const existingOrdersMap = currentOrders.reduce((acc, o) => ({ ...acc, [o.id]: o }), {} as Record<string, Order>);
      
      // Merge new orders with existing ones (avoid duplicates by tracking number)
      const updates: Record<string, Order> = { ...existingOrdersMap };
      orders.forEach(order => {
        // Check if order with same tracking number exists
        const existing = currentOrders.find(o => o.trackingNumber === order.trackingNumber);
        if (existing) {
          updates[existing.id] = { ...existing, ...order, id: existing.id };
        } else {
          updates[order.id] = order;
        }
      });
      
      await set(ordersRef, updates);
    } catch (error) {
      console.warn('Firebase chưa được cấu hình hoặc lỗi khi thêm đơn hàng:', error);
      // Don't throw error, just log warning
    }
  }

  async updateOrderStatus(trackingNumber: string, status: OrderStatus): Promise<void> {
    try {
      if (!database) {
        console.warn('Firebase chưa được cấu hình.');
        return;
      }
      const orders = await this.getOrders();
      const order = orders.find(o => o.trackingNumber === trackingNumber);
      if (order) {
        order.status = status;
        order.updatedAt = new Date().toISOString();
        await set(ref(database, `orders/${order.id}`), order);
      }
    } catch (error) {
      console.warn('Lỗi khi cập nhật trạng thái đơn hàng:', error);
    }
  }

  async updateOrdersStatus(trackingNumbers: string[], status: OrderStatus): Promise<void> {
    try {
      const orders = await this.getOrders();
      const updates: Record<string, Order> = {};
      
      trackingNumbers.forEach(trackingNumber => {
        const order = orders.find(o => o.trackingNumber === trackingNumber);
        if (order) {
          order.status = status;
          order.updatedAt = new Date().toISOString();
          updates[order.id] = order;
        }
      });

      const ordersRef = this.getOrdersRef();
      const currentOrders = await this.getOrders();
      const allOrders = { ...currentOrders.reduce((acc, o) => ({ ...acc, [o.id]: o }), {}), ...updates };
      await set(ordersRef, allOrders);
    } catch (error) {
      console.warn('Lỗi khi cập nhật trạng thái nhiều đơn hàng:', error);
    }
  }

  async deleteOrder(id: string): Promise<void> {
    try {
      if (!database) {
        throw new Error('Firebase chưa được cấu hình.');
      }
      await set(ref(database, `orders/${id}`), null);
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  subscribeToOrders(callback: (orders: Order[]) => void): () => void {
    const ordersRef = this.getOrdersRef();
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        callback(Object.values(data) as Order[]);
      } else {
        callback([]);
      }
    });
    return unsubscribe;
  }
}

export const firebaseService = new FirebaseService();

