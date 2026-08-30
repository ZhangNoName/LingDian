import { BadRequestException } from '@nestjs/common';
import type { UserAddress } from '@lingdian/contracts';
import type { OrderStatus, OrderType, PaymentChannel, Prisma } from '@lingdian/db';
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

export function assertManualOrderTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  paymentChannel: PaymentChannel,
): void {
  if (targetStatus === 'PAID' && paymentChannel !== 'CASH') {
    throw new BadRequestException('Online payments can only be marked paid by a verified payment webhook');
  }
  if ((targetStatus === 'REFUNDING' || targetStatus === 'REFUNDED') && paymentChannel !== 'CASH') {
    throw new BadRequestException('Online refunds require a verified payment refund transaction');
  }
  if (!(EDITABLE_TRANSITIONS[currentStatus] ?? []).includes(targetStatus)) {
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
