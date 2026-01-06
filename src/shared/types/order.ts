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
  actualCod?: number; // COD thực thu (từ file đối soát)
  partialDelivery?: number; // Giao một phần (COD đã giao)
  returnedCod?: number; // COD hoàn (phần còn lại khi giao một phần)
  isPartialDelivery?: boolean; // Đánh dấu đơn giao một phần (có trong cả file đối soát và file hoàn)
  returnedInDeliveredFile?: boolean; // Đánh dấu đơn hoàn trong file đối soát (COD = 0 trong file đối soát)
  returnedFromFile?: boolean; // Đánh dấu đơn hoàn từ file hoàn (để tính "Đơn hoàn thực tế")
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
  
  // Đánh dấu nguồn gốc đơn hàng để phân biệt đơn thực sự gửi vs đơn được tạo từ file đối soát/hoàn
  source?: 'sent' | 'delivered' | 'returned'; // 'sent' = từ file gửi, 'delivered' = từ file đối soát, 'returned' = từ file hoàn
  // Đánh dấu đơn đã từng là đơn gửi (để tính "Tổng đơn gửi" không bị giảm khi cập nhật)
  wasSent?: boolean; // true = đơn này đã từng được import từ file gửi
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
  totalCod: number; // Tổng COD gửi
  totalShippingFee: number; // Tổng cước gửi
  totalCodDelivered: number; // Tổng COD đối soát
  totalCodReturned: number; // Tổng COD hoàn
  totalReturnShippingFee: number; // Tổng cước hoàn
  remainingAmount: number; // COD thu hộ = COD gửi - Cước gửi - COD hoàn
  codDifference: number; // Tiền chênh lệch COD sau sửa = COD thu hộ - Đã đối soát
  finalRemainingAmount: number; // Tiền còn lại = COD của các đơn chưa đối soát và chưa hoàn
  totalCodDeliveredFromSent: number; // COD đối soát ban đầu (từ file gửi) = Tổng COD ban đầu của các đơn đã đối soát
  codFromRemainingOrders: number; // COD của các đơn chưa xử lý (để kiểm tra)
  shippingFeeFromRemainingOrders: number; // Cước phí của các đơn chưa xử lý (để kiểm tra)
  codFromSentForDeliveredOnly: number; // COD đã đối soát (từ file gửi, COD ban đầu) - chỉ các đơn đã đối soát
  partialDeliveryCount?: number; // Số đơn hoàn 1 phần (đơn hoàn có chênh lệch COD)
}

export interface RegionStats {
  region: string;
  orderCount: number;
  deliveryRate: number;
  totalOrders: number;
}

