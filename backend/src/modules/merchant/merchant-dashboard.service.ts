import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, OrderType, Prisma } from '@lingdian/db';
import type { MerchantDashboardSnapshot } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantStoreScope } from './merchant-store-scope';
import { DashboardQueryDto, dashboardPeriod } from './dto/dashboard-query.dto';
const paidStatuses: OrderStatus[] = ['PAID', 'PREPARING', 'READY', 'COMPLETED'];
type TopItem = { productId: string; skuId: string | null; productName: string; skuName: string | null; quantity: bigint | number; orderCount: bigint | number };
@Injectable()
export class MerchantDashboardService {
  constructor(private readonly prisma: PrismaService, private readonly scope: MerchantStoreScope) {}
  async snapshot(user: AuthenticatedUser, requestedStoreId: string | undefined, query: DashboardQueryDto): Promise<MerchantDashboardSnapshot> {
    const [storeId] = this.scope.forRequest(user, requestedStoreId);
    const { start, end } = dashboardPeriod(query);
    const asOf = new Date();
    return this.prisma.$transaction(async tx => {
      const where = { storeId, isDeleted: false, createdAt: { gte: start, lt: end } };
      const groups = await tx.order.groupBy({ by: ['status', 'orderType'], where, _count: { _all: true }, _sum: { payableAmount: true } });
      const counts = new Map<OrderStatus, number>();
      const byType = new Map<OrderType, { orders: number; paidOrders: number; cents: number }>();
      let total = 0, paid = 0, cents = 0;
      for (const group of groups) {
        const count = safe(group._count._all), amount = safe(new Prisma.Decimal(group._sum.payableAmount ?? 0).mul(100).toNumber());
        total = safe(total + count); counts.set(group.status, safe((counts.get(group.status) ?? 0) + count));
        const type = byType.get(group.orderType) ?? { orders: 0, paidOrders: 0, cents: 0 }; type.orders = safe(type.orders + count);
        if (paidStatuses.includes(group.status)) { paid = safe(paid + count); cents = safe(cents + amount); type.paidOrders = safe(type.paidOrders + count); type.cents = safe(type.cents + amount); }
        byType.set(group.orderType, type);
      }
      const top = await tx.$queryRaw<TopItem[]>(Prisma.sql`
        SELECT i.productId, i.skuId, i.productName, i.skuName, SUM(i.quantity) AS quantity, COUNT(DISTINCT i.orderId) AS orderCount
        FROM order_items i JOIN orders o ON o.id = i.orderId
        WHERE o.storeId = ${storeId} AND o.isDeleted = false AND o.createdAt >= ${start} AND o.createdAt < ${end}
          AND o.status IN (${Prisma.join(paidStatuses)})
        GROUP BY i.productId, i.skuId, i.productName, i.skuName
        ORDER BY quantity DESC, orderCount DESC, i.productId ASC, i.skuId ASC, i.productName ASC, i.skuName ASC LIMIT 10
      `);
      const fields = this.prisma.inventoryItem.fields;
      const operations = {
        openAlerts: await tx.inventoryAlert.count({ where: { storeId, status: 'OPEN' } }),
        acknowledgedAlerts: await tx.inventoryAlert.count({ where: { storeId, status: 'ACKNOWLEDGED' } }),
        outOfStockMaterials: await tx.inventoryItem.count({ where: { storeId, isActive: true, availableQuantity: 0 } }),
        lowStockMaterials: await tx.inventoryItem.count({ where: { storeId, isActive: true, availableQuantity: { gt: 0, lte: fields.reorderPoint } } }),
        pendingFulfillmentOrders: await tx.order.count({ where: { storeId, isDeleted: false, status: { in: ['PAID', 'PREPARING', 'READY'] } } }),
        expiredStockHoldOrders: await tx.order.count({ where: { storeId, isDeleted: false, status: 'PENDING_PAYMENT', stockExpiresAt: { lte: asOf }, inventoryReservations: { some: { storeId, status: 'RESERVED' } } } }),
      };
      return { storeId, startAt: start.toISOString(), endAt: end.toISOString(), generatedAt: asOf.toISOString(), currency: 'CNY',
        orders: { total, paid, completed: counts.get('COMPLETED') ?? 0, pendingPayment: counts.get('PENDING_PAYMENT') ?? 0, refunding: counts.get('REFUNDING') ?? 0, refunded: counts.get('REFUNDED') ?? 0, cancelled: counts.get('CANCELLED') ?? 0, timedOut: counts.get('TIMED_OUT') ?? 0, failed: counts.get('FAILED') ?? 0, paidAmount: cents / 100 },
        statuses: Object.values(OrderStatus).map(status => ({ status, count: counts.get(status) ?? 0 })),
        orderTypes: Object.values(OrderType).map(type => { const row = byType.get(type); return { type, orders: row?.orders ?? 0, paidOrders: row?.paidOrders ?? 0, paidAmount: (row?.cents ?? 0) / 100 }; }),
        topItems: top.map(row => ({ ...row, quantity: safe(row.quantity), orderCount: safe(row.orderCount) })), operations,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  }
}
function safe(value: number | bigint): number { const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) throw new BadRequestException('dashboard.tooLarge'); return number; }
