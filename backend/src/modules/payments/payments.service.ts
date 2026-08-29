import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PaymentChannel, PaymentProvider, Prisma } from '@lingdian/db';
import type { PaymentIntentContract } from '@lingdian/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { UpsertPaymentAccountDto } from './dto/upsert-payment-account.dto';
import { PaymentGatewayFactory, PaymentWebhookPayload } from './payment.gateway';
import { StoreContextResolver } from '../stores/store-context.resolver';

const providerChannels: Record<PaymentProvider, PaymentChannel> = {
  WECHAT_PAY: 'WECHAT', ALIPAY: 'ALIPAY', UNIONPAY: 'UNIONPAY', STRIPE: 'STRIPE', PAYPAL: 'PAYPAL',
};

type PaymentAccountView = {
  id: string; storeId: string; provider: PaymentProvider; channel: PaymentChannel;
  externalAccountId: string; connectorConfigKey: string; status: 'ACTIVE' | 'DISABLED'; updatedAt: Date;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateways: PaymentGatewayFactory,
    private readonly stores: StoreContextResolver,
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
    const existing = await this.prisma.paymentIntent.findUnique({
      where: { orderId_clientRequestId: { orderId, clientRequestId: body.clientRequestId } },
    });
    if (existing) return this.mapIntent(existing);
    if (order.status !== 'PENDING_PAYMENT') throw new ConflictException('Order is not awaiting payment');
    const amountMinor = this.toMinor(order.payableAmount);
    if (amountMinor <= 0) throw new BadRequestException('Payment amount must be positive');
    const account = await this.prisma.paymentAccount.findUnique({
      where: { storeId_provider_channel: { storeId: order.storeId, provider: body.provider, channel: body.channel } },
    });
    if (!account || account.status !== 'ACTIVE') {
      throw new BadRequestException('The store has no active receiving account for this payment method');
    }
    const activeAttempt = await this.prisma.paymentIntent.findFirst({
      where: { orderId, status: { in: ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'] } },
      select: { paymentNo: true },
    });
    if (activeAttempt) throw new ConflictException(`Order already has an active payment: ${activeAttempt.paymentNo}`);
    await this.prisma.order.updateMany({
      where: { id: orderId, customerUserId, storeId, status: 'PENDING_PAYMENT' },
      data: { paymentChannel: body.channel },
    });
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    let intent;
    try {
      intent = await this.prisma.paymentIntent.create({ data: {
        paymentNo: `PAY${Date.now()}${randomBytes(6).toString('hex').toUpperCase()}`,
        orderId, accountId: account.id, provider: body.provider, channel: body.channel,
        amountMinor: BigInt(amountMinor), currency: 'CNY', clientRequestId: body.clientRequestId, expiresAt,
      } });
    } catch (error) {
      if (!this.isUniqueError(error)) throw error;
      const duplicate = await this.prisma.paymentIntent.findUnique({
        where: { orderId_clientRequestId: { orderId, clientRequestId: body.clientRequestId } },
      });
      if (!duplicate) throw error;
      return this.mapIntent(duplicate);
    }

    try {
      const result = await this.gateways.create(account).createIntent({
        paymentNo: intent.paymentNo, orderNo: order.orderNo, amountMinor, currency: 'CNY', expiresAt,
      });
      if (result.accountExternalId !== account.externalAccountId || result.amountMinor !== amountMinor || result.currency !== 'CNY') {
        await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: {
          status: 'FAILED', reconciliationStatus: 'MANUAL_REVIEW', failureCode: 'CONNECTOR_RESPONSE_MISMATCH',
        } });
        throw new ConflictException('Payment connector returned mismatched recipient or amount');
      }
      intent = await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: {
        providerIntentId: result.providerIntentId, status: result.status,
        clientAction: result.clientAction as Prisma.InputJsonValue | undefined,
      } });
      return this.mapIntent(intent);
    } catch (error) {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: 'CREATED' }, data: {
        status: 'FAILED', failureCode: 'CONNECTOR_ERROR', failureMessage: 'Payment provider is temporarily unavailable',
      } });
      throw error;
    }
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
        payload.provider_intent_id !== intent.providerIntentId) {
      await this.markWebhookError(provider, accountId, payload.event_id, 'PAYMENT_REFERENCE_MISMATCH');
      throw new ConflictException('Webhook payment reference, recipient, or amount mismatch');
    }
    await this.prisma.$transaction(async (tx) => {
      if (payload.event_type === 'PAYMENT_SUCCEEDED') {
        if (intent.status === 'SUCCEEDED') {
          await tx.paymentWebhookEvent.update({
            where: { provider_accountId_eventId: { provider, accountId, eventId: payload.event_id } },
            data: { processedAt: new Date() },
          });
          return;
        }
        const orderCanBePaid = intent.order.status === 'PENDING_PAYMENT';
        await tx.paymentIntent.update({ where: { id: intent.id }, data: {
          status: 'SUCCEEDED', paidAt: occurredAt,
          reconciliationStatus: orderCanBePaid ? 'MATCHED' : 'LATE_PAYMENT',
        } });
        await tx.paymentTransaction.upsert({
          where: { paymentIntentId_type_idempotencyKey: {
            paymentIntentId: intent.id, type: 'PAYMENT', idempotencyKey: payload.event_id,
          } },
          create: {
            transactionNo: `TXN${Date.now()}${randomBytes(5).toString('hex').toUpperCase()}`,
            paymentIntentId: intent.id, type: 'PAYMENT', status: 'SUCCEEDED', amountMinor: intent.amountMinor,
            currency: intent.currency, providerTransactionId: payload.provider_transaction_id,
            idempotencyKey: payload.event_id, occurredAt,
          }, update: {},
        });
        if (orderCanBePaid) {
          const changed = await tx.order.updateMany({
            where: { id: intent.orderId, storeId: account.storeId, status: 'PENDING_PAYMENT' },
            data: { status: 'PAID', paidAt: occurredAt },
          });
          if (changed.count === 1) await tx.orderStatusLog.create({ data: {
            orderId: intent.orderId, fromStatus: 'PENDING_PAYMENT', toStatus: 'PAID',
            operatorName: `payment:${provider}`, note: 'Payment confirmed by verified webhook',
            extra: { paymentNo: intent.paymentNo, eventId: payload.event_id },
          } });
        }
      } else {
        await tx.paymentIntent.updateMany({ where: { id: intent.id, status: { not: 'SUCCEEDED' } }, data: {
          status: payload.event_type === 'PAYMENT_PROCESSING' ? 'PROCESSING' : 'FAILED',
          failureCode: payload.failure_code,
        } });
      }
      await tx.paymentWebhookEvent.update({
        where: { provider_accountId_eventId: { provider, accountId, eventId: payload.event_id } },
        data: { processedAt: new Date() },
      });
    });
    return { accepted: true, duplicate: false };
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
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
