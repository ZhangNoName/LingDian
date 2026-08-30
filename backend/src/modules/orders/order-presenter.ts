import type { OrderDetailContract } from '@lingdian/contracts';
import { Prisma } from '@lingdian/db';

export const ORDER_DETAIL_INCLUDE = {
  store: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  items: {
    orderBy: [{ createdAt: 'asc' }],
    include: {
      selections: {
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  },
  statusLogs: {
    orderBy: [{ createdAt: 'asc' }],
  },
} satisfies Prisma.OrderInclude;

export type OrderDetailRecord = Prisma.OrderGetPayload<{
  include: typeof ORDER_DETAIL_INCLUDE;
}>;

export function mapOrderDetail(order: OrderDetailRecord): OrderDetailContract {
  return {
    id: order.id,
    order_no: order.orderNo,
    order_source: order.orderSource,
    pickup_code: order.pickupCode,
    pickup_business_date: toDateOnly(order.pickupBusinessDate),
    store_id: order.storeId,
    store_name: order.store.name,
    store_code: order.store.code,
    customer_name: order.customerName,
    customer_mobile: order.customerMobile,
    delivery_address: order.deliveryAddress,
    order_type: order.orderType,
    status: order.status,
    payment_channel: order.paymentChannel,
    total_amount: toNumber(order.totalAmount),
    payable_amount: toNumber(order.payableAmount),
    remark: order.remark,
    item_count: order.items.reduce((sum, item) => sum + item.quantity, 0),
    is_deleted: order.isDeleted,
    deleted_at: order.deletedAt?.toISOString() ?? null,
    paid_at: order.paidAt?.toISOString() ?? null,
    cancelled_at: order.cancelledAt?.toISOString() ?? null,
    refunding_at: order.refundingAt?.toISOString() ?? null,
    refunded_at: order.refundedAt?.toISOString() ?? null,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      product_id: item.productId,
      sku_id: item.skuId,
      product_name: item.productName,
      sku_name: item.skuName,
      unit_price: toNumber(item.unitPrice),
      quantity: item.quantity,
      subtotal: toNumber(item.subtotal),
      remark: item.remark,
      selections: item.selections.map((selection) => ({
        id: selection.id,
        selection_group_id: selection.selectionGroupId,
        selection_option_id: selection.selectionOptionId,
        group_name: selection.groupNameSnapshot,
        option_name: selection.optionNameSnapshot,
        option_type: selection.optionType,
        referenced_sku_id: selection.referencedSkuId,
        referenced_sku_name: selection.referencedSkuName,
        price_delta: toNumber(selection.priceDelta),
        quantity: selection.quantity,
      })),
    })),
    status_logs: order.statusLogs.map((log) => ({
      id: log.id,
      from_status: log.fromStatus,
      to_status: log.toStatus,
      operator_name: log.operatorName,
      note: log.note,
      created_at: log.createdAt.toISOString(),
    })),
  };
}

export function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
