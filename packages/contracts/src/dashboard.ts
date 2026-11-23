import type { OrderStatus, OrderType, PaymentChannel } from './order';
export interface MerchantDashboardSnapshot {
  storeId: string; startAt: string; endAt: string; generatedAt: string; currency: 'CNY';
  orders: { total: number; paid: number; completed: number; pendingPayment: number; refunding: number; refunded: number; cancelled: number; timedOut: number; failed: number; paidAmount: number };
  statuses: { status: OrderStatus; count: number }[];
  orderTypes: { type: OrderType; orders: number; paidOrders: number; paidAmount: number }[];
  topItems: { productId: string; skuId: string | null; productName: string; skuName: string | null; quantity: number; orderCount: number }[];
  operations: { openAlerts: number; acknowledgedAlerts: number; outOfStockMaterials: number; lowStockMaterials: number; pendingFulfillmentOrders: number; expiredStockHoldOrders: number };
}
export type StockHoldPaymentState = 'NONE' | 'ACTIVE' | 'REVIEW' | 'CONFIRMED';
export interface StockHoldRecord {
  orderId: string; orderNo: string; pickupCode: string | null; createdAt: string; expiresAt: string | null; paymentChannel: PaymentChannel;
  paymentState: StockHoldPaymentState; heldMaterialCount: number;
}
export interface StockHoldPage { items: StockHoldRecord[]; total: number; page: number; pageSize: number; generatedAt: string }
export interface StockHoldDetail {
  order: StockHoldRecord;
  materials: { itemId: string; name: string; code: string; unit: string; quantity: number }[];
  total: number; page: number; pageSize: number;
}
export interface StockHoldRecheckResult { outcome: 'RESOLVED' | 'PAYMENT_BLOCKED' | 'RETRY_LATER' }
