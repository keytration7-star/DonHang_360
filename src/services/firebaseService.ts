import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, onValue } from 'firebase/database';
import { Order, OrderStatus } from '../../shared/types/order';
import { retry, getUserFriendlyError } from '../utils/errorHandler';
import { logger } from '../../shared/utils/logger';

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

// Helper function để loại bỏ các field undefined từ object (Firebase không chấp nhận undefined)
function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item));
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        // Chỉ thêm field nếu không phải undefined
        if (value !== undefined) {
          cleaned[key] = removeUndefinedFields(value);
        }
      }
    }
    return cleaned;
  }
  
  return obj;
}

class FirebaseService {
  private getOrdersRef() {
    if (!database) {
      // Không throw error, chỉ return null để có thể check
      return null;
    }
    return ref(database, 'orders');
  }

  /**
   * Lấy tất cả đơn hàng từ Firebase với retry logic
   * @returns Promise<Order[]> Danh sách đơn hàng, trả về mảng rỗng nếu có lỗi
   */
  async getOrders(): Promise<Order[]> {
    const ordersRef = this.getOrdersRef();
    if (!ordersRef) {
      return [];
    }

    try {
      // Retry với exponential backoff cho network errors
      const snapshot = await retry(
        () => get(ordersRef),
        {
          maxRetries: 3,
          retryDelay: 1000,
          onRetry: (attempt, error) => {
            logger.warn(`⚠️ Firebase getOrders - Lần thử ${attempt}: ${getUserFriendlyError(error)}`);
          }
        }
      );

      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.values(data) as Order[];
      }
      return [];
    } catch (error: any) {
      // Xử lý lỗi permission denied một cách graceful
      if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission_denied')) {
        // Chỉ log một lần để tránh spam console
        if (!(window as any).__firebasePermissionErrorLogged) {
          logger.warn('⚠️ Firebase: Permission denied. Vui lòng cấu hình Database Rules trong Firebase Console.');
          logger.warn('   - Vào Firebase Console → Realtime Database → Rules');
          logger.warn('   - Đặt rules: { "rules": { ".read": true, ".write": true } }');
          (window as any).__firebasePermissionErrorLogged = true;
        }
      } else {
        logger.warn('Firebase chưa được cấu hình hoặc lỗi kết nối:', getUserFriendlyError(error));
      }
      // Return empty array instead of throwing error
      return [];
    }
  }

  async addOrders(orders: Order[]): Promise<void> {
    try {
      const ordersRef = this.getOrdersRef();
      if (!ordersRef) {
        console.warn('Firebase chưa được cấu hình, không thể thêm đơn hàng');
        throw new Error('Firebase chưa được cấu hình');
      }
      
      if (orders.length === 0) {
        console.log('ℹ️ Không có đơn hàng nào để thêm vào Firebase');
        return;
      }
      
      console.log(`📤 FirebaseService - Đang thêm ${orders.length} đơn hàng vào Firebase...`);
      
      // Lấy dữ liệu hiện tại từ Firebase
      const currentOrders = await this.getOrders();
      console.log(`📥 FirebaseService - Đã lấy ${currentOrders.length} đơn hàng hiện có từ Firebase`);
      
      // Tạo map từ currentOrders (key = id)
      const existingOrdersMap = currentOrders.reduce((acc, o) => ({ ...acc, [o.id]: o }), {} as Record<string, Order>);
      
      // Merge new orders with existing ones (avoid duplicates by tracking number)
      const updates: Record<string, Order> = { ...existingOrdersMap };
      let addedCount = 0;
      let updatedCount = 0;
      
      orders.forEach(order => {
        // Check if order with same tracking number exists
        const existing = currentOrders.find(o => o.trackingNumber === order.trackingNumber);
        if (existing) {
          // Update existing order (ưu tiên order mới nếu mới hơn)
          const existingDate = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const newDate = order.updatedAt ? new Date(order.updatedAt).getTime() : 0;
          if (newDate >= existingDate) {
            updates[existing.id] = { ...existing, ...order, id: existing.id };
            updatedCount++;
          }
        } else {
          // Add new order
          updates[order.id] = order;
          addedCount++;
        }
      });
      
      console.log(`📤 FirebaseService - Sẽ cập nhật Firebase: ${addedCount} mới, ${updatedCount} cập nhật, tổng: ${Object.keys(updates).length}`);
      
      // Loại bỏ tất cả các field undefined trước khi ghi vào Firebase
      const cleanedUpdates: Record<string, any> = {};
      for (const key in updates) {
        if (updates.hasOwnProperty(key)) {
          cleanedUpdates[key] = removeUndefinedFields(updates[key]);
        }
      }
      
      console.log(`🧹 FirebaseService - Đã loại bỏ các field undefined, sẵn sàng ghi ${Object.keys(cleanedUpdates).length} đơn hàng`);
      
      // Ghi toàn bộ vào Firebase (set sẽ ghi đè toàn bộ node 'orders')
      await set(ordersRef, cleanedUpdates);
      
      console.log(`✅ FirebaseService - Đã thêm/cập nhật ${Object.keys(updates).length} đơn hàng vào Firebase thành công`);
    } catch (error: any) {
      // Xử lý lỗi permission denied một cách graceful
      if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission_denied')) {
        // Chỉ log một lần để tránh spam console
        if (!(window as any).__firebasePermissionErrorLogged) {
          console.error('❌ FirebaseService - Lỗi khi thêm đơn hàng vào Firebase:', error);
          console.error('⚠️ Firebase: Permission denied. Vui lòng cấu hình Database Rules.');
          console.error('   - Vào Firebase Console → Realtime Database → Rules');
          console.error('   - Đặt rules: { "rules": { ".read": true, ".write": true } }');
          (window as any).__firebasePermissionErrorLogged = true;
        }
        throw new Error('Permission denied - Vui lòng cấu hình Firebase Database Rules. Xem hướng dẫn trong Settings.');
      }
      console.error('❌ FirebaseService - Lỗi khi thêm đơn hàng vào Firebase:', error);
      throw error; // Re-throw để caller có thể xử lý
    }
  }

  /**
   * Cập nhật trạng thái một đơn hàng trong Firebase
   * @param trackingNumber Mã vận đơn của đơn hàng cần cập nhật
   * @param status Trạng thái mới
   */
  async updateOrderStatus(trackingNumber: string, status: OrderStatus): Promise<void> {
    try {
      if (!database) {
        logger.warn('Firebase chưa được cấu hình.');
        return;
      }
      const orders = await this.getOrders();
      const order = orders.find(o => o.trackingNumber === trackingNumber);
      if (order) {
        order.status = status;
        order.updatedAt = new Date().toISOString();
        // Loại bỏ undefined fields trước khi ghi
        const cleanedOrder = removeUndefinedFields(order);
        await retry(
          () => set(ref(database, `orders/${order.id}`), cleanedOrder),
          {
            maxRetries: 2,
            retryDelay: 500,
            onRetry: (attempt, error) => {
              logger.warn(`⚠️ Firebase updateOrderStatus - Lần thử ${attempt}: ${getUserFriendlyError(error)}`);
            }
          }
        );
      }
    } catch (error) {
      logger.warn('Lỗi khi cập nhật trạng thái đơn hàng:', getUserFriendlyError(error));
    }
  }

  /**
   * Cập nhật trạng thái nhiều đơn hàng trong Firebase
   * @param trackingNumbers Danh sách mã vận đơn cần cập nhật
   * @param status Trạng thái mới
   * @param codMap Map tracking number -> COD (cho đơn delivered)
   */
  async updateOrdersStatus(trackingNumbers: string[], status: OrderStatus, codMap?: Map<string, number>): Promise<void> {
    try {
      const ordersRef = this.getOrdersRef();
      if (!ordersRef) {
        logger.warn('Firebase chưa được cấu hình, không thể cập nhật đơn hàng');
        return;
      }
      const orders = await this.getOrders();
      const updates: Record<string, Order> = {};
      
      trackingNumbers.forEach(trackingNumber => {
        const order = orders.find(o => o.trackingNumber === trackingNumber);
        if (order) {
          order.status = status;
          // Cập nhật COD nếu có trong codMap (cho đơn delivered)
          if (codMap && codMap.has(trackingNumber)) {
            order.actualCod = codMap.get(trackingNumber);
          }
          order.updatedAt = new Date().toISOString();
          updates[order.id] = order;
        }
      });

      const currentOrders = await this.getOrders();
      const allOrders = { ...currentOrders.reduce((acc, o) => ({ ...acc, [o.id]: o }), {}), ...updates };
      // Loại bỏ undefined fields trước khi ghi
      const cleanedAllOrders = removeUndefinedFields(allOrders);
      await retry(
        () => set(ordersRef, cleanedAllOrders),
        {
          maxRetries: 3,
          retryDelay: 1000,
          onRetry: (attempt, error) => {
            logger.warn(`⚠️ Firebase updateOrdersStatus - Lần thử ${attempt}: ${getUserFriendlyError(error)}`);
          }
        }
      );
    } catch (error) {
      logger.warn('Lỗi khi cập nhật trạng thái nhiều đơn hàng:', getUserFriendlyError(error));
    }
  }

  /**
   * Xóa một đơn hàng khỏi Firebase
   * @param id ID của đơn hàng cần xóa
   * @throws Error nếu Firebase chưa được cấu hình hoặc có lỗi
   */
  async deleteOrder(id: string): Promise<void> {
    if (!database) {
      throw new Error('Firebase chưa được cấu hình.');
    }
    try {
      await retry(
        () => set(ref(database, `orders/${id}`), null),
        {
          maxRetries: 2,
          retryDelay: 500,
          onRetry: (attempt, error) => {
            logger.warn(`⚠️ Firebase deleteOrder - Lần thử ${attempt}: ${getUserFriendlyError(error)}`);
          }
        }
      );
    } catch (error) {
      logger.error('Error deleting order:', getUserFriendlyError(error));
      throw error;
    }
  }

  /**
   * Cập nhật thông tin đơn giao một phần (xuất hiện trong cả file đối soát và file hoàn)
   * @param updates Mảng các thông tin cập nhật: { trackingNumber, returnedCod, originalCod, actualCod }
   */
  async updatePartialDeliveryOrders(updates: Array<{ trackingNumber: string; returnedCod: number; originalCod: number; actualCod: number }>): Promise<void> {
    if (updates.length === 0) return;

    try {
      const ordersRef = this.getOrdersRef();
      if (!ordersRef) {
        console.warn('Firebase chưa được cấu hình, không thể cập nhật đơn giao một phần');
        return;
      }

      const orders = await this.getOrders();
      const updatesMap: Record<string, Partial<Order>> = {};
      
      updates.forEach(update => {
        const order = orders.find(o => o.trackingNumber === update.trackingNumber);
        if (order) {
          // Cập nhật thông tin giao một phần
          // QUAN TRỌNG: Giữ nguyên source='delivered' và status='DELIVERED'
          updatesMap[order.id] = {
            ...order,
            returnedCod: update.returnedCod,
            isPartialDelivery: true,
            partialDelivery: update.actualCod, // COD đã giao
            actualCod: update.actualCod,
            // Đảm bảo source và status đúng
            source: 'delivered',
            status: OrderStatus.DELIVERED,
            updatedAt: new Date().toISOString()
          };
        } else {
          console.warn(`⚠️ Firebase: Không tìm thấy đơn ${update.trackingNumber} để cập nhật thông tin giao một phần`);
        }
      });

      if (Object.keys(updatesMap).length > 0) {
        // Merge với orders hiện có
        const currentOrders = await this.getOrders();
        const allOrders = { ...currentOrders.reduce((acc, o) => ({ ...acc, [o.id]: o }), {}), ...updatesMap };
        
        // Loại bỏ undefined fields trước khi ghi
        const cleanedAllOrders = removeUndefinedFields(allOrders);
        await set(ordersRef, cleanedAllOrders);
        
        console.log(`✅ Firebase: Đã cập nhật ${Object.keys(updatesMap).length} đơn giao một phần`);
      }
    } catch (error: any) {
      // Xử lý lỗi permission denied
      if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission_denied')) {
        if (!(window as any).__firebasePermissionErrorLogged) {
          console.warn('⚠️ Firebase: Permission denied. Vui lòng cấu hình Database Rules.');
          (window as any).__firebasePermissionErrorLogged = true;
        }
        throw new Error('Permission denied - Vui lòng cấu hình Firebase Database Rules');
      }
      console.error('❌ Firebase: Lỗi cập nhật đơn giao một phần:', error);
      throw error;
    }
  }

  async clearAllOrders(): Promise<void> {
    try {
      if (!database) {
        throw new Error('Firebase chưa được cấu hình.');
      }
      
      // Xóa tất cả dữ liệu trong node orders
      // Sử dụng ref trực tiếp để đảm bảo xóa đúng path
      const ordersRef = ref(database, 'orders');
      
      console.log('🗑️ Đang xóa tất cả dữ liệu từ Firebase...');
      console.log('   Path: orders/');
      
      // Xóa tất cả dữ liệu bằng cách set null
      await set(ordersRef, null);
      
      console.log('✅ Đã xóa tất cả dữ liệu từ Firebase thành công');
      console.log('   Bạn có thể kiểm tra trên Firebase Console để xác nhận');
    } catch (error) {
      console.error('❌ Lỗi xóa dữ liệu Firebase:', error);
      throw error;
    }
  }

  subscribeToOrders(callback: (orders: Order[]) => void, onError?: (error: any) => void): (() => void) | null {
    const ordersRef = this.getOrdersRef();
    if (!ordersRef) {
      console.warn('Firebase chưa được cấu hình, không thể subscribe');
      return null;
    }
    
    try {
      const unsubscribe = onValue(ordersRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          callback(Object.values(data) as Order[]);
        } else {
          callback([]);
        }
      }, (error) => {
        if (onError) {
          onError(error);
        } else {
          console.error('Lỗi khi subscribe Firebase:', error);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Lỗi khi tạo Firebase subscription:', error);
      if (onError) {
        onError(error);
      }
      return null;
    }
  }
}

export const firebaseService = new FirebaseService();

