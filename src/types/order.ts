export interface Order {
  id: string;
  // Thông tin cơ bản
  trackingNumber: string; // Mã vận đơn
  orderStatus?: string; // Trạng thái vận đơn
  sendDate: string; // Ngày gửi (Thời gian tạo đơn)
  pickupDate?: string; // Thời gian lấy hàng
  status: OrderStatus; // Trạng thái đơn hàng trong app (sent/delivered/returned)
  
  // Thông tin người nhận
  customerName: string; // Tên người nhận
  customerPhone: string; // SĐT người nhận
  customerAddress: string; // Địa chỉ người nhận
  administrativeAddress?: string; // Địa chỉ hành chính
  
  // Thông tin người gửi
  senderName?: string; // Tên người gửi
  senderPhone?: string; // SĐT người gửi
  senderAddress?: string; // Địa chỉ người gửi
  
  // Thông tin hàng hóa
  goodsContent?: string; // Nội dung hàng hóa
  goodsType?: string; // Loại hàng
  chargeableWeight?: number; // Trọng lượng tính phí
  
  // Thông tin tài chính
  cod: number; // Tiền thu hộ COD
  actualCod?: number; // COD thực thu
  partialDelivery?: number; // Giao một phần
  shippingFee: number; // Cước phí
  paymentMethod?: string; // Phương thức kết toán
  
  // Thông tin bổ sung
  region?: string; // Khu vực (tự động phân tích từ địa chỉ)
  createdAt: string;
  updatedAt: string;
  
  // Quản lý cảnh báo
  warningStatus?: 'none' | 'pending' | 'tracking' | 'compensated'; // Trạng thái cảnh báo: none (không), pending (chưa xử lý), tracking (đang theo dõi), compensated (đã đền bù)
  warningNote?: string; // Ghi chú về cảnh báo
  
  // Lưu toàn bộ dữ liệu gốc từ Excel
  rawData?: Record<string, any>; // Lưu tất cả các cột khác không được map
}

export enum OrderStatus {
  SENT = 'sent', // Đã gửi
  DELIVERED = 'delivered', // Giao thành công
  RETURNED = 'returned', // Đã hoàn
  PENDING = 'pending', // Chờ xử lý
  CANCELLED = 'cancelled', // Đã hủy
}

export interface OrderStats {
  totalSent: number;
  totalDelivered: number;
  totalReturned: number;
  totalCancelled: number;
  deliveryRate: number; // Tỉ lệ giao hàng
  totalCod: number;
  totalShippingFee: number;
  remainingAmount: number; // Số tiền còn lại
}

export interface RegionStats {
  region: string;
  orderCount: number;
  deliveryRate: number;
  totalOrders: number;
}

