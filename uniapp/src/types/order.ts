import type { CartItem } from "./cart";
import type { ServiceMode, StoreSummary } from "./store";

export type OrderStatus =
  | "pendingPay"
  | "paid"
  | "making"
  | "ready"
  | "finished"
  | "cancelled"
  | "refunding"
  | "refunded"
  | "unknown";

export type OrderSource =
  | "MINIAPP"
  | "MEITUAN_WAIMAI"
  | "JD_DAOJIA"
  | "POS"
  | "MANUAL";

export type OrderSummary = {
  id: string;
  orderNo: string;
  orderSource: OrderSource | string | null;
  pickupCode: string;
  pickupBusinessDate: string | null;
  storeName: string;
  serviceMode: ServiceMode;
  status: OrderStatus;
  createdAt: string;
  totalAmount: number;
  itemCount: number;
  productThumbs: string[];
};

export type OrderDetailItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  price: number;
  tag?: string;
  specs?: string[];
};

export type OrderInfoRow = {
  label: string;
  value: string;
  copyable?: boolean;
};

export type OrderDetail = OrderSummary & {
  storeAddress: string | null;
  rewardPoints?: number;
  goodsAmount: number;
  discountTitle: string;
  discountAmount: number;
  expectedTime: string | null;
  servedAt: string | null;
  paymentMethod: string;
  remark: string;
  items: OrderDetailItem[];
  infoRows: OrderInfoRow[];
};

export type OrderAmount = {
  goodsAmount: number;
  discountAmount: number;
  couponAmount: number;
  payableAmount: number;
};

export type AddOnProduct = {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  saveText: string;
};

export type CheckoutViewModel = {
  store: StoreSummary;
  serviceMode: ServiceMode;
  pickupTimeText: string;
  items: CartItem[];
  addOns: AddOnProduct[];
  amount: OrderAmount;
};
