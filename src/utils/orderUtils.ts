import { Order, OrderStatus, OrderStats, RegionStats } from '../types/order';
import { differenceInDays } from 'date-fns';

export function calculateOrderStats(orders: Order[]): OrderStats {
  // Loại trừ đơn hủy khỏi các tính toán
  const activeOrders = orders.filter(o => o.status !== OrderStatus.CANCELLED);
  
  const deliveredOrders = activeOrders.filter(o => o.status === OrderStatus.DELIVERED);
  const returnedOrders = activeOrders.filter(o => o.status === OrderStatus.RETURNED);
  const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED);

  // Tổng đơn gửi không tính đơn hủy
  const totalSent = activeOrders.length;
  const totalDelivered = deliveredOrders.length;
  const totalReturned = returnedOrders.length;
  const totalCancelled = cancelledOrders.length;

  // Tỉ lệ giao hàng = (Giao thành công) / (Tổng đơn gửi - Đơn hủy) * 100
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

  // Tính tổng COD và cước của các đơn đang hoạt động (chưa giao thành công, chưa hoàn, chưa hủy)
  const pendingOrders = activeOrders.filter(
    o => o.status === OrderStatus.SENT || o.status === OrderStatus.PENDING
  );

  const totalCod = pendingOrders.reduce((sum, order) => sum + order.cod, 0);
  const totalShippingFee = pendingOrders.reduce((sum, order) => sum + order.shippingFee, 0);
  const remainingAmount = totalCod - totalShippingFee;

  return {
    totalSent,
    totalDelivered,
    totalReturned,
    totalCancelled,
    deliveryRate: Math.round(deliveryRate * 100) / 100,
    totalCod,
    totalShippingFee,
    remainingAmount,
  };
}

export function calculateRegionStats(orders: Order[]): RegionStats[] {
  const regionMap = new Map<string, { total: number; delivered: number }>();

  // Chỉ tính các đơn không bị hủy
  orders.filter(o => o.status !== OrderStatus.CANCELLED).forEach(order => {
    const region = order.region || 'Không xác định';
    if (!regionMap.has(region)) {
      regionMap.set(region, { total: 0, delivered: 0 });
    }
    const stats = regionMap.get(region)!;
    stats.total++;
    if (order.status === OrderStatus.DELIVERED) {
      stats.delivered++;
    }
  });

  return Array.from(regionMap.entries()).map(([region, stats]) => ({
    region,
    orderCount: stats.total,
    deliveryRate: stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0,
    totalOrders: stats.total,
  })).sort((a, b) => b.orderCount - a.orderCount);
}

export function getWarningOrders(orders: Order[]): {
  yellow: Order[];
  red: Order[];
} {
  const now = new Date();
  const yellow: Order[] = [];
  const red: Order[] = [];

  // Chỉ cảnh báo các đơn đang hoạt động (không tính đơn hủy)
  orders.filter(o => o.status !== OrderStatus.CANCELLED).forEach(order => {
    if (order.status === OrderStatus.SENT || order.status === OrderStatus.PENDING) {
      const sendDate = new Date(order.sendDate);
      const daysDiff = differenceInDays(now, sendDate);

      if (daysDiff > 15) {
        red.push(order);
      } else if (daysDiff > 10) {
        yellow.push(order);
      }
    }
  });

  return { yellow, red };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

