import type { OrderDetailContract, OrderPageContract, OrderSummaryContract } from "@lingdian/contracts";
import type { CartSummary } from "@/types/cart";
import type { OrderDetail, OrderSource, OrderSummary, OrderStatus } from "@/types/order";
import type { ServiceMode } from "@/types/store";
import { formatOrderSource, resolvePickupCode } from "@/utils/order-presentation";
import { getCurrentStoreId } from "./catalog";
import { clearCart } from "./cart";
import { request } from "./request";

type ApiChannelFields = {
  order_source?: OrderSource | string | null;
  pickup_code?: string | null;
  pickup_business_date?: string | null;
};

type ApiOrderSummary = Omit<OrderSummaryContract, keyof ApiChannelFields> & ApiChannelFields;
type ApiOrderPage = Omit<OrderPageContract, "items"> & { items: ApiOrderSummary[] };
type ApiOrder = ApiOrderSummary &
  Partial<Pick<OrderDetailContract, "items" | "status_logs">>;

const statusMap: Record<string, Exclude<OrderStatus, "unknown">> = {
  CREATING: "pendingPay",
  PENDING_PAYMENT: "pendingPay",
  PAID: "paid",
  PREPARING: "making",
  READY: "ready",
  COMPLETED: "finished",
  CANCELLED: "cancelled",
  REFUNDING: "refunding",
  REFUNDED: "refunded",
  FAILED: "cancelled",
  TIMED_OUT: "cancelled",
  DELETED: "cancelled",
};

function mapStatus(status: string): OrderStatus {
  return statusMap[status] ?? "unknown";
}

function mapServiceMode(orderType: string): OrderSummary["serviceMode"] {
  if (orderType === "DINE_IN") return "dineIn";
  if (orderType === "TAKEOUT") return "delivery";
  return "takeaway";
}

function paymentChannelLabel(channel: string | undefined): string {
  const labels: Record<string, string> = {
    CASH: "现金支付",
    WECHAT: "微信支付",
    ALIPAY: "支付宝",
    UNIONPAY: "银联支付",
    STRIPE: "Stripe",
    PAYPAL: "PayPal",
    CUSTOMER_SCAN: "顾客扫码支付",
    OTHER: "其他方式",
  };
  return channel ? labels[channel] ?? channel : "未记录";
}

export async function createOrderFromCart(
  cart: CartSummary,
  options: { serviceMode: ServiceMode; addressId?: string; clientRequestId?: string } = { serviceMode: "takeaway" },
) {
  if (cart.items.length === 0) {
    throw new Error("购物车为空");
  }
  if (options.serviceMode === "delivery" && !options.addressId?.trim()) {
    throw new Error("配送订单必须选择收货地址");
  }

  const storeId = await getCurrentStoreId();
  const order = await request<ApiOrder>("/order/create", {
    method: "POST",
    data: {
      clientRequestId: options.clientRequestId ?? createOrderRequestId(),
      storeId,
      orderType: options.serviceMode === "delivery"
        ? "takeout"
        : options.serviceMode === "dineIn"
          ? "dine_in"
          : "pickup",
      ...(options.serviceMode === "delivery" ? { addressId: options.addressId } : {}),
      paymentChannel: "cash",
      items: cart.items.map((item) => ({
        sku_id: item.skuId,
        quantity: item.quantity,
        selections: item.selectedOptions.map((option) => ({
          selectionGroupId: option.groupId,
          selectionOptionId: option.optionId,
          quantity: 1,
        })),
      })),
    },
  });
  clearCart();
  return order;
}

export function createOrderRequestId(): string {
  return `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export async function fetchOrders(page = 1, pageSize = 20) {
  const result = await request<ApiOrderPage>(`/customer/orders?page=${page}&pageSize=${pageSize}`);
  return {
    items: result.items.map<OrderSummary>((order) => ({
      id: order.id,
      orderNo: order.order_no,
      orderSource: order.order_source ?? null,
      pickupCode: resolvePickupCode(order.order_no, order.pickup_code),
      pickupBusinessDate: order.pickup_business_date ?? null,
      storeName: order.store_name,
      serviceMode: mapServiceMode(order.order_type),
      status: mapStatus(order.status),
      createdAt: order.created_at,
      totalAmount: order.payable_amount,
      itemCount: order.item_count ?? 0,
      productThumbs: [],
    })),
    total: result.total,
    page: result.page,
    pageSize: result.page_size,
  };
}

export async function fetchOrderDetail(orderId: string) {
  if (!orderId.trim()) throw new Error("订单编号不能为空");
  const order = await request<ApiOrder>(`/customer/orders/${encodeURIComponent(orderId)}`);
  const items = order.items ?? [];
  const goodsAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = Math.max(0, Math.round((goodsAmount - order.payable_amount) * 100) / 100);
  const paymentMethod = paymentChannelLabel(order.payment_channel);
  const expectedTime: string | null = null;
  const servedAt = order.status_logs?.find((log) => log.to_status === "READY")?.created_at ?? null;

  return {
    id: order.id,
    orderNo: order.order_no,
    orderSource: order.order_source ?? null,
    pickupCode: resolvePickupCode(order.order_no, order.pickup_code),
    pickupBusinessDate: order.pickup_business_date ?? null,
    storeName: order.store_name,
    serviceMode: mapServiceMode(order.order_type),
    status: mapStatus(order.status),
    createdAt: order.created_at,
    totalAmount: order.payable_amount,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    productThumbs: [],
    storeAddress: null,
    goodsAmount,
    discountTitle: discountAmount > 0 ? "优惠" : "暂无优惠",
    discountAmount,
    expectedTime,
    servedAt,
    paymentMethod,
    remark: order.remark ?? "无",
    items: items.map((item) => ({
      id: item.id,
      name: item.product_name,
      imageUrl: null,
      quantity: item.quantity,
      price: item.unit_price,
      specs: [
        ...(item.sku_name ? [item.sku_name] : []),
        ...item.selections.map((selection) => `${selection.quantity} x ${selection.option_name}`),
      ],
    })),
    infoRows: [
      {
        label: "订单类型",
        value: order.order_type === "DINE_IN" ? "堂食" : order.order_type === "TAKEOUT" ? "配送" : "自取",
      },
      { label: "订单来源", value: formatOrderSource(order.order_source) },
      ...(order.delivery_address ? [{ label: "配送地址", value: order.delivery_address }] : []),
      ...(order.pickup_business_date ? [{ label: "取餐日期", value: order.pickup_business_date }] : []),
      { label: "取餐码", value: resolvePickupCode(order.order_no, order.pickup_code) },
      { label: "订单编号", value: order.order_no, copyable: true },
      { label: "下单时间", value: order.created_at },
      { label: "预计取餐时间", value: expectedTime ?? "未记录" },
      { label: "出餐时间", value: servedAt ?? "未记录" },
      { label: "支付方式", value: paymentMethod },
      { label: "备注", value: order.remark ?? "无" },
    ],
  } satisfies OrderDetail;
}
