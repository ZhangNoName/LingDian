import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { StockHoldDetail, StockHoldPage, StockHoldPaymentState, StockHoldRecord, StockHoldRecheckResult } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { PaymentExpiryService } from '../payments/payment-expiry.service';
import { OrdersService } from './orders.service';
import { StockHoldPageDto, StockHoldQueryDto } from './dto/stock-hold.dto';
const include = {
  paymentIntents: { where: { status: { in: ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'] as const } }, select: { status: true, reconciliationStatus: true }, orderBy: { createdAt: 'desc' as const }, take: 1 },
  _count: { select: { inventoryReservations: { where: { status: 'RESERVED' } } } },
} satisfies Prisma.OrderInclude;
type HoldOrder = Prisma.OrderGetPayload<{ include: typeof include }>;
@Injectable()
export class StockHoldService {
  constructor(private readonly prisma: PrismaService, private readonly scope: MerchantStoreScope, private readonly payments: PaymentExpiryService, private readonly orders: OrdersService) {}
  async list(user: AuthenticatedUser, requestedStoreId: string | undefined, query: StockHoldQueryDto): Promise<StockHoldPage> {
    const [storeId] = this.scope.forRequest(user, requestedStoreId), now = new Date();
    return this.prisma.$transaction(async tx => {
      const where: Prisma.OrderWhereInput = { storeId, isDeleted: false, status: 'PENDING_PAYMENT', inventoryReservations: { some: { storeId, status: 'RESERVED' } },
        ...(query.state === 'EXPIRED' ? { stockExpiresAt: { lte: now } } : {}),
        ...(query.keyword?.trim() ? { OR: [{ orderNo: { contains: query.keyword.trim() } }, { pickupCode: { contains: query.keyword.trim() } }] } : {}),
      };
      const rows = await tx.order.findMany({ where, include, orderBy: [{ stockExpiresAt: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize });
      const total = await tx.order.count({ where });
      return { items: rows.map(present), total, page: query.page, pageSize: query.pageSize, generatedAt: now.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async detail(user: AuthenticatedUser, requestedStoreId: string | undefined, orderId: string, query: StockHoldPageDto): Promise<StockHoldDetail> {
    const [storeId] = this.scope.forRequest(user, requestedStoreId);
    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findFirst({ where: { id: orderId, storeId, isDeleted: false }, include });
      if (!order) throw new NotFoundException('stockHold.notFound');
      const where = { orderId, storeId, status: 'RESERVED' };
      const materials = await tx.inventoryReservation.findMany({ where, include: { item: { select: { name: true, code: true, unit: true } } }, orderBy: { itemId: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize });
      return { order: present(order), materials: materials.map(row => ({ itemId: row.itemId, ...row.item, quantity: row.quantity / 1000 })), total: order._count.inventoryReservations, page: query.page, pageSize: query.pageSize };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async recheck(user: AuthenticatedUser, requestedStoreId: string | undefined, orderId: string): Promise<StockHoldRecheckResult> {
    const [storeId] = this.scope.forRequest(user, requestedStoreId);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, storeId, isDeleted: false }, include });
    if (!order) throw new NotFoundException('stockHold.notFound');
    if (!order._count.inventoryReservations) return { outcome: 'RESOLVED' };
    if (order.status !== 'PENDING_PAYMENT') return { outcome: 'RETRY_LATER' };
    if (!order.stockExpiresAt || order.stockExpiresAt > new Date()) throw new ConflictException('stockHold.notExpired');
    await this.prisma.authAuditLog.create({ data: { event: 'INVENTORY_HOLD_RECHECK_REQUESTED', userId: user.userId, sessionId: user.sessionId, metadata: { storeId, orderId } } });
    let outcome: StockHoldRecheckResult['outcome'] = 'RESOLVED';
    try {
      await this.payments.recoverExpiredAttempt(orderId, storeId);
      await this.orders.updateOrderStatus(orderId, { status: 'TIMED_OUT', operatorName: user.userId, note: 'Merchant requested expired ingredient hold verification' }, { storeIds: [storeId] });
    } catch (error) {
      if (!(error instanceof ConflictException) && !(error instanceof BadRequestException)) throw error;
      const current = await this.prisma.order.findFirst({ where: { id: orderId, storeId }, include });
      outcome = !current || !current._count.inventoryReservations ? 'RESOLVED' : current.status !== 'PENDING_PAYMENT' ? 'RETRY_LATER' : current.paymentIntents.length ? 'PAYMENT_BLOCKED' : 'RETRY_LATER';
    }
    await this.prisma.authAuditLog.create({ data: { event: 'INVENTORY_HOLD_RECHECKED', userId: user.userId, sessionId: user.sessionId, metadata: { storeId, orderId, outcome } } });
    return { outcome };
  }
}
function present(row: HoldOrder): StockHoldRecord {
  const payment = row.paymentIntents[0];
  const paymentState: StockHoldPaymentState = !payment ? 'NONE' : payment.status === 'SUCCEEDED' ? 'CONFIRMED' : payment.reconciliationStatus === 'MANUAL_REVIEW' ? 'REVIEW' : 'ACTIVE';
  return { orderId: row.id, orderNo: row.orderNo, pickupCode: row.pickupCode, createdAt: row.createdAt.toISOString(), expiresAt: row.stockExpiresAt?.toISOString() ?? null, paymentChannel: row.paymentChannel, paymentState, heldMaterialCount: row._count.inventoryReservations };
}
