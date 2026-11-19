import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  OrderPageContract,
  OrderSummaryContract,
  OrderSummaryStatsContract,
} from '@lingdian/contracts';
import { OrderStatus, OrderType, PaymentChannel, Prisma } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreContextResolver } from '../stores/store-context.resolver';
import { QueryOrdersDto } from './dto/query-orders.dto';
import {
  mapOrderDetail,
  ORDER_DETAIL_INCLUDE,
  toDateOnly,
  toNumber,
} from './order-presenter';

export type OrderScope = { storeIds?: string[]; customerUserId?: string };

@Injectable()
export class OrdersQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreContextResolver,
  ) {}

  async getOrderSummary(
    query: QueryOrdersDto,
    scope: OrderScope = {},
  ): Promise<OrderSummaryStatsContract> {
    const scopedWhere = this.buildOrderWhere(query, true, scope);
    const paidStatuses: OrderStatus[] = ['PAID', 'PREPARING', 'READY', 'COMPLETED'];
    return this.prisma.$transaction(async tx => {
      const groups = await tx.order.groupBy({ by: ['status'], where: scopedWhere, _count: { _all: true }, _sum: { payableAmount: true } });
      const counts = new Map(groups.map(group => [group.status, group._count._all]));
      let amount = new Prisma.Decimal(0);
      for (const group of groups) if ([...paidStatuses, 'REFUNDING', 'REFUNDED'].includes(group.status)) amount = amount.add(group._sum.payableAmount ?? 0);
      const total = groups.reduce((sum, group) => sum + group._count._all, 0);
      const cents = amount.mul(100).toNumber();
      if (!Number.isSafeInteger(total) || !Number.isSafeInteger(cents)) throw new BadRequestException('orders.summaryTooLarge');
      return {
        total_count: total, pending_payment_count: counts.get('PENDING_PAYMENT') ?? 0,
        paid_count: paidStatuses.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0),
        refunding_count: counts.get('REFUNDING') ?? 0, refunded_count: counts.get('REFUNDED') ?? 0, total_amount: cents / 100,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async getOrders(
    query: QueryOrdersDto,
    scope: OrderScope = {},
  ): Promise<OrderPageContract> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = this.buildOrderWhere(query, true, scope);
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          store: { select: { id: true, name: true } },
          items: {
            select: {
              id: true,
              productName: true,
              skuName: true,
              quantity: true,
              subtotal: true,
            },
            orderBy: [{ createdAt: 'asc' }],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    const items: OrderSummaryContract[] = orders.map((order) => ({
      id: order.id,
      order_no: order.orderNo,
      order_source: order.orderSource,
      pickup_code: order.pickupCode,
      pickup_business_date: toDateOnly(order.pickupBusinessDate),
      store_id: order.storeId,
      store_name: order.store.name,
      customer_name: order.customerName,
      customer_mobile: order.customerMobile,
      delivery_address: order.deliveryAddress,
      order_type: order.orderType,
      status: order.status,
      payment_channel: order.paymentChannel,
      total_amount: toNumber(order.totalAmount),
      payable_amount: toNumber(order.payableAmount),
      remark: order.remark,
      item_count: order.items.reduce((sum, item) => sum + item.quantity, 0),
      item_summary: order.items.map((item) => ({
        id: item.id,
        name: item.productName,
        sku_name: item.skuName,
        quantity: item.quantity,
        subtotal: toNumber(item.subtotal),
      })),
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
    }));

    return { items, total, page, page_size: pageSize };
  }

  async getOrderDetail(orderId: string, scope: OrderScope = {}) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, ...this.scopeWhere(scope) },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return mapOrderDetail(order);
  }

  scopeWhere(scope: OrderScope): Prisma.OrderWhereInput {
    const storeIds = this.stores.mode === 'multi' && scope.storeIds === undefined ? undefined : this.stores.resolveStoreIds(scope.storeIds);
    return {
      ...(storeIds ? { storeId: { in: storeIds } } : {}),
      ...(scope.customerUserId ? { customerUserId: scope.customerUserId } : {}),
    };
  }

  private buildOrderWhere(
    query: QueryOrdersDto,
    excludeDeleted = true,
    scope: OrderScope = {},
  ): Prisma.OrderWhereInput {
    const createdAt = this.buildDateRange(query.startDate, query.endDate, query.endBefore);
    const where: Prisma.OrderWhereInput = this.scopeWhere(scope);
    if (excludeDeleted) where.isDeleted = false;
    if (query.status) {
      where.status = query.status as OrderStatus;
      if (query.status === 'DELETED') delete where.isDeleted;
    }
    if (query.orderType) where.orderType = query.orderType as OrderType;
    if (query.paymentChannel) where.paymentChannel = query.paymentChannel as PaymentChannel;
    if (createdAt) where.createdAt = createdAt;
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { orderNo: { contains: keyword } },
        { pickupCode: { contains: keyword } },
        { customerName: { contains: keyword } },
        { customerMobile: { contains: keyword } },
        { remark: { contains: keyword } },
      ];
    }
    return where;
  }

  private buildDateRange(startDate?: string, endDate?: string, endBefore?: string) {
    if (!startDate && !endDate && !endBefore) return undefined;
    if (endDate && endBefore) throw new BadRequestException('orders.invalidPeriod');
    const range: Prisma.DateTimeFilter = {};
    if (startDate) {
      const parsedStartDate = new Date(startDate);
      if (Number.isNaN(parsedStartDate.getTime())) throw new BadRequestException('Invalid startDate');
      range.gte = parsedStartDate;
    }
    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (Number.isNaN(parsedEndDate.getTime())) throw new BadRequestException('Invalid endDate');
      range.lte = parsedEndDate;
    }
    if (endBefore) {
      const end = new Date(endBefore);
      if (!Number.isFinite(end.getTime())) throw new BadRequestException('orders.invalidPeriod');
      range.lt = end;
      if (startDate && (new Date(startDate) >= end || end.getTime() - new Date(startDate).getTime() > 366 * 86400000)) throw new BadRequestException('orders.invalidPeriod');
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) throw new BadRequestException('orders.invalidPeriod');
    return range;
  }
}
