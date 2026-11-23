import type { OrderDetailContract, OrderPageContract, OrderSummaryContract } from "@lingdian/contracts";
import type { CartSummary } from "@/types/cart";
import type { OrderDetail, OrderSource, OrderSummary, OrderStatus } from "@/types/order";
import type { ServiceMode } from "@/types/store";
import { formatOrderSource, formatOrderTime, resolvePickupCode } from "@/utils/order-presentation";
import { usesBrowserCookieTransport } from "@/config/platform";
import { getCurrentStoreId } from "./catalog";
import { customerAuth } from "./auth";
import { cartLineId, removeOrderedItems } from "./cart";
import { request, RequestError } from "./request";

type ApiChannelFields = {
  order_source?: OrderSource | string | null;
  pickup_code?: string | null;
  pickup_business_date?: string | null;
};

type ApiOrderSummary = Omit<OrderSummaryContract, keyof ApiChannelFields> & ApiChannelFields;
type ApiOrderPage = Omit<OrderPageContract, "items"> & { items: ApiOrderSummary[] };
type ApiOrder = ApiOrderSummary &
  Partial<Pick<OrderDetailContract, "items" | "status_logs" | "stock_expires_at">>;

export const MAX_ORDER_REMARK_LENGTH = 191;

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
  FAILED: "failed",
  TIMED_OUT: "timedOut",
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

function pickupCodeForDisplay(order: ApiOrderSummary): string | undefined {
  if (!["PENDING_PAYMENT", "PAID", "PREPARING", "READY", "COMPLETED"].includes(order.status)) return;
  return order.pickup_code?.trim() || undefined;
}

function orderCodeLabel(orderType: string): OrderSummary["pickupCodeLabel"] {
  return orderType === "TAKEOUT" ? "订单码" : "取餐码";
}

function paymentChannelLabel(channel: string | undefined): string {
  const labels: Record<string, string> = {
    CASH: "线下支付",
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

type CheckoutAttempt = {
  key: string;
  scope: string;
  clientRequestId: string;
  pending?: Promise<ApiOrder>;
};
let checkoutAttempt: CheckoutAttempt | undefined;

function checkoutStorage() {
  if (usesBrowserCookieTransport() && typeof sessionStorage !== "undefined") return sessionStorage;
  return { getItem: uni.getStorageSync, setItem: uni.setStorageSync, removeItem: uni.removeStorageSync };
}

export async function createOrderFromCart(
  cart: CartSummary,
  options: {
    serviceMode: ServiceMode;
    addressId?: string;
    clientRequestId?: string;
    remark?: string;
  } = { serviceMode: "takeaway" },
) {
  if (cart.items.length === 0) {
    throw new Error("购物车为空");
  }
  if (options.serviceMode === "delivery" && !options.addressId?.trim()) {
    throw new Error("配送订单必须选择收货地址");
  }
  const remark = options.remark?.trim() ?? "";
  if (Array.from(remark).length > MAX_ORDER_REMARK_LENGTH) {
    throw new Error(`订单备注最多 ${MAX_ORDER_REMARK_LENGTH} 字`);
  }

  const session = customerAuth.getSessionVersion();
  const storeId = await getCurrentStoreId();
  if (session !== customerAuth.getSessionVersion()) throw new Error("登录账号已变更，请重新提交");
  const data = {
    storeId,
    orderType: options.serviceMode === "delivery"
      ? "takeout"
      : options.serviceMode === "dineIn"
        ? "dine_in"
        : "pickup",
    ...(options.serviceMode === "delivery" ? { addressId: options.addressId } : {}),
    ...(remark ? { remark } : {}),
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
  };
  const userId = customerAuth.getUser()?.userId;
  const scope = JSON.stringify([userId, storeId, options.clientRequestId]);
  const storageKey = userId && !options.clientRequestId ? `lingdian:checkout:${scope}` : undefined;
  const key = JSON.stringify([scope, options.clientRequestId, data]);
  if (checkoutAttempt?.pending) {
    if (checkoutAttempt.key === key) return checkoutAttempt.pending;
    throw new Error("上一笔订单正在提交，请稍后再试");
  }
  // Only the request id survives a restart. The server returns the order that actually committed.
  const storage = checkoutStorage();
  const savedId = storageKey ? storage.getItem(storageKey) : undefined;
  const previous = checkoutAttempt?.scope === scope ? checkoutAttempt : undefined;
  const recoveredId = typeof savedId === "string" && savedId ? savedId : previous?.clientRequestId;
  const clientRequestId = options.clientRequestId ?? recoveredId ?? createOrderRequestId();
  const attempt: CheckoutAttempt = { key, scope, clientRequestId };
  if (storageKey) storage.setItem(storageKey, clientRequestId);
  checkoutAttempt = attempt;
  attempt.pending = request<ApiOrder>("/order/create", {
    method: "POST",
    data: { ...data, clientRequestId: attempt.clientRequestId },
  });
  try {
    const order = await attempt.pending;
    if (!order?.id) throw new Error("下单结果尚未确认，请重试");
    if (storageKey) storage.removeItem(storageKey);
    if (Array.isArray(order.items)) {
      removeOrderedItems(order.items.map((item) => ({
        id: cartLineId(item.product_id, item.sku_id, item.selections.map((option) => ({
          groupId: option.selection_group_id, optionId: option.selection_option_id,
        }))),
        quantity: item.quantity,
      })));
    } else if ((!savedId && !previous) || previous?.key === key) {
      removeOrderedItems(cart.items);
    }
    checkoutAttempt = undefined;
    return order;
  } catch (error) {
    if (error instanceof RequestError && (error.statusCode ?? 0) >= 500) {
      throw new Error("下单结果待确认，请重试或查看我的订单");
    }
    throw error;
  } finally {
    attempt.pending = undefined;
  }
}

function createOrderRequestId(): string {
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
      pickupCodeLabel: orderCodeLabel(order.order_type),
      pickupCardCode: pickupCodeForDisplay(order),
      pickupBusinessDate: order.pickup_business_date ?? null,
      storeName: order.store_name,
      serviceMode: mapServiceMode(order.order_type),
      status: mapStatus(order.status),
      createdAt: order.created_at,
      totalAmount: order.payment_required === false ? order.total_amount ?? 0 : order.payable_amount,
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
  const status = mapStatus(order.status);
  const serviceMode = mapServiceMode(order.order_type);
  const pickupCode = resolvePickupCode(order.order_no, order.pickup_code);
  const pickupCodeLabel = orderCodeLabel(order.order_type);
  const pickupCardCode = pickupCodeForDisplay(order);
  const items = order.items ?? [];
  const goodsAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalAmount = order.payment_required === false ? order.total_amount ?? goodsAmount : order.payable_amount;
  const discountAmount = Math.max(0, Math.round((goodsAmount - totalAmount) * 100) / 100);
  const paymentMethod = paymentChannelLabel(order.payment_channel);
  const expectedTime: string | null = null;
  const servedAt = order.status_logs?.find((log) => log.to_status === "READY")?.created_at ?? null;

  return {
    id: order.id,
    orderNo: order.order_no,
    orderSource: order.order_source ?? null,
    pickupCode,
    pickupCodeLabel,
    pickupBusinessDate: order.pickup_business_date ?? null,
    storeName: order.store_name,
    serviceMode,
    status,
    createdAt: order.created_at,
    totalAmount,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    productThumbs: [],
    storeAddress: null,
    goodsAmount,
    discountTitle: discountAmount > 0 ? "优惠" : "暂无优惠",
    discountAmount,
    expectedTime,
    servedAt,
    paymentMethod,
    pickupCardCode,
    paymentChannel: order.payment_channel,
    remark: order.remark ?? "无",
    items: items.map((item) => ({
      id: item.id,
      name: item.product_name,
      imageUrl: null,
      quantity: item.quantity,
      subtotal: item.subtotal,
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
      ...(order.pickup_business_date ? [{ label: serviceMode === "delivery" ? "营业日期" : "取餐日期", value: order.pickup_business_date }] : []),
      ...(pickupCardCode ? [] : [{ label: pickupCodeLabel, value: pickupCode }]),
      { label: "订单编号", value: order.order_no, copyable: true },
      { label: "下单时间", value: formatOrderTime(order.created_at) },
      ...(order.status === "PENDING_PAYMENT" && order.stock_expires_at ? [{ label: "原料预留至", value: formatOrderTime(order.stock_expires_at) }] : []),
      ...(servedAt ? [{ label: "出餐时间", value: formatOrderTime(servedAt) }] : []),
      ...(order.payment_required === false ? [] : [{ label: "支付方式", value: paymentMethod }]),
      { label: "备注", value: order.remark ?? "无" },
    ],
  } satisfies OrderDetail;
}
