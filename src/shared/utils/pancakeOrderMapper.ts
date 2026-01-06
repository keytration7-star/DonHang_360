/**
 * Pancake Order Mapper
 * Convert PancakeOrder từ API sang Order type của app
 */

import { PancakeOrder } from '../types/pancakeApi';
import { Order, OrderStatus } from '../types/order';

/**
 * Convert single PancakeOrder to Order
 */
export function pancakeOrderToOrder(pancakeOrder: PancakeOrder): Order {
  const now = new Date().toISOString();
  
  // Extract tracking number (ưu tiên các field có thể có)
  const trackingNumber = pancakeOrder.tracking_number || 
                        pancakeOrder.tracking_code || 
                        pancakeOrder.tracking || 
                        pancakeOrder.tracking_id || 
                        pancakeOrder.code || 
                        pancakeOrder.id;

  // Extract customer name
  const customerName = pancakeOrder.receiver_name || 
                      pancakeOrder.receiver_fullname || 
                      pancakeOrder.customer_full_name || 
                      pancakeOrder.customer_name || 
                      pancakeOrder.bill_full_name || 
                      '';

  // Extract customer phone
  const customerPhone = pancakeOrder.receiver_phone || 
                       pancakeOrder.receiver_phone_number || 
                       pancakeOrder.customer_phone_number || 
                       pancakeOrder.customer_phone || 
                       pancakeOrder.bill_phone_number || 
                       pancakeOrder.phone || 
                       pancakeOrder.phone_number || 
                       '';

  // Extract customer address
  const customerAddress = pancakeOrder.receiver_address || 
                         pancakeOrder.delivery_address_full || 
                         pancakeOrder.delivery_address || 
                         pancakeOrder.full_address || 
                         pancakeOrder.customer_address || 
                         pancakeOrder.bill_address || 
                         pancakeOrder.shipping_address?.full_address || 
                         pancakeOrder.shipping_address?.address || 
                         pancakeOrder.customer?.full_address || 
                         pancakeOrder.customer?.address || 
                         '';

  // Extract COD
  const cod = pancakeOrder.cod || pancakeOrder.actualCod || 0;
  const actualCod = pancakeOrder.actual_cod || pancakeOrder.actualCod;

  // Extract shipping fee
  const shippingFee = pancakeOrder.shipping_fee || 
                     pancakeOrder.shippingFee || 
                     pancakeOrder.fee || 
                     0;

  // Extract dates
  const sendDate = pancakeOrder.created_at || 
                  pancakeOrder.sent_at || 
                  pancakeOrder.sent_date || 
                  pancakeOrder.shipped_at || 
                  pancakeOrder.shipped_date || 
                  pancakeOrder.logistics_sent_at || 
                  pancakeOrder.partner_inserted_at || 
                  pancakeOrder.inserted_at || 
                  now;

  const pickupDate = pancakeOrder.pickup_date || 
                    pancakeOrder.picked_up_at || 
                    pancakeOrder.time_assign_seller;

  // Extract order status from partner
  const orderStatus = pancakeOrder.partner?.delivery_status_text || 
                     pancakeOrder.partner?.tracking_status_text || 
                     pancakeOrder.partner?.status_text || 
                     pancakeOrder.status_name || 
                     pancakeOrder.order_status || 
                     '';

  // Determine OrderStatus
  let status: OrderStatus = OrderStatus.SENT;
  const statusLower = orderStatus.toLowerCase();
  if (statusLower.includes('delivered') || statusLower.includes('đã giao')) {
    status = OrderStatus.DELIVERED;
  } else if (statusLower.includes('returned') || statusLower.includes('hoàn') || statusLower.includes('return')) {
    status = OrderStatus.RETURNED;
  } else if (statusLower.includes('cancelled') || statusLower.includes('hủy')) {
    status = OrderStatus.CANCELLED;
  }

  // Extract goods content from items
  const goodsContent = pancakeOrder.items?.map(item => {
    const name = item.product_name || item.name || '';
    const qty = item.quantity || item.qty || 1;
    const variant = item.variation_info?.name || '';
    return `${name}${variant ? ` (${variant})` : ''} x${qty}`;
  }).join(', ') || pancakeOrder.note || '';

  // Extract carrier
  const carrier = pancakeOrder.carrier_name || 
                pancakeOrder.logistics_name || 
                pancakeOrder.shipping_carrier || 
                pancakeOrder.logistics || 
                pancakeOrder.shipping_company || 
                pancakeOrder.delivery_company || 
                pancakeOrder.carrier || 
                '';

  const order: Order = {
    id: pancakeOrder.id,
    trackingNumber: String(trackingNumber),
    orderStatus,
    sendDate,
    pickupDate,
    status,
    customerName,
    customerPhone,
    customerAddress,
    cod,
    actualCod,
    shippingFee,
    goodsContent,
    carrier,
    source: 'sent',
    wasSent: true,
    createdAt: pancakeOrder.created_at || now,
    updatedAt: pancakeOrder.updated_at || now,
    rawData: pancakeOrder, // Lưu toàn bộ dữ liệu gốc
  };

  return order;
}

/**
 * Convert array of PancakeOrder to array of Order
 */
export function pancakeOrdersToOrders(pancakeOrders: PancakeOrder[]): Order[] {
  return pancakeOrders.map(pancakeOrder => pancakeOrderToOrder(pancakeOrder));
}
