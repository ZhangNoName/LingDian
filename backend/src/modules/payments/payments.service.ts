import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PaymentChannel, PaymentProvider, Prisma } from '@lingdian/db';
import type { PaymentIntentContract } from '@lingdian/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { UpsertPaymentAccountDto } from './dto/upsert-payment-account.dto';
import {
  PaymentGatewayFactory,
  PaymentWebhookPayload,
} from './payment.gateway';
import { StoreContextResolver } from '../stores/store-context.resolver';
import { OrderStockService } from '../inventory/order-stock.service';
import { PaymentExpiryService } from './payment-expiry.service';

const providerChannels: Record<PaymentProvider, PaymentChannel> = {
  WECHAT_PAY: 'WECHAT', ALIPAY: 'ALIPAY', UNIONPAY: 'UNIONPAY', STRIPE: 'STRIPE', PAYPAL: 'PAYPAL',
};

const intentOrder = { order: { select: { status: true } } } as const;
type CustomerIntent = Prisma.PaymentIntentGetPayload<{ include: typeof intentOrder }>;

type PaymentAccountView = {
  id: string; storeId: string; provider: PaymentProvider; channel: PaymentChannel;
  externalAccountId: string; connectorConfigKey: string; status: 'ACTIVE' | 'DISABLED'; updatedAt: Date;
};

type IntentReservationInput = {
  orderId: string;
  customerUserId: string;
  storeId: string;
  accountId: string;
  provider: PaymentProvider;
  channel: PaymentChannel;
  amountMinor: number;
  clientRequestId: string;
  expiresAt: Date;
};

type SuccessfulPaymentInput = {
  orderNo: string;
  intentId: string;
  orderId: string;
  storeId: string;
  provider: PaymentProvider;
  accountId: string;
  providerIntentId: string;
  eventId: string;
  providerTransactionId: string;
  occurredAt: Date;
};

const INTENT_RESERVATION_MAX_ATTEMPTS = 3;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateways: PaymentGatewayFactory,
    private readonly stores: StoreContextResolver,
    private readonly expiry: PaymentExpiryService = new PaymentExpiryService(prisma, gateways),
    private readonly stock: OrderStockService,
  ) {}

  async createIntent(orderId: string, customerUserId: string, body: CreatePaymentIntentDto) {
    if (providerChannels[body.provider] !== body.channel) {
      throw new BadRequestException('Payment provider does not support the requested channel');
    }
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerUserId, ...(this.stores.mode === 'multi' ? {} : { storeId: this.stores.primaryStoreId() }), isDeleted: false },
      select: { id: true, orderNo: true, storeId: true, status: true, paymentChannel: true, payableAmount: true, stockExpiresAt: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const storeId = this.stores.resolveRequestedStoreId(order.storeId);
    let existing = await this.prisma.paymentIntent.findUnique({
      where: { orderId_clientRequestId: { orderId, clientRequestId: body.clientRequestId } },
      include: intentOrder,
    });
    if (existing) {
      this.assertRequestedMethod(existing, body);
      if (this.expiry.isExpiredActiveIntent(existing)) {
        await this.expiry.recoverExpiredAttempt(orderId, storeId);
        existing = await this.prisma.paymentIntent.findUnique({
          where: { orderId_clientRequestId: { orderId, clientRequestId: body.clientRequestId } },
          include: intentOrder,
        });
      }
      if (existing) return this.mapIntent(existing);
    }
    await this.expiry.recoverExpiredAttempt(orderId, storeId);
    if (order.status !== 'PENDING_PAYMENT') throw new ConflictException('Order is not awaiting payment');
    const amountMinor = this.toMinor(order.payableAmount);
    if (amountMinor <= 0) throw new BadRequestException('Payment amount must be positive');
    const account = await this.prisma.paymentAccount.findUnique({
      where: { storeId_provider_channel: { storeId: order.storeId, provider: body.provider, channel: body.channel } },
    });
    if (!account || account.status !== 'ACTIVE') {
      throw new BadRequestException('The store has no active receiving account for this payment method');
    }
    const now = Date.now();
    const expiresAt = new Date(Math.min(now + 15 * 60_000, order.stockExpiresAt?.getTime() ?? Infinity));
    if (expiresAt.getTime() <= now) throw new ConflictException('The ingredient reservation has expired');
    const reservation = await this.reserveIntent({
      orderId,
      customerUserId,
      storeId,
      accountId: account.id,
      provider: body.provider,
      channel: body.channel,
      amountMinor,
      clientRequestId: body.clientRequestId,
      expiresAt,
    });
    if (!reservation.created) {
      this.assertRequestedMethod(reservation.intent, body);
      return this.mapIntent(reservation.intent);
    }
    const intent = reservation.intent;

    let result;
    try {
      result = await this.gateways.create(account).createIntent({
        paymentNo: intent.paymentNo, orderNo: order.orderNo, amountMinor, currency: 'CNY', expiresAt,
      });
    } catch (error) {
      const markedUnknown = await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: 'CREATED' }, data: {
        reconciliationStatus: 'MANUAL_REVIEW', failureCode: 'CONNECTOR_OUTCOME_UNKNOWN',
        failureMessage: 'Payment connector outcome is unknown; the attempt remains blocked until verified closure',
      } });
      if (markedUnknown.count === 0) {
        const current = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id }, include: intentOrder });
        if (current.status === 'SUCCEEDED' || current.status === 'FAILED') return this.mapIntent(current);
      }
      throw error;
    }
    if (result.accountExternalId !== account.externalAccountId || result.amountMinor !== amountMinor || result.currency !== 'CNY') {
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: {
        reconciliationStatus: 'MANUAL_REVIEW',
        failureCode: 'CONNECTOR_RESPONSE_MISMATCH',
      } });
      throw new ConflictException('Payment connector returned mismatched recipient or amount');
    }

    // A synchronous connector response is not a money-movement fact. Even if
    // it reports success, keep the attempt in progress until a signed webhook
    // supplies the provider transaction id and occurrence time.
    const acknowledgedStatus = result.status === 'SUCCEEDED' ? 'PROCESSING' : result.status;
    const acknowledged = await this.prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: 'CREATED', activeOrderKey: orderId },
      data: {
        providerIntentId: result.providerIntentId,
        status: acknowledgedStatus,
        activeOrderKey: acknowledgedStatus === 'PENDING' || acknowledgedStatus === 'PROCESSING'
          ? orderId
          : null,
        clientAction: result.clientAction as Prisma.InputJsonValue | undefined,
      },
    });
    if (!acknowledged.count && result.clientAction && ['PENDING', 'PROCESSING'].includes(acknowledgedStatus)) {
      await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: 'PROCESSING', activeOrderKey: orderId, providerIntentId: result.providerIntentId },
        data: { clientAction: result.clientAction as Prisma.InputJsonValue },
      });
    }
    // A webhook may have settled the intent while the connector request was in flight.
    const current = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id }, include: intentOrder });
    return this.mapIntent(current);
  }

  async getCustomerIntent(paymentNo: string, customerUserId: string) {
    const storeScope = this.stores.mode === 'multi' ? {} : { storeId: this.stores.primaryStoreId() };
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { paymentNo, order: { customerUserId, ...storeScope } },
      include: intentOrder,
    });
    if (!intent) throw new NotFoundException('Payment not found');
    return this.mapIntent(intent);
  }

  async handleWebhook(provider: PaymentProvider, accountId: string, rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    if (!Object.prototype.hasOwnProperty.call(providerChannels, provider)) {
      throw new BadRequestException('Unsupported payment provider');
    }
    const account = await this.prisma.paymentAccount.findFirst({
      where: { id: accountId, provider, ...(this.stores.mode === 'multi' ? {} : { storeId: this.stores.primaryStoreId() }) },
    });
    if (!account) throw new NotFoundException('Payment account not found');
    const payload = this.gateways.create(account).verifyWebhook(rawBody, headers);
    this.validatePayload(payload);
    const occurredAt = new Date(payload.occurred_at);
    if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException('Invalid webhook occurrence time');
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    try {
      await this.prisma.paymentWebhookEvent.create({ data: {
        provider, accountId, eventId: payload.event_id, eventType: payload.event_type,
        payloadHash, signatureVerified: true,
      } });
    } catch (error) {
      if (this.isUniqueError(error)) {
        const duplicate = await this.prisma.paymentWebhookEvent.findUnique({
          where: { provider_accountId_eventId: { provider, accountId, eventId: payload.event_id } },
          select: { payloadHash: true, processedAt: true },
        });
        if (!duplicate || duplicate.payloadHash !== payloadHash) {
          throw new ConflictException('Webhook event id was reused with a different payload');
        }
        if (duplicate.processedAt) return { accepted: true, duplicate: true };
        // An earlier delivery may have failed after reserving the event. Resume it safely.
      } else {
        throw error;
      }
    }
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { paymentNo: payload.payment_no }, include: { order: { select: { status: true, storeId: true, orderNo: true } } },
    });
    if (!intent || intent.accountId !== accountId || payload.account_external_id !== account.externalAccountId ||
        intent.order.storeId !== account.storeId ||
        payload.amount_minor !== Number(intent.amountMinor) || payload.currency !== intent.currency ||
        (intent.providerIntentId !== null && payload.provider_intent_id !== intent.providerIntentId)) {
      await this.markWebhookError(provider, accountId, payload.event_id, 'PAYMENT_REFERENCE_MISMATCH');
      throw new ConflictException('Webhook payment reference, recipient, or amount mismatch');
    }
    await this.prisma.$transaction(async (tx) => {
      if (payload.event_type === 'PAYMENT_SUCCEEDED') {
        await this.confirmSuccessfulPayment(tx, {
          intentId: intent.id,
          orderNo: intent.order.orderNo,
          orderId: intent.orderId,
          storeId: account.storeId,
          provider,
          accountId,
          providerIntentId: payload.provider_intent_id,
          eventId: payload.event_id,
          providerTransactionId: payload.provider_transaction_id as string,
          occurredAt,
        });
      } else {
        const processing = payload.event_type === 'PAYMENT_PROCESSING';
        const changed = await tx.paymentIntent.updateMany({
          where: {
            id: intent.id,
            status: { in: ['CREATED', 'PENDING', 'PROCESSING'] },
            OR: [{ providerIntentId: null }, { providerIntentId: payload.provider_intent_id }],
          },
          data: {
            providerIntentId: payload.provider_intent_id,
            status: processing ? 'PROCESSING' : 'FAILED',
            activeOrderKey: processing ? intent.orderId : null,
            ...(processing ? {} : { failureCode: payload.failure_code }),
          },
        });
        if (!changed.count) {
          const current = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intent.id }, select: { providerIntentId: true } });
          if (current.providerIntentId && current.providerIntentId !== payload.provider_intent_id) {
            throw new ConflictException('Webhook provider intent does not match the reserved payment');
          }
        }
      }
      await tx.paymentWebhookEvent.update({
        where: { provider_accountId_eventId: { provider, accountId, eventId: payload.event_id } },
        data: { processedAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    return { accepted: true, duplicate: false };
  }

  private async confirmSuccessfulPayment(
    tx: Prisma.TransactionClient,
    input: SuccessfulPaymentInput,
  ): Promise<void> {
    // Take the order lock before reading or updating the intent. This makes the
    // following read observe the state that won the conditional transition,
    // instead of a repeatable-read snapshot captured before a lock wait.
    const changed = await tx.order.updateMany({
      where: { id: input.orderId, storeId: input.storeId, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paidAt: input.occurredAt, paymentChannel: providerChannels[input.provider] },
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
      if (this.isPrismaError(error, 'P2025')) throw new ConflictException('Payment intent changed while processing the webhook');
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
      await this.stock.commit(tx, { id: input.orderId, storeId: input.storeId, orderNo: input.orderNo }, `payment:${input.provider}`);
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

  async upsertAccount(body: UpsertPaymentAccountDto): Promise<PaymentAccountView> {
    if (providerChannels[body.provider] !== body.channel) throw new BadRequestException('Provider/channel mismatch');
    const storeId = this.stores.resolveRequestedStoreId(body.storeId);
    return this.prisma.paymentAccount.upsert({
      where: { storeId_provider_channel: { storeId, provider: body.provider, channel: body.channel } },
      create: { ...body, storeId, status: body.status ?? 'ACTIVE' },
      update: { externalAccountId: body.externalAccountId, connectorConfigKey: body.connectorConfigKey, status: body.status },
      select: { id: true, storeId: true, provider: true, channel: true, externalAccountId: true, connectorConfigKey: true, status: true, updatedAt: true },
    });
  }

  async listAccounts(storeIds?: string[]): Promise<PaymentAccountView[]> {
    const effectiveStoreIds = this.stores.mode === 'multi' && storeIds === undefined ? undefined : this.stores.resolveStoreIds(storeIds);
    return this.prisma.paymentAccount.findMany({
      where: effectiveStoreIds ? { storeId: { in: effectiveStoreIds } } : {},
      select: { id: true, storeId: true, provider: true, channel: true, externalAccountId: true, connectorConfigKey: true, status: true, updatedAt: true },
      orderBy: [{ storeId: 'asc' }, { provider: 'asc' }],
    });
  }

  private async reserveIntent(input: IntentReservationInput) {
    for (let attempt = 1; attempt <= INTENT_RESERVATION_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const duplicate = await tx.paymentIntent.findUnique({
            include: intentOrder,
            where: {
              orderId_clientRequestId: {
                orderId: input.orderId,
                clientRequestId: input.clientRequestId,
              },
            },
          });
          if (duplicate) return { intent: duplicate, created: false as const };

          // The conditional update both revalidates the order state and takes
          // the order-row lock before the activity check and reservation.
          const claimedOrder = await tx.order.updateMany({
            where: {
              id: input.orderId,
              customerUserId: input.customerUserId,
              storeId: input.storeId,
              isDeleted: false,
              status: 'PENDING_PAYMENT',
              OR: [{ stockExpiresAt: null }, { stockExpiresAt: { gt: new Date() } }],
            },
            data: { paymentChannel: input.channel },
          });
          if (claimedOrder.count !== 1) {
            throw new ConflictException('Order is no longer awaiting payment');
          }

          if (input.expiresAt.getTime() <= Date.now()) throw new ConflictException('The payment window has expired');
          const activeAttempt = await tx.paymentIntent.findFirst({
            where: {
              orderId: input.orderId,
              status: { in: ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'] },
            },
            select: { paymentNo: true },
          });
          if (activeAttempt) {
            throw new ConflictException(`Order already has an active payment: ${activeAttempt.paymentNo}`);
          }

          const intent = await tx.paymentIntent.create({
            data: {
              paymentNo: `PAY${Date.now()}${randomBytes(6).toString('hex').toUpperCase()}`,
              activeOrderKey: input.orderId,
              orderId: input.orderId,
              accountId: input.accountId,
              provider: input.provider,
              channel: input.channel,
              amountMinor: BigInt(input.amountMinor),
              currency: 'CNY',
              clientRequestId: input.clientRequestId,
              expiresAt: input.expiresAt,
            },
          });
          return { intent, created: true as const };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!this.isPrismaError(error, 'P2002') && !this.isPrismaError(error, 'P2034')) {
          throw error;
        }

        const duplicate = await this.prisma.paymentIntent.findUnique({
          include: intentOrder,
          where: {
            orderId_clientRequestId: {
              orderId: input.orderId,
              clientRequestId: input.clientRequestId,
            },
          },
        });
        if (duplicate) return { intent: duplicate, created: false as const };

        const activeAttempt = await this.prisma.paymentIntent.findFirst({
          where: {
            orderId: input.orderId,
            status: { in: ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'] },
          },
          select: { paymentNo: true },
        });
        if (activeAttempt) {
          throw new ConflictException(`Order already has an active payment: ${activeAttempt.paymentNo}`);
        }
        if (attempt === INTENT_RESERVATION_MAX_ATTEMPTS) throw error;
      }
    }

    throw new ConflictException('Payment reservation retry limit reached');
  }

  private assertRequestedMethod(intent: CustomerIntent, request: CreatePaymentIntentDto): void {
    if (intent.channel !== request.channel || intent.provider !== request.provider) {
      throw new ConflictException('Payment request id was already used for a different payment method');
    }
  }

  private mapIntent(intent: CustomerIntent): PaymentIntentContract {
    const canPay = intent.order.status === 'PENDING_PAYMENT' && intent.expiresAt > new Date() &&
      intent.reconciliationStatus !== 'MANUAL_REVIEW' && (intent.status === 'PENDING' || intent.status === 'PROCESSING');
    const amount = Number(intent.amountMinor);
    if (!Number.isSafeInteger(amount)) throw new ConflictException('Payment amount exceeds API numeric range');
    return {
      payment_no: intent.paymentNo, order_id: intent.orderId, provider: intent.provider,
      channel: intent.channel as PaymentIntentContract['channel'], status: intent.status as PaymentIntentContract['status'],
      amount_minor: amount, currency: intent.currency, client_action: canPay ? intent.clientAction as Record<string, unknown> | null : null,
      expires_at: intent.expiresAt.toISOString(), paid_at: intent.paidAt?.toISOString() ?? null,
    };
  }

  private toMinor(value: Prisma.Decimal): number {
    const amount = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(amount)) throw new BadRequestException('Order amount is too large');
    return amount;
  }
  private validatePayload(payload: PaymentWebhookPayload) {
    if (!payload || !validReference(payload.event_id, 191) || !validReference(payload.payment_no, 64) ||
        !validReference(payload.provider_intent_id, 191) || !validReference(payload.account_external_id, 191) ||
        typeof payload.occurred_at !== 'string' || !payload.occurred_at.trim() ||
        !Number.isSafeInteger(payload.amount_minor) || payload.amount_minor <= 0 ||
        !['PAYMENT_SUCCEEDED', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED'].includes(payload.event_type) ||
        (payload.event_type === 'PAYMENT_SUCCEEDED' && !validReference(payload.provider_transaction_id, 191)) ||
        (payload.failure_code != null && (typeof payload.failure_code !== 'string' || payload.failure_code.length > 64))) {
      throw new BadRequestException('Invalid payment webhook payload');
    }
  }
  private markWebhookError(provider: PaymentProvider, accountId: string, eventId: string, error: string) {
    return this.prisma.paymentWebhookEvent.update({
      where: { provider_accountId_eventId: { provider, accountId, eventId } }, data: { processingError: error },
    });
  }
  private isUniqueError(error: unknown): boolean {
    return this.isPrismaError(error, 'P2002');
  }
  private isPrismaError(error: unknown, code: 'P2002' | 'P2034' | 'P2025'): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }
}

function validReference(value: unknown, maxLength: number): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
