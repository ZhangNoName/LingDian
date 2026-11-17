import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentExpiryService } from '../payments/payment-expiry.service';
import { StoreContextResolver } from '../stores/store-context.resolver';
import { OrdersService } from './orders.service';

/** Only expires orders with ingredient holds. Active/uncertain payments continue to block release. */
@Injectable()
export class OrderStockExpiryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OrderStockExpiryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private cursor?: { expiresAt: Date; id: string };
  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentExpiryService, private readonly orders: OrdersService, private readonly stores: StoreContextResolver) {}
  onApplicationBootstrap() { this.timer = setInterval(() => { void this.flush().catch(() => this.logger.warn('Ingredient hold expiry pass failed')); }, 15000); this.timer.unref?.(); void this.flush().catch(() => this.logger.warn('Ingredient hold expiry startup pass failed')); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.prisma.order.findMany({ where: {
        status: 'PENDING_PAYMENT', isDeleted: false, stockExpiresAt: { lte: new Date() },
        ...(this.stores.mode === 'multi' ? {} : { storeId: this.stores.primaryStoreId() }),
        ...(this.cursor ? { OR: [{ stockExpiresAt: { gt: this.cursor.expiresAt } }, { stockExpiresAt: this.cursor.expiresAt, id: { gt: this.cursor.id } }] } : {}),
      }, select: { id: true, storeId: true, stockExpiresAt: true }, orderBy: [{ stockExpiresAt: 'asc' }, { id: 'asc' }], take: 20 });
      // Rotate past uncertain holds so the oldest batch cannot starve later expired orders.
      const last = rows[rows.length - 1];
      this.cursor = last?.stockExpiresAt ? { expiresAt: last.stockExpiresAt, id: last.id } : undefined;
      for (const order of rows) {
        try {
          // Closing a provider attempt alone does not release stock; order termination does so atomically.
          await this.payments.recoverExpiredAttempt(order.id, order.storeId);
          await this.orders.updateOrderStatus(order.id, { status: 'TIMED_OUT', operatorName: 'system:stock-expiry', note: 'Ingredient reservation expired before payment' }, { storeIds: [order.storeId] });
        } catch { this.logger.warn('An expired ingredient hold remains pending; payment or order state requires retry'); }
      }
    } finally { this.running = false; }
  }
}
