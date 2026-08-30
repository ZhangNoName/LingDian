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
import { PaymentExpiryService } from './payment-expiry.service';

const providerChannels: Record<PaymentProvider, PaymentChannel> = {
  WECHAT_PAY: 'WECHAT', ALIPAY: 'ALIPAY', UNIONPAY: 'UNIONPAY', STRIPE: 'STRIPE', PAYPAL: 'PAYPAL',
};

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
  ) {}

  async createIntent(orderId: string, customerUserId: string, body: CreatePaymentIntentDto) {
    const storeId = this.stores.primaryStoreId();
    if (providerChannels[body.provider] !== body.channel) {
      throw new BadRequestException('Payment provider does not support the requested channel');
    }
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerUserId, storeId, isDeleted: false },
      select: { id: true, orderNo: true, storeId: true, status: true, paymentChannel: true, payableAmount: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    let existing = await this.prisma.paymentIntent.findUnique({
      where: { orderId_clientRequestId: { orderId, clientRequestId: body.clientRequestId } },
    });
    if (existing) {
      if (this.expiry.isExpiredActiveIntent(existing)) {
        await this.expiry.recoverExpiredAttempt(orderId, storeId);
        existing = await this.prisma.paymentIntent.findUnique({
          where: { orderId_clientRequestId: { orderId, clientRequestId: body.clientRequestId } },
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
    const expiresAt = new Date(Date.now() + 15 * 60_000);
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
    if (!reservation.created) return this.mapIntent(reservation.intent);
    let intent = reservation.intent;

    let result;
    try {
      result = await this.gateways.create(account).createIntent({
        paymentNo: intent.paymentNo, orderNo: order.orderNo, amountMinor, currency: 'CNY', expiresAt,
      });
    } catch (error) {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: 'CREATED' }, data: {
        reconciliationStatus: 'MANUAL_REVIEW', failureCode: 'CONNECTOR_OUTCOME_UNKNOWN',
        failureMessage: 'Payment connector outcome is unknown; the attempt remains blocked until verified closure',
      } });
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
    intent = await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: {
      providerIntentId: result.providerIntentId,
      status: acknowledgedStatus,
      activeOrderKey: acknowledgedStatus === 'PENDING' || acknowledgedStatus === 'PROCESSING'
        ? intent.orderId
        : null,
      clientAction: result.clientAction as Prisma.InputJsonValue | undefined,
    } });
    return this.mapIntent(intent);
  }

  async getCustomerIntent(paymentNo: string, customerUserId: string) {
    const storeId = this.stores.primaryStoreId();
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { paymentNo, order: { customerUserId, storeId } },
    });
    if (!intent) throw new NotFoundException('Payment not found');
    return this.mapIntent(intent);
  }

  async handleWebhook(provider: PaymentProvider, accountId: string, rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    if (!Object.prototype.hasOwnProperty.call(providerChannels, provider)) {
      throw new BadRequestException('Unsupported payment provider');
    }
    const account = await this.prisma.paymentAccount.findFirst({
      where: { id: accountId, provider, storeId: this.stores.primaryStoreId() },
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
      where: { paymentNo: payload.payment_no }, include: { order: { select: { status: true, storeId: true } } },
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
          orderId: intent.orderId,
          storeId: account.storeId,
          provider,
          accountId,
          providerIntentId: payload.provider_intent_id,
          eventId: payload.event_id,
          providerTransactionId: payload.provider_transaction_id as string,
          occurredAt,
        });
      } else if (payload.event_type === 'PAYMENT_PROCESSING') {
        await tx.paymentIntent.updateMany({
          where: { id: intent.id, status: { in: ['CREATED', 'PENDING', 'PROCESSING'] } },
          data: {
            providerIntentId: payload.provider_intent_id,
            status: 'PROCESSING',
            activeOrderKey: intent.orderId,
          },
        });
      } else {
        await tx.paymentIntent.updateMany({
          where: { id: intent.id, status: { in: ['CREATED', 'PENDING', 'PROCESSING'] } },
          data: {
            providerIntentId: payload.provider_intent_id,
            status: 'FAILED',
            activeOrderKey: null,
            failureCode: payload.failure_code,
          },
        });
      }
      await tx.paymentWebhookEvent.update({
        where: { provider_accountId_eventId: { provider, accountId, eventId: payload.event_id } },
        data: { processedAt: new Date() },
      });
    });
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
      data: { status: 'PAID', paidAt: input.occurredAt },
    });
    const currentOrderStatus = changed.count === 1
      ? 'PAID'
      : (await tx.order.findUnique({
          where: { id: input.orderId },
          select: { status: true },
        }))?.status;
    const intent = await tx.paymentIntent.findUnique({
      where: { id: input.intentId },
      include: { order: { select: { storeId: true } } },
    });
    if (
      !intent ||
      intent.orderId !== input.orderId ||
      intent.order.storeId !== input.storeId ||
      (intent.providerIntentId !== null && intent.providerIntentId !== input.providerIntentId)
    ) {
      throw new ConflictException('Payment intent changed while processing the webhook');
    }
    const matchedOrderStatuses = [
      'PAID', 'PREPARING', 'READY', 'COMPLETED', 'REFUNDING', 'REFUNDED',
    ];
    await tx.paymentIntent.update({
      where: { id: intent.id },
      data: {
        providerIntentId: input.providerIntentId,
        status: 'SUCCEEDED',
        activeOrderKey: null,
        paidAt: intent.paidAt ?? input.occurredAt,
        reconciliationStatus: currentOrderStatus && matchedOrderStatuses.includes(currentOrderStatus)
          ? 'MATCHED'
          : 'LATE_PAYMENT',
      },
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
    if (changed.count === 1) {
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
    const effectiveStoreIds = this.stores.resolveStoreIds(storeIds);
    return this.prisma.paymentAccount.findMany({
      where: { storeId: { in: effectiveStoreIds } },
      select: { id: true, storeId: true, provider: true, channel: true, externalAccountId: true, connectorConfigKey: true, status: true, updatedAt: true },
      orderBy: [{ storeId: 'asc' }, { provider: 'asc' }],
    });
  }

  private async reserveIntent(input: IntentReservationInput) {
    for (let attempt = 1; attempt <= INTENT_RESERVATION_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const duplicate = await tx.paymentIntent.findUnique({
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
            },
            data: { paymentChannel: input.channel },
          });
          if (claimedOrder.count !== 1) {
            throw new ConflictException('Order is no longer awaiting payment');
          }

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

  private mapIntent(intent: { paymentNo: string; orderId: string; provider: PaymentProvider; channel: PaymentChannel; status: string; amountMinor: bigint; currency: string; clientAction: unknown; expiresAt: Date; paidAt: Date | null }): PaymentIntentContract {
    const amount = Number(intent.amountMinor);
    if (!Number.isSafeInteger(amount)) throw new ConflictException('Payment amount exceeds API numeric range');
    return {
      payment_no: intent.paymentNo, order_id: intent.orderId, provider: intent.provider,
      channel: intent.channel as PaymentIntentContract['channel'], status: intent.status as PaymentIntentContract['status'],
      amount_minor: amount, currency: intent.currency, client_action: intent.clientAction as Record<string, unknown> | null,
      expires_at: intent.expiresAt.toISOString(), paid_at: intent.paidAt?.toISOString() ?? null,
    };
  }

  private toMinor(value: Prisma.Decimal): number {
    const amount = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(amount)) throw new BadRequestException('Order amount is too large');
    return amount;
  }
  private validatePayload(payload: PaymentWebhookPayload) {
    if (!payload?.event_id || !payload.payment_no || !payload.provider_intent_id || !payload.account_external_id ||
        !Number.isSafeInteger(payload.amount_minor) || payload.amount_minor <= 0 ||
        !['PAYMENT_SUCCEEDED', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED'].includes(payload.event_type) ||
        (payload.event_type === 'PAYMENT_SUCCEEDED' && !payload.provider_transaction_id)) {
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
  private isPrismaError(error: unknown, code: 'P2002' | 'P2034'): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
  }
}
