/**
 * Types for Pancake POS API
 */

export interface PancakeApiConfig {
  id: string;
  name: string; // Tên để phân biệt (ví dụ: "API chính", "API test")
  apiKey: string;
  baseUrl: string; // Mặc định: https://pos.pages.fm/api/v1
  isActive: boolean; // API đang được sử dụng
  createdAt: string;
  lastUsedAt?: string;
}

export interface PancakeShop {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface PancakePartner {
  extend_code?: string;
  extend_update?: Array<{ tracking_id?: string; [key: string]: unknown }>;
  tracking_id?: string;
  picked_up_at?: string;
  status?: string;
  tracking_status?: string;
  delivery_status?: string;
  partner_name?: string;
  partner_id?: string;
  status_text?: string;
  tracking_status_text?: string;
  delivery_status_text?: string;
  [key: string]: unknown;
}

export interface PancakeShippingAddress {
  full_address?: string;
  address?: string;
  [key: string]: unknown;
}

export interface PancakeOrderItem {
  variation_info?: { name?: string; [key: string]: unknown };
  product_name?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  [key: string]: unknown;
}

export interface PancakeOrder {
  id: string;
  code: string; // Mã đơn hàng
  order_id?: string | number;
  order_code?: string;
  tracking_number?: string; // Mã vận đơn
  tracking_code?: string;
  tracking?: string;
  tracking_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  bill_full_name?: string;
  bill_phone_number?: string;
  bill_address?: string;
  receiver_name?: string;
  receiver_fullname?: string;
  receiver_phone?: string;
  receiver_address?: string;
  customer_full_name?: string;
  customer_phone_number?: string;
  receiver_phone_number?: string;
  phone?: string;
  phone_number?: string;
  delivery_address?: string;
  delivery_address_full?: string;
  full_address?: string;
  cod?: number; // Tiền thu hộ COD
  actual_cod?: number; // COD thực thu (từ đối soát)
  actualCod?: number;
  shipping_fee?: number; // Cước phí
  shippingFee?: number;
  fee?: number;
  status?: string | number; // Trạng thái đơn hàng
  status_code?: number;
  status_name?: string;
  sub_status?: number | { code?: number; id?: number; value?: number; name?: string; [key: string]: unknown };
  sub_status_name?: string;
  order_status?: string;
  created_at?: string; // Ngày tạo
  updated_at?: string; // Ngày cập nhật
  delivery_date?: string; // Ngày giao hàng
  return_date?: string; // Ngày hoàn
  shop_id?: string;
  partner?: PancakePartner;
  shipping_address?: PancakeShippingAddress;
  partner_inserted_at?: string;
  logistics_shipped_at?: string;
  shipped_at?: string;
  sent_at?: string;
  shipped_date?: string;
  sent_date?: string;
  time_assign_seller?: string;
  logistics_sent_at?: string;
  inserted_at?: string;
  pickup_date?: string;
  first_delivery_at?: string;
  first_delivery_date?: string;
  items?: PancakeOrderItem[];
  note?: string;
  note_print?: string;
  internal_note?: string;
  note_internal?: string;
  comment?: string;
  print_note?: string;
  note_for_print?: string;
  shipping_note?: string;
  delivery_note?: string;
  carrier?: string;
  carrier_name?: string;
  logistics_name?: string;
  shipping_carrier?: string;
  logistics?: string;
  shipping_company?: string;
  delivery_company?: string;
  shipper_phone?: string;
  delivery_tel?: string;
  customer?: { address?: string; full_address?: string; [key: string]: unknown };
  from_returned_endpoint?: boolean;
  tags?: Array<{ id?: number; name?: string; [key: string]: unknown }>; // Tags do hệ thống Pancake tự cập nhật
  // Các trường khác từ API
  [key: string]: unknown;
}

export interface PancakeApiResponse<T> {
  data?: T;
  message?: string;
  success?: boolean;
  error?: string;
}

export interface PancakeOrdersResponse {
  data?: PancakeOrder[];
  orders?: PancakeOrder[];
  results?: PancakeOrder[];
  total?: number;
  total_entries?: number;
  total_pages?: number;
  page?: number;
  limit?: number;
  shops?: PancakeShop[];
}

export interface PancakeShopsResponse {
  data?: PancakeShop[];
  shops?: PancakeShop[];
}

export interface PancakeApiParams {
  page_number?: number;
  page_size?: number;
  filter_status?: string[];
  start_time?: number;
  end_time?: number;
  shop_id?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

