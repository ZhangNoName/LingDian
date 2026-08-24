import type { OrderDetailContract, OrderPageContract, OrderSummaryContract } from "@lingdian/contracts";
import type { CartSummary } from "@/types/cart";
import type { OrderDetail, OrderSummary, OrderStatus } from "@/types/order";
import { getCurrentStoreId } from "./catalog";
import { clearCart } from "./cart";
import { request } from "./request";

type ApiOrder = OrderSummaryContract &
  Partial<Pick<OrderDetailContract, "items" | "paid_at">>;

const statusMap: Record<string, OrderStatus> = {
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
};

function mapStatus(status: string): OrderStatus {
  return statusMap[status] ?? "pendingPay";
}

export async function createOrderFromCart(
  cart: CartSummary,
  options: { serviceMode: "takeaway" | "delivery"; addressId?: string; clientRequestId?: string } = { serviceMode: "takeaway" },
) {
  if (cart.items.length === 0) {
    throw new Error("购物车为空");
  }

  const storeId = await getCurrentStoreId();
  const order = await request<ApiOrder>("/order/create", {
    method: "POST",
    data: {
      clientRequestId: options.clientRequestId ?? createOrderRequestId(),
      storeId,
      orderType: options.serviceMode === "delivery" ? "takeout" : "pickup",
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
  const result = await request<OrderPageContract>(`/customer/orders?page=${page}&pageSize=${pageSize}`);
  return {
    items: result.items.map<OrderSummary>((order) => ({
      id: order.id,
      storeName: order.store_name,
      serviceMode: order.order_type === "TAKEOUT" ? "delivery" : "takeaway",
      status: mapStatus(order.status),
      createdAt: order.created_at,
      totalAmount: order.payable_amount,
      itemCount: order.item_count ?? 0,
      productThumbs: ["/static/products/milk-green.jpg"],
    })),
    total: result.total,
    page: result.page,
    pageSize: result.page_size,
  };
}

export async function fetchOrderDetail(orderId: string) {
  const order = await request<ApiOrder>(`/customer/orders/${orderId}`);
  const items = order.items ?? [];
  const goodsAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: order.id,
    storeName: order.store_name,
    serviceMode: order.order_type === "TAKEOUT" ? "delivery" : "takeaway",
    status: mapStatus(order.status),
    createdAt: order.created_at,
    totalAmount: order.payable_amount,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    productThumbs: ["/static/products/milk-green.jpg"],
    storeAddress: "当前门店",
    rewardPoints: Math.max(1, Math.round(order.payable_amount)),
    goodsAmount,
    discountTitle: "暂无优惠",
    discountAmount: 0,
    pickupNo: order.order_no.slice(-3),
    expectedTime: "立即取餐",
    servedAt: order.paid_at ?? "制作中",
    paymentMethod: "模拟支付",
    remark: order.remark ?? "无",
    items: items.map((item) => ({
      id: item.id,
      name: item.product_name,
      imageUrl: "/static/products/milk-green.jpg",
      quantity: item.quantity,
      price: item.unit_price,
      specs: [
        item.sku_name ?? "默认",
        ...item.selections.map((selection) => `${selection.quantity} x ${selection.option_name}`),
      ],
    })),
    infoRows: [
      { label: "订单类型", value: order.order_type === "TAKEOUT" ? "配送" : "自取" },
      ...(order.delivery_address ? [{ label: "配送地址", value: order.delivery_address }] : []),
      { label: "取餐号", value: order.order_no.slice(-3) },
      { label: "订单编号", value: order.order_no, copyable: true },
      { label: "下单时间", value: order.created_at },
      { label: "支付方式", value: "模拟支付" },
      { label: "备注", value: order.remark ?? "无" },
    ],
  } satisfies OrderDetail;
}
