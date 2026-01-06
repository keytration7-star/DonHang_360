/**
 * Pancake POS API Service
 * Kết nối với Pancake API để lấy dữ liệu đơn hàng
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  PancakeApiConfig, 
  PancakeOrder, 
  PancakeShop, 
  PancakeApiResponse, 
  PancakeOrdersResponse,
  PancakeShopsResponse,
  PancakeApiParams,
  TestConnectionResult
} from '../../shared/types/pancakeApi';
import { logger } from '../../shared/utils/logger';

const DEFAULT_BASE_URL = 'https://pos.pages.fm/api/v1';

class PancakeApiService {
  private axiosInstance: AxiosInstance | null = null;
  private currentConfig: PancakeApiConfig | null = null;

  /**
   * Khởi tạo axios instance với API config
   */
  private initializeAxios(config: PancakeApiConfig): AxiosInstance {
    const instance = axios.create({
      baseURL: config.baseUrl || DEFAULT_BASE_URL,
      timeout: 30000, // 30 giây
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        api_key: config.apiKey,
      },
    });

    // Request interceptor - Chỉ log trong dev mode
    instance.interceptors.request.use(
      (config) => {
        // Chỉ log URL, không log params để giảm noise
        return config;
      },
      (error) => {
        logger.error('❌ Pancake API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    instance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: AxiosError) => {
        // Chỉ log lỗi thực sự (không phải 404)
        if (error.response?.status !== 404) {
          logger.error('❌ Pancake API Response Error:', {
            status: error.response?.status,
            message: error.message,
            url: error.config?.url,
          });
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }

  /**
   * Tạo instance mới với config (factory method)
   */
  static createInstance(config: PancakeApiConfig): PancakeApiService {
    const instance = new PancakeApiService();
    instance.setConfig(config);
    return instance;
  }

  /**
   * Set API config và khởi tạo connection
   */
  setConfig(config: PancakeApiConfig): void {
    this.currentConfig = config;
    this.axiosInstance = this.initializeAxios(config);
  }

  /**
   * Get current config
   */
  getCurrentConfig(): PancakeApiConfig | null {
    return this.currentConfig;
  }

  /**
   * Test kết nối API
   * @param config - Cấu hình API để test
   * @returns Kết quả test với success flag và message
   */
  async testConnection(config: PancakeApiConfig): Promise<TestConnectionResult> {
    try {
      const testInstance = this.initializeAxios(config);
      const response = await testInstance.get<PancakeShopsResponse | PancakeApiResponse<PancakeShop[]>>('/shops');
      
      return {
        success: true,
        message: 'Kết nối thành công!',
        data: response.data,
      };
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      const message = axiosError.response?.data?.message || axiosError.message || 'Lỗi không xác định';
      return {
        success: false,
        message: `Lỗi kết nối: ${message}`,
      };
    }
  }

  /**
   * Lấy danh sách cửa hàng từ API
   * @returns Mảng các cửa hàng (PancakeShop[])
   * @throws Error nếu chưa cấu hình API hoặc lỗi kết nối
   */
  async getShops(): Promise<PancakeShop[]> {
    if (!this.axiosInstance) {
      throw new Error('Chưa cấu hình API. Vui lòng thiết lập API key trong Settings.');
    }

    try {
      const response = await this.axiosInstance.get<PancakeApiResponse<PancakeShop[]>>('/shops');
      
      // Parse response theo format API
      const responseData = response.data as PancakeShopsResponse | PancakeShop[] | PancakeApiResponse<PancakeShop[]>;
      
      if (Array.isArray(responseData)) {
        return responseData;
      }
      
      if ('data' in responseData && Array.isArray(responseData.data)) {
        return responseData.data;
      }
      
      if ('shops' in responseData && Array.isArray(responseData.shops)) {
        return responseData.shops;
      }
      
      return [];
    } catch (error: unknown) {
      logger.error('❌ Lỗi lấy danh sách cửa hàng:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả đơn hàng (tự động paginate)
   * Sử dụng getOrders() để tự động thử nhiều endpoint
   */
  async getAllOrders(params?: {
    status?: string;
    date_from?: string;
    date_to?: string;
    shop_id?: string;
  }): Promise<PancakeOrder[]> {
    if (!this.axiosInstance) {
      throw new Error('Chưa cấu hình API. Vui lòng thiết lập API key trong Settings.');
    }

    try {
      let allOrders: PancakeOrder[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;
      let workingEndpoint: string | null = null;
      let total_entries = 0;
      let total_pages = 0;

      // Theo API documentation từ api-1.json:
      // Endpoint chính xác là: /shops/{SHOP_ID}/orders
      // Parameters: page_size, page_number, search, filter_status[], include_removed, updateStatus
      // Response: { success: true, data: [...], page_number, page_size, total_entries, total_pages }
      
      const possibleEndpoints: string[] = [];
      
      // QUAN TRỌNG: Theo API docs, endpoint BẮT BUỘC phải có shop_id trong URL path
      if (params?.shop_id) {
        possibleEndpoints.push(
          `/shops/${params.shop_id}/orders`,           // ✅ Endpoint chính xác theo API docs
          `/shops/${params.shop_id}/orders_returned`, // Đơn hoàn
          `/shops/${params.shop_id}/purchases`        // Purchases (phiếu nhập kho, không phải đơn hàng)
        );
      } else {
        logger.warn('⚠️ Không có shop_id. Theo API docs, endpoint /shops/{SHOP_ID}/orders BẮT BUỘC phải có shop_id.');
        possibleEndpoints.push(
          '/purchases',
          '/purchase',
          '/orders',
          '/order',
          '/transactions',
          '/deliveries'
        );
      }

      // Tìm endpoint hoạt động
      for (const endpoint of possibleEndpoints) {
        try {
          const apiParams: PancakeApiParams = {
            page_number: 1,
            page_size: limit || 100,
          };
          
          if (params?.status) {
            apiParams.filter_status = Array.isArray(params.status) ? params.status : [params.status];
          }
          if (params?.date_from) {
            apiParams.start_time = Math.floor(new Date(params.date_from).getTime() / 1000);
          }
          if (params?.date_to) {
            apiParams.end_time = Math.floor(new Date(params.date_to).getTime() / 1000);
          }
          
          const response = await this.axiosInstance.get<PancakeOrdersResponse | PancakeApiResponse<PancakeOrder[]>>(endpoint, {
            params: apiParams,
          });

          let orders: PancakeOrder[] = [];
          const responseData = response.data as PancakeOrdersResponse | PancakeOrder[] | PancakeApiResponse<PancakeOrder[]>;
          
          if (Array.isArray(responseData)) {
            orders = responseData;
          } else if ('data' in responseData) {
            if (Array.isArray(responseData.data)) {
              orders = responseData.data;
            } else if (responseData.data) {
              orders = [responseData.data];
            }
          } else if ('orders' in responseData && Array.isArray(responseData.orders)) {
            orders = responseData.orders;
          } else if ('results' in responseData && Array.isArray(responseData.results)) {
            orders = responseData.results;
          }
          
          // Lưu total_entries và total_pages từ response đầu tiên
          const ordersResponse = responseData as PancakeOrdersResponse;
          const firstTotalEntries = ordersResponse.total_entries || ordersResponse.total || 0;
          const firstTotalPages = ordersResponse.total_pages || 0;
          
          if (response.status === 200 && orders.length > 0) {
            if (endpoint.includes('/purchases')) {
              continue; // Bỏ qua purchases
            }
            
            workingEndpoint = endpoint;
            allOrders = [...allOrders, ...orders];
            total_entries = firstTotalEntries;
            total_pages = firstTotalPages;
            
            // Log thông tin pagination
            if (total_entries > 0 || total_pages > 0) {
              logger.log(`📄 Page 1: ${orders.length} đơn, tổng: ${total_entries} đơn, ${total_pages} pages`);
            }
            
            break;
          } else if (response.status === 200 && orders.length === 0) {
            continue;
          }
        } catch (error: unknown) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 404) {
            continue; // 404 là bình thường, tiếp tục thử endpoint khác
          } else {
            throw error; // Lỗi khác, throw
          }
        }
      }

      if (!workingEndpoint) {
        const errorMessage = params?.shop_id 
          ? `Không tìm thấy endpoint hoạt động cho shop_id=${params.shop_id}. Đã thử ${possibleEndpoints.length} endpoint(s).`
          : `Không tìm thấy endpoint hoạt động. Đã thử ${possibleEndpoints.length} endpoint(s).`;
        throw new Error(errorMessage);
      }

      // Tiếp tục paginate với endpoint đã tìm được
      page = 2;
      
      // Nếu có total_entries, dùng nó để biết khi nào dừng
      // Nếu không có, tiếp tục cho đến khi không còn dữ liệu
      hasMore = allOrders.length === limit; // Nếu page đầu có đủ limit items, có thể còn page tiếp theo

      while (hasMore) {
        try {
          const apiParams: PancakeApiParams = {
            page_number: page,
            page_size: limit || 100,
          };
          
          if (params?.status) {
            apiParams.filter_status = Array.isArray(params.status) ? params.status : [params.status];
          }
          if (params?.date_from) {
            apiParams.start_time = Math.floor(new Date(params.date_from).getTime() / 1000);
          }
          if (params?.date_to) {
            apiParams.end_time = Math.floor(new Date(params.date_to).getTime() / 1000);
          }
          
          const response = await this.axiosInstance.get<PancakeOrdersResponse | PancakeApiResponse<PancakeOrder[]>>(workingEndpoint, {
            params: apiParams,
          });

          let orders: PancakeOrder[] = [];
          const responseData = response.data as PancakeOrdersResponse | PancakeOrder[] | PancakeApiResponse<PancakeOrder[]>;
          
          if (Array.isArray(responseData)) {
            orders = responseData;
          } else if ('data' in responseData) {
            if (Array.isArray(responseData.data)) {
              orders = responseData.data;
            } else if (responseData.data) {
              orders = [responseData.data];
            }
          } else if ('orders' in responseData && Array.isArray(responseData.orders)) {
            orders = responseData.orders;
          } else if ('results' in responseData && Array.isArray(responseData.results)) {
            orders = responseData.results;
          }

          // Cập nhật total_entries và total_pages từ response mới nhất
          const ordersResponse = responseData as PancakeOrdersResponse;
          const newTotalEntries = ordersResponse.total_entries || ordersResponse.total || total_entries;
          const newTotalPages = ordersResponse.total_pages || total_pages;
          if (newTotalEntries > 0) total_entries = newTotalEntries;
          if (newTotalPages > 0) total_pages = newTotalPages;

          allOrders = [...allOrders, ...orders];

          // Logic kiểm tra hasMore:
          // 1. Nếu có total_entries và total_pages: dùng chúng
          // 2. Nếu không có: tiếp tục cho đến khi orders.length < limit
          if (total_entries > 0 && total_pages > 0) {
            // Có thông tin tổng số, dùng để check
            hasMore = page < total_pages && allOrders.length < total_entries;
          } else if (total_entries > 0) {
            // Chỉ có total_entries
            hasMore = allOrders.length < total_entries && orders.length === limit;
          } else {
            // Không có thông tin tổng số, tiếp tục cho đến khi không còn dữ liệu
            hasMore = orders.length === limit;
          }
          
          page++;

          // Safety limit: không fetch quá 1000 pages (100,000 orders)
          if (page > 1000) {
            logger.warn(`⚠️ Đã đạt giới hạn pagination (1000 pages), dừng lại`);
            break;
          }

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
          logger.warn(`⚠️ Lỗi khi paginate page ${page}:`, errorMessage);
          break;
        }
      }
      
      logger.log(`✅ Đã lấy tổng cộng ${allOrders.length} đơn hàng từ ${page - 1} page(s)`);

      return allOrders;
    } catch (error: unknown) {
      logger.error('❌ Lỗi lấy tất cả đơn hàng:', error);
      const axiosError = error as AxiosError<{ message?: string }>;
      const status = axiosError.response?.status;
      const errorMessage = axiosError.response?.data?.message || axiosError.message || 'Không thể lấy danh sách đơn hàng';
      throw new Error(`Lỗi ${status || 'unknown'}: ${errorMessage}`);
    }
  }

  /**
   * Lấy đơn hàng đã hoàn từ endpoint /orders_returned
   */
  async getReturnedOrders(shopId: string): Promise<PancakeOrder[]> {
    if (!this.axiosInstance) {
      throw new Error('Chưa cấu hình API. Vui lòng thiết lập API key trong Settings.');
    }

    try {
      const endpoint = `/shops/${shopId}/orders_returned`;
      let allOrders: PancakeOrder[] = [];
      let page_number = 1;
      const page_size = 100;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.axiosInstance.get<PancakeOrdersResponse | PancakeApiResponse<PancakeOrder[]>>(endpoint, {
            params: {
              page_number,
              page_size,
            },
          });

          let orders: PancakeOrder[] = [];
          const responseData = response.data as PancakeOrdersResponse | PancakeOrder[] | PancakeApiResponse<PancakeOrder[]>;
          
          if (Array.isArray(responseData)) {
            orders = responseData;
          } else if ('data' in responseData) {
            if (Array.isArray(responseData.data)) {
              orders = responseData.data;
            }
          } else if ('orders' in responseData && Array.isArray(responseData.orders)) {
            orders = responseData.orders;
          }

          orders = orders.map(order => ({
            ...order,
            from_returned_endpoint: true,
            sub_status: order.sub_status || 8,
          } as PancakeOrder & { from_returned_endpoint: boolean }));

          allOrders = [...allOrders, ...orders];

          const ordersResponse = responseData as PancakeOrdersResponse;
          const total_entries = ordersResponse.total_entries || ordersResponse.total || 0;
          hasMore = orders.length === page_size && (total_entries === 0 || allOrders.length < total_entries);
          page_number++;

          if (orders.length === 0) {
            break;
          }
        } catch (error: unknown) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 404) {
            break; // 404 là bình thường
          }
          const errorMessage = axiosError instanceof Error ? axiosError.message : 'Lỗi không xác định';
          logger.warn(`⚠️ Lỗi khi paginate đơn hoàn từ ${endpoint} (page ${page_number}):`, errorMessage);
          break;
        }
      }

      return allOrders;
    } catch (error: unknown) {
      logger.error('❌ Lỗi lấy đơn hoàn:', error);
      return []; // Trả về rỗng nếu có lỗi
    }
  }
}

// Export singleton instance (cho backward compatibility)
export const pancakeApiService = new PancakeApiService();

// Export class để có thể tạo instance riêng
export { PancakeApiService };
