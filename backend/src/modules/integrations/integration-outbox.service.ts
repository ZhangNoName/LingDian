import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { OrderCreatedIntegrationEvent } from '@lingdian/contracts';
import { Prisma, type IntegrationOutbox, type OrderSource } from '@lingdian/db';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationCatalogService } from './integration-catalog.service';
import { StoreContextResolver } from '../stores/store-context.resolver';

const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 20;
const POLL_INTERVAL_MS = 5_000;

type CreatedOrder = {
  id: string;
  orderNo: string;
  orderSource?: OrderSource;
  pickupCode?: string | null;
  pickupBusinessDate?: Date | null;
  storeId: string;
  orderType: string;
  status: string;
  paymentChannel: string;
  totalAmount: Prisma.Decimal | number;
  payableAmount: Prisma.Decimal | number;
  customerName: string;
  customerMobile: string;
  deliveryAddress: string | null;
  remark: string | null;
  items: Array<{
    productId: string;
    skuId: string | null;
    productName: string;
    skuName: string | null;
    unitPrice: Prisma.Decimal | number;
    quantity: number;
    subtotal: Prisma.Decimal | number;
    selections: Array<{
      groupNameSnapshot: string;
      optionNameSnapshot: string;
      quantity: number;
      priceDelta: Prisma.Decimal | number;
    }>;
  }>;
};

@Injectable()
export class IntegrationOutboxService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationOutboxService.name);
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: IntegrationCatalogService,
    private readonly stores: StoreContextResolver,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.catalog.enabledDeploymentProviders().length === 0) return;
    await this.recoverAbandonedClaims();
    this.timer = setInterval(() => this.triggerFlush(), POLL_INTERVAL_MS);
    this.timer.unref?.();
    this.triggerFlush();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Writes integration work in the same transaction as the order. */
  async enqueueOrderCreated(tx: Prisma.TransactionClient, order: CreatedOrder): Promise<void> {
    const storeId = this.stores.resolveRequestedStoreId(order.storeId);
    const deploymentProviders = this.catalog.enabledDeploymentProviders();
    if (deploymentProviders.length === 0) return;
    const enabled = await tx.storeIntegration.findMany({
      where: { storeId, enabled: true, provider: { in: deploymentProviders } },
      select: { provider: true },
    });
    if (enabled.length === 0) return;

    const event = this.toOrderCreatedEvent(order);
    await tx.integrationOutbox.createMany({
      data: enabled.map(({ provider }) => ({
        eventId: event.event_id,
        provider,
        eventType: event.event_type,
        schemaVersion: event.schema_version,
        aggregateId: order.id,
        storeId,
        payload: event as unknown as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  }

  /** Starts a best-effort immediate pass; the durable poller remains the fallback. */
  kick(): void {
    if (this.catalog.enabledDeploymentProviders().length > 0) this.triggerFlush();
  }

  private triggerFlush(): void {
    void this.flush().catch((error: unknown) => {
      this.logger.warn(`Integration outbox pass failed: ${safeErrorMessage(error)}`);
    });
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const pending = await this.prisma.integrationOutbox.findMany({
        where: {
          storeId: this.stores.primaryStoreId(),
          status: 'PENDING',
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });
      for (const row of pending) await this.deliverOne(row);
    } finally {
      this.flushing = false;
    }
  }

  private async deliverOne(row: IntegrationOutbox): Promise<void> {
    const claimed = await this.prisma.integrationOutbox.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: { status: 'PROCESSING', lockedAt: new Date() },
    });
    if (claimed.count !== 1) return;

    const adapter = this.catalog.adapter(row.provider);
    try {
      if (!adapter) throw new Error('Connector adapter is unavailable');
      await adapter.deliver(row.payload as unknown as OrderCreatedIntegrationEvent);
      await this.prisma.integrationOutbox.update({
        where: { id: row.id },
        data: { status: 'DELIVERED', deliveredAt: new Date(), lockedAt: null, lastError: null },
      });
    } catch (error) {
      const attempts = row.attempts + 1;
      await this.prisma.integrationOutbox.update({
        where: { id: row.id },
        data: {
          status: attempts >= MAX_ATTEMPTS ? 'DEAD_LETTER' : 'PENDING',
          attempts,
          nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
          lockedAt: null,
          lastError: safeErrorMessage(error),
        },
      });
    }
  }

  private recoverAbandonedClaims(): Promise<{ count: number }> {
    return this.prisma.integrationOutbox.updateMany({
      where: {
        storeId: this.stores.primaryStoreId(),
        status: 'PROCESSING',
        lockedAt: { lt: new Date(Date.now() - 5 * 60_000) },
      },
      data: { status: 'PENDING', lockedAt: null },
    });
  }

  private toOrderCreatedEvent(order: CreatedOrder): OrderCreatedIntegrationEvent {
    return {
      event_id: randomUUID(),
      event_type: 'order.created',
      schema_version: 1,
      occurred_at: new Date().toISOString(),
      store_id: order.storeId,
      order: {
        id: order.id,
        order_no: order.orderNo,
        order_source: order.orderSource,
        pickup_code: order.pickupCode ?? null,
        pickup_business_date: order.pickupBusinessDate
          ? order.pickupBusinessDate.toISOString().slice(0, 10)
          : null,
        order_type: order.orderType,
        status: order.status,
        payment_channel: order.paymentChannel,
        total_amount: Number(order.totalAmount),
        payable_amount: Number(order.payableAmount),
        customer_name: order.customerName,
        customer_mobile: order.customerMobile,
        delivery_address: order.deliveryAddress,
        remark: order.remark,
        items: order.items.map((item) => ({
          product_id: item.productId,
          sku_id: item.skuId,
          product_name: item.productName,
          sku_name: item.skuName,
          unit_price: Number(item.unitPrice),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
          selections: item.selections.map((selection) => ({
            group_name: selection.groupNameSnapshot,
            option_name: selection.optionNameSnapshot,
            quantity: selection.quantity,
            price_delta: Number(selection.priceDelta),
          })),
        })),
      },
    };
  }
}

function retryDelayMs(attempt: number): number {
  return Math.min(60 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1));
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown connector failure';
  return message.replace(/[\r\n\t]/g, ' ').slice(0, 500);
}
