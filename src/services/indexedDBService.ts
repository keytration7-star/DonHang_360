import { Order } from '../types/order';

const DB_NAME = 'DonHang360DB';
const DB_VERSION = 1;
const STORE_NAME = 'orders';

class IndexedDBService {
  private db: IDBDatabase | null = null;

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      // Kiểm tra xem IndexedDB có được hỗ trợ không
      if (!window.indexedDB) {
        const error = new Error('IndexedDB không được hỗ trợ trong trình duyệt này');
        console.error(error);
        reject(error);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        const error = request.error || new Error('Không thể mở IndexedDB');
        console.error('Lỗi mở IndexedDB:', error);
        reject(error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        
        // Xử lý lỗi khi database bị đóng
        this.db.onerror = (event) => {
          console.error('Lỗi IndexedDB:', event);
        };
        
        this.db.onclose = () => {
          console.warn('IndexedDB đã bị đóng');
          this.db = null;
        };
        
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          try {
            const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            objectStore.createIndex('trackingNumber', 'trackingNumber', { unique: true });
            objectStore.createIndex('status', 'status', { unique: false });
            objectStore.createIndex('sendDate', 'sendDate', { unique: false });
            console.log('Đã tạo object store và indexes');
          } catch (error) {
            console.error('Lỗi tạo object store:', error);
            reject(error);
          }
        }
      };
    });
  }

  async getOrders(): Promise<Order[]> {
    console.log('🗄️ IndexedDBService - getOrders bắt đầu');
    try {
      console.log('🗄️ IndexedDBService - đang mở database...');
      const db = await this.openDB();
      console.log('✅ IndexedDBService - database đã mở');
      return new Promise((resolve, reject) => {
        console.log('🗄️ IndexedDBService - đang tạo transaction...');
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        console.log('🗄️ IndexedDBService - đang getAll()...');
        const request = store.getAll();

        request.onerror = () => {
          console.error('❌ IndexedDBService - Lỗi request:', request.error);
          reject(request.error);
        };
        request.onsuccess = () => {
          const orders = request.result || [];
          console.log(`✅ IndexedDBService - Đã load ${orders.length} đơn hàng từ IndexedDB`);
          resolve(orders);
        };
      });
    } catch (error) {
      console.error('❌ IndexedDBService - Lỗi đọc dữ liệu từ IndexedDB:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  // Kiểm tra đơn trùng trước khi import
  async checkDuplicates(trackingNumbers: string[]): Promise<{ existing: string[]; new: string[] }> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('trackingNumber');
      
      const existing: string[] = [];
      const newOnes: string[] = [];
      
      // Kiểm tra từng tracking number
      const checkPromises = trackingNumbers.map(tn => {
        return new Promise<void>((resolve) => {
          const request = index.get(tn);
          request.onsuccess = () => {
            if (request.result) {
              existing.push(tn);
            } else {
              newOnes.push(tn);
            }
            resolve();
          };
          request.onerror = () => {
            // Nếu lỗi, coi như đơn mới
            newOnes.push(tn);
            resolve();
          };
        });
      });
      
      await Promise.all(checkPromises);
      await new Promise<void>((resolve) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        setTimeout(() => resolve(), 5000); // Timeout 5 giây
      });
      
      return { existing, new: newOnes };
    } catch (error) {
      console.error('Lỗi kiểm tra duplicate:', error);
      // Nếu lỗi, coi như tất cả đều là đơn mới
      return { existing: [], new: trackingNumbers };
    }
  }

  async addOrders(orders: Order[]): Promise<{ saved: number; updated: number; errors: number; duplicateCount: number }> {
    if (!orders || orders.length === 0) return { saved: 0, updated: 0, errors: 0, duplicateCount: 0 };

    try {
      const db = await this.openDB();
      
      // Giảm batch size để tránh transaction timeout và đảm bảo tất cả đơn đều được lưu
      const batchSize = 50; // Giảm từ 100 xuống 50 để tránh timeout
      let savedCount = 0; // Đơn mới
      let updatedCount = 0; // Đơn đã tồn tại (được cập nhật)
      let errorCount = 0;
      let duplicateCount = 0; // Đếm số đơn trùng
      const errors: string[] = [];

      console.log(`Bắt đầu lưu ${orders.length} đơn hàng vào IndexedDB...`);

      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        
        // Tạo transaction mới cho mỗi batch để tránh timeout
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('trackingNumber');

        // Lưu từng đơn trong batch với error handling riêng
        const batchPromises = batch.map(order => {
          return new Promise<void>((resolve) => {
            try {
              // Loại bỏ rawData để tiết kiệm dung lượng (chỉ lưu khi cần)
              const orderToSave = { ...order };
              if (orderToSave.rawData && Object.keys(orderToSave.rawData).length === 0) {
                delete orderToSave.rawData;
              }

              // Kiểm tra xem đơn đã tồn tại chưa (theo trackingNumber)
              const getRequest = index.get(orderToSave.trackingNumber);
              
              getRequest.onsuccess = () => {
                const existingOrder = getRequest.result;
                if (existingOrder) {
                  // Đơn đã tồn tại - merge dữ liệu (ưu tiên dữ liệu mới nhưng giữ createdAt của đơn cũ)
                  duplicateCount++;
                  const mergedOrder = { 
                    ...existingOrder, 
                    ...orderToSave, 
                    id: existingOrder.id,
                    createdAt: existingOrder.createdAt, // Giữ ngày tạo ban đầu
                    updatedAt: new Date().toISOString() // Cập nhật ngày sửa
                  };
                  const putRequest = store.put(mergedOrder);
                  putRequest.onsuccess = () => {
                    updatedCount++;
                    resolve();
                  };
                  putRequest.onerror = () => {
                    errorCount++;
                    const errorMsg = `Lỗi cập nhật đơn ${orderToSave.trackingNumber}: ${putRequest.error}`;
                    errors.push(errorMsg);
                    console.error(errorMsg);
                    resolve(); // Vẫn resolve để tiếp tục xử lý các đơn khác
                  };
                } else {
                  // Đơn mới, thêm vào
                  const addRequest = store.add(orderToSave);
                  addRequest.onsuccess = () => {
                    savedCount++;
                    resolve();
                  };
                  addRequest.onerror = () => {
                    // Nếu lỗi do duplicate ID, thử put thay vì add
                    if (addRequest.error?.name === 'ConstraintError') {
                      duplicateCount++;
                      const putRequest = store.put(orderToSave);
                      putRequest.onsuccess = () => {
                        updatedCount++;
                        resolve();
                      };
                      putRequest.onerror = () => {
                        errorCount++;
                        const errorMsg = `Lỗi lưu đơn ${orderToSave.trackingNumber}: ${putRequest.error}`;
                        errors.push(errorMsg);
                        console.error(errorMsg);
                        resolve();
                      };
                    } else {
                      errorCount++;
                      const errorMsg = `Lỗi thêm đơn ${orderToSave.trackingNumber}: ${addRequest.error}`;
                      errors.push(errorMsg);
                      console.error(errorMsg);
                      resolve();
                    }
                  };
                }
              };

              getRequest.onerror = () => {
                // Nếu không tìm thấy trong index, thử add trực tiếp
                const addRequest = store.add(orderToSave);
                addRequest.onsuccess = () => {
                  savedCount++;
                  resolve();
                };
                addRequest.onerror = () => {
                  // Nếu lỗi do duplicate, thử put
                  if (addRequest.error?.name === 'ConstraintError') {
                    duplicateCount++;
                    const putRequest = store.put(orderToSave);
                    putRequest.onsuccess = () => {
                      updatedCount++;
                      resolve();
                    };
                    putRequest.onerror = () => {
                      errorCount++;
                      const errorMsg = `Lỗi lưu đơn ${orderToSave.trackingNumber}: ${putRequest.error}`;
                      errors.push(errorMsg);
                      console.error(errorMsg);
                      resolve();
                    };
                  } else {
                    errorCount++;
                    const errorMsg = `Lỗi thêm đơn ${orderToSave.trackingNumber}: ${addRequest.error}`;
                    errors.push(errorMsg);
                    console.error(errorMsg);
                    resolve();
                  }
                };
              };
            } catch (error) {
              errorCount++;
              const errorMsg = `Lỗi xử lý đơn ${order.trackingNumber}: ${error}`;
              errors.push(errorMsg);
              console.error(errorMsg);
              resolve(); // Vẫn resolve để tiếp tục
            }
          });
        });

        // Đợi tất cả đơn trong batch được xử lý
        await Promise.all(batchPromises);
        
        // Đợi transaction hoàn thành
        await new Promise<void>((resolve) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => {
            console.error('Transaction error:', transaction.error);
            resolve();
          };
          // Timeout sau 30 giây
          setTimeout(() => resolve(), 30000);
        });

        // Log tiến độ
        if ((i + batchSize) % 500 === 0 || i + batchSize >= orders.length) {
          console.log(`Đã xử lý: ${savedCount + updatedCount}/${orders.length} đơn hàng (Mới: ${savedCount}, Cập nhật: ${updatedCount}, Lỗi: ${errorCount})`);
        }

        // Yield để không block UI
        if (i + batchSize < orders.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      console.log(`Hoàn thành: Đã lưu ${savedCount} đơn mới, cập nhật ${updatedCount} đơn trùng, ${errorCount} lỗi`);
      
      if (errors.length > 0 && errors.length <= 10) {
        console.warn('Các lỗi chi tiết:', errors);
      } else if (errors.length > 10) {
        console.warn(`Có ${errors.length} lỗi. Hiển thị 10 lỗi đầu:`, errors.slice(0, 10));
      }

      // Trả về kết quả chi tiết
      return {
        saved: savedCount,
        updated: updatedCount,
        errors: errorCount,
        duplicateCount: duplicateCount
      };
    } catch (error) {
      console.error('Lỗi lưu dữ liệu vào IndexedDB:', error);
      throw error;
    }
  }

  async updateOrderStatus(trackingNumber: string, status: Order['status']): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('trackingNumber');
      
      return new Promise((resolve, reject) => {
        const request = index.get(trackingNumber);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const order = request.result;
          if (order) {
            order.status = status;
            order.updatedAt = new Date().toISOString();
            const updateRequest = store.put(order);
            updateRequest.onerror = () => reject(updateRequest.error);
            updateRequest.onsuccess = () => resolve();
          } else {
            resolve();
          }
        };
      });
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái đơn hàng:', error);
      throw error;
    }
  }

  async updateOrdersStatus(trackingNumbers: string[], status: Order['status']): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('trackingNumber');

      const updates: Promise<void>[] = trackingNumbers.map(trackingNumber => {
        return new Promise((resolve, reject) => {
          const request = index.get(trackingNumber);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const order = request.result;
            if (order) {
              order.status = status;
              order.updatedAt = new Date().toISOString();
              const updateRequest = store.put(order);
              updateRequest.onerror = () => reject(updateRequest.error);
              updateRequest.onsuccess = () => resolve();
            } else {
              resolve();
            }
          };
        });
      });

      await Promise.all(updates);
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái nhiều đơn hàng:', error);
      throw error;
    }
  }

  async deleteOrder(id: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('Lỗi xóa đơn hàng:', error);
      throw error;
    }
  }

  // Export dữ liệu để backup
  async exportData(): Promise<string> {
    try {
      const orders = await this.getOrders();
      const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        orders: orders,
      };
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Lỗi export dữ liệu:', error);
      throw error;
    }
  }

  // Import dữ liệu từ backup
  async importData(jsonData: string): Promise<{ imported: number; errors: number }> {
    try {
      const data = JSON.parse(jsonData);
      const orders: Order[] = Array.isArray(data) ? data : (data.orders || []);
      
      let imported = 0;
      let errors = 0;

      // Validate và import từng batch
      const batchSize = 500;
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        const validOrders = batch.filter(order => {
          // Validate order structure
          return order.id && order.trackingNumber && order.sendDate;
        });

        try {
          await this.addOrders(validOrders);
          imported += validOrders.length;
          errors += (batch.length - validOrders.length);
        } catch (error) {
          console.error('Lỗi import batch:', error);
          errors += batch.length;
        }

        // Yield để không block UI
        if (i + batchSize < orders.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      return { imported, errors };
    } catch (error) {
      console.error('Lỗi import dữ liệu:', error);
      throw error;
    }
  }

  // Xóa toàn bộ dữ liệu
  async clearAll(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('Lỗi xóa dữ liệu:', error);
      throw error;
    }
  }

  // Lấy thống kê dung lượng
  async getStorageInfo(): Promise<{ count: number; estimatedSize: number }> {
    try {
      const orders = await this.getOrders();
      const estimatedSize = new Blob([JSON.stringify(orders)]).size;
      return {
        count: orders.length,
        estimatedSize,
      };
    } catch (error) {
      console.error('Lỗi lấy thông tin storage:', error);
      return { count: 0, estimatedSize: 0 };
    }
  }
}

export const indexedDBService = new IndexedDBService();


