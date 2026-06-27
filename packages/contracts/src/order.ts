export type OrderStatus =
  | 'CREATING'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'TIMED_OUT'
  | 'REFUNDING'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'FAILED'
  | 'DELETED';

export type OrderType = 'DINE_IN' | 'TAKEOUT' | 'PICKUP';
export type PaymentChannel = 'CASH' | 'WECHAT' | 'ALIPAY' | 'CUSTOMER_SCAN' | 'OTHER';

export type OrderItemSummaryContract = {
  id: string;
  name: string;
  sku_name: string | null;
  quantity: number;
  subtotal: number;
};

export type OrderSummaryContract = {
  id: string;
  order_no: string;
  store_id?: string;
  store_name: string;
  customer_name: string;
  customer_mobile: string;
  order_type: OrderType;
  status: OrderStatus;
  payment_channel?: PaymentChannel;
  total_amount?: number;
  payable_amount: number;
  remark?: string | null;
  item_count: number;
  item_summary: OrderItemSummaryContract[];
  created_at: string;
  updated_at?: string;
};

export type OrderDetailItemSelectionContract = {
  id: string;
  selection_group_id: string | null;
  selection_option_id: string | null;
  group_name: string;
  option_name: string;
  option_type: string;
  referenced_sku_id: string | null;
  referenced_sku_name: string | null;
  price_delta: number;
  quantity: number;
};

export type OrderDetailItemContract = {
  id: string;
  product_id: string;
  sku_id: string | null;
  product_name: string;
  sku_name: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  remark: string | null;
  selections: OrderDetailItemSelectionContract[];
};

export type OrderStatusLogContract = {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  operator_name: string | null;
  note: string | null;
  created_at: string;
};

export type OrderDetailContract = Omit<OrderSummaryContract, 'item_summary'> & {
  store_code: string;
  is_deleted: boolean;
  deleted_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  refunding_at: string | null;
  refunded_at: string | null;
  items: OrderDetailItemContract[];
  status_logs: OrderStatusLogContract[];
};

export type OrderSummaryStatsContract = {
  total_count: number;
  pending_payment_count: number;
  paid_count: number;
  refunding_count: number;
  refunded_count: number;
  total_amount: number;
};
