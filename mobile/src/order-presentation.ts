import type { OrderStatus } from '@lingdian/contracts';

export const statusText: Record<OrderStatus, string> = {
  CREATING: '正在创建', PENDING_PAYMENT: '待付款', PAID: '已付款', PREPARING: '制作中', READY: '已备餐',
  COMPLETED: '已完成', CANCELLED: '已取消', TIMED_OUT: '已超时', REFUNDING: '退款中',
  REFUNDED: '已退款', FAILED: '订单失败', DELETED: '已删除',
};

export const orderTypeText = { DINE_IN: '堂食', PICKUP: '自取', TAKEOUT: '配送' };
export const ordersPath = { user: '/customer/orders', merchant: '/merchant/orders', admin: '/orders' };
