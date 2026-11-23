import { ConflictException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PaymentChannel, PaymentProvider, Prisma } from '@lingdian/db';
import type { OrderStockService } from '../inventory/order-stock.service';

type SuccessfulPaymentInput = {
  orderNo: string;
  intentId: string;
  orderId: string;
  storeId: string;
  provider: PaymentProvider;
  channel: PaymentChannel;
  accountId: string;
  providerIntentId: string;
  eventId: string;
  providerTransactionId: string;
  occurredAt: Date;
};

export async function confirmSuccessfulPayment(
  tx: Prisma.TransactionClient,
  stock: Pick<OrderStockService, 'commit'>,
  input: SuccessfulPaymentInput,
): Promise<void> {
  // Take the order lock before reading or updating the intent. This makes the
  // following read observe the state that won the conditional transition,
  // instead of a repeatable-read snapshot captured before a lock wait.
  const changed = await tx.order.updateMany({
    where: { id: input.orderId, storeId: input.storeId, status: 'PENDING_PAYMENT' },
    data: { status: 'PAID', paidAt: input.occurredAt, paymentChannel: input.channel },
  });
  const currentOrderStatus = changed.count === 1
    ? 'PAID'
    : (await tx.order.findUnique({
        where: { id: input.orderId },
        select: { status: true },
      }))?.status;
  // Bind the provider reference under the intent lock before classifying this receipt.
  const intent = await tx.paymentIntent.update({
    where: {
      id: input.intentId, orderId: input.orderId, order: { storeId: input.storeId },
      OR: [{ providerIntentId: null }, { providerIntentId: input.providerIntentId }],
    },
    data: { providerIntentId: input.providerIntentId },
  }).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') throw new ConflictException('Payment intent changed while processing the webhook');
    throw error;
  });
  const transaction = await tx.paymentTransaction.upsert({
    where: {
      provider_accountId_providerTransactionId: {
        provider: input.provider,
        accountId: input.accountId,
        providerTransactionId: input.providerTransactionId,
      },
    },
    create: {
      transactionNo: `TXN${Date.now()}${randomBytes(5).toString('hex').toUpperCase()}`,
      paymentIntentId: intent.id,
      provider: input.provider,
      accountId: input.accountId,
      type: 'PAYMENT',
      status: 'SUCCEEDED',
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      providerTransactionId: input.providerTransactionId,
      idempotencyKey: input.eventId,
      occurredAt: input.occurredAt,
    },
    update: {},
  });
  if (
    transaction.paymentIntentId !== intent.id ||
    transaction.type !== 'PAYMENT' ||
    transaction.status !== 'SUCCEEDED' ||
    transaction.amountMinor !== intent.amountMinor ||
    transaction.currency !== intent.currency
  ) {
    throw new ConflictException(
      'Provider transaction is already assigned to a different payment fact',
    );
  }
  const otherReceipt = await tx.paymentTransaction.findFirst({
    where: { paymentIntentId: intent.id, type: 'PAYMENT', status: 'SUCCEEDED', NOT: { providerTransactionId: input.providerTransactionId } },
    select: { id: true },
  });
  const alreadyPaid = currentOrderStatus && ['PAID', 'PREPARING', 'READY', 'COMPLETED', 'REFUNDING', 'REFUNDED'].includes(currentOrderStatus);
  const duplicatePayment = otherReceipt || intent.failureCode === 'DUPLICATE_PAYMENT' ||
    (changed.count === 0 && alreadyPaid && intent.reconciliationStatus !== 'MATCHED');
  const matched = changed.count === 1 || intent.reconciliationStatus === 'MATCHED';
  await tx.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: 'SUCCEEDED',
      activeOrderKey: null,
      paidAt: intent.paidAt ?? input.occurredAt,
      reconciliationStatus: duplicatePayment ? 'MANUAL_REVIEW' : matched ? 'MATCHED' : 'LATE_PAYMENT',
      failureCode: duplicatePayment ? 'DUPLICATE_PAYMENT' : null,
      failureMessage: null,
    },
  });
  if (changed.count === 1) {
    await stock.commit(tx, { id: input.orderId, storeId: input.storeId, orderNo: input.orderNo }, `payment:${input.provider}`);
    await tx.orderStatusLog.create({
      data: {
        orderId: intent.orderId,
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'PAID',
        operatorName: `payment:${input.provider}`,
        note: 'Payment confirmed by verified webhook',
        extra: { paymentNo: intent.paymentNo, eventId: input.eventId },
      },
    });
  }
}
