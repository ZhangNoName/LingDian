import { BadRequestException } from '@nestjs/common';
import type { UserAddress } from '@lingdian/contracts';
import type { OrderStatus, OrderType, PaymentChannel, PaymentIntentStatus, Prisma } from '@lingdian/db';
import type { CreateOrderDto } from './dto/create-order.dto';

export const ORDER_TYPE_BY_API_VALUE: Record<CreateOrderDto['orderType'], OrderType> = {
  dine_in: 'DINE_IN',
  takeout: 'TAKEOUT',
  pickup: 'PICKUP',
};

export const PAYMENT_CHANNEL_BY_API_VALUE: Record<
  NonNullable<CreateOrderDto['paymentChannel']>,
  PaymentChannel
> = {
  cash: 'CASH',
  wechat: 'WECHAT',
  alipay: 'ALIPAY',
  unionpay: 'UNIONPAY',
  stripe: 'STRIPE',
  paypal: 'PAYPAL',
  customer_scan: 'CUSTOMER_SCAN',
  other: 'OTHER',
};

const EDITABLE_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CREATING: ['PENDING_PAYMENT', 'CANCELLED', 'FAILED'],
  PENDING_PAYMENT: ['PAID', 'TIMED_OUT', 'CANCELLED', 'FAILED'],
  PAID: ['PREPARING', 'READY', 'COMPLETED', 'REFUNDING', 'REFUNDED'],
  PREPARING: ['READY', 'COMPLETED', 'REFUNDING', 'REFUNDED'],
  READY: ['COMPLETED', 'REFUNDING', 'REFUNDED'],
  COMPLETED: ['REFUNDING', 'REFUNDED'],
  REFUNDING: ['REFUNDED', 'FAILED'],
  FAILED: [],
  TIMED_OUT: [],
  CANCELLED: [],
  REFUNDED: [],
  DELETED: [],
};

const DELETABLE_STATUSES = new Set<OrderStatus>([
  'CANCELLED',
  'TIMED_OUT',
  'FAILED',
  'REFUNDED',
  'COMPLETED',
]);

const PENDING_PAYMENT_TERMINAL_STATUSES = new Set<OrderStatus>([
  'CANCELLED',
  'TIMED_OUT',
  'FAILED',
]);

export const BLOCKING_ORDER_PAYMENT_STATUSES: PaymentIntentStatus[] = ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'];
const CASH_ONLY_TRANSITIONS = new Set<OrderStatus>(['PAID', 'REFUNDING', 'REFUNDED']);

export function manualOrderTransitions(status: OrderStatus, paymentChannel: PaymentChannel | undefined): OrderStatus[] {
  return (EDITABLE_TRANSITIONS[status] ?? []).filter(target => paymentChannel === 'CASH' || !CASH_ONLY_TRANSITIONS.has(target));
}

export function assertManualOrderTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  paymentChannel: PaymentChannel | undefined,
): void {
  if (paymentChannel !== 'CASH' && CASH_ONLY_TRANSITIONS.has(targetStatus)) {
    throw new BadRequestException(targetStatus === 'PAID'
      ? 'Online payments can only be marked paid by a verified payment webhook'
      : 'Online refunds require a verified payment refund transaction');
  }
  if (!manualOrderTransitions(currentStatus, paymentChannel).includes(targetStatus)) {
    throw new BadRequestException(
      `Order status cannot change from ${currentStatus} to ${targetStatus}`,
    );
  }
}

export function isDeletableOrderStatus(status: OrderStatus): boolean {
  return DELETABLE_STATUSES.has(status);
}

export function isPendingPaymentTermination(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
): boolean {
  return currentStatus === 'PENDING_PAYMENT' && PENDING_PAYMENT_TERMINAL_STATUSES.has(targetStatus);
}

export function orderStatusTimestampPatch(status: OrderStatus, now = new Date()) {
  switch (status) {
    case 'PAID':
      return { paidAt: now };
    case 'CANCELLED':
      return { cancelledAt: now };
    case 'REFUNDING':
      return { refundingAt: now };
    case 'REFUNDED':
      return { refundedAt: now };
    default:
      return {};
  }
}

export function amountToCents(value: Prisma.Decimal | number): number {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents)) throw new BadRequestException('Order amount is too large');
  return cents;
}

export function centsToAmount(value: number): number {
  if (!Number.isSafeInteger(value)) throw new BadRequestException('Order amount is too large');
  return value / 100;
}

export function formatDeliveryAddress(address: UserAddress): string {
  return `${address.recipientName} ${address.phoneNumber} ${address.provinceName}${address.cityName}${address.countyName}${address.streetName}${address.detailInfo}`;
}
