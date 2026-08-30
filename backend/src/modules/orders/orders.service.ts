import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  OrderDetailContract,
  OrderPageContract,
  OrderSummaryContract,
  OrderSummaryStatsContract,
} from '@lingdian/contracts';
import { randomBytes } from 'node:crypto';
import {
  OrderStatus,
  OrderSource,
  OrderType,
  PaymentChannel,
  Prisma,
} from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AddressesService } from '../addresses/addresses.service';
import type { UserAddress } from '@lingdian/contracts';
import { IntegrationOutboxService } from '../integrations/integration-outbox.service';
import { StoreContextResolver } from '../stores/store-context.resolver';
import { allocatePickupCode } from './pickup-code.service';

const NOOP_INTEGRATION_OUTBOX = {
  enqueueOrderCreated: async () => undefined,
  kick: () => undefined,
} as Pick<IntegrationOutboxService, 'enqueueOrderCreated' | 'kick'>;

const orderTypeMap: Record<CreateOrderDto['orderType'], OrderType> = {
  dine_in: 'DINE_IN',
  takeout: 'TAKEOUT',
  pickup: 'PICKUP',
};

const paymentChannelMap: Record<
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

const editableTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
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

const deletableStatuses = new Set<OrderStatus>([
  'CANCELLED',
  'TIMED_OUT',
  'FAILED',
  'REFUNDED',
  'COMPLETED',
]);

const orderDetailInclude = {
  store: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  items: {
    orderBy: [{ createdAt: 'asc' }],
    include: {
      selections: {
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  },
  statusLogs: {
    orderBy: [{ createdAt: 'asc' }],
  },
} satisfies Prisma.OrderInclude;

type OrderDetailRecord = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

type OrderScope = { storeIds?: string[]; customerUserId?: string };

function toCents(value: Prisma.Decimal | number): number {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents)) throw new BadRequestException('Order amount is too large');
  return cents;
}

function fromCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new BadRequestException('Order amount is too large');
  return value / 100;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addresses: AddressesService,
    private readonly stores: StoreContextResolver,
    private readonly integrationOutbox: IntegrationOutboxService = NOOP_INTEGRATION_OUTBOX as IntegrationOutboxService,
  ) {}

  async createOrder(
    body: CreateOrderDto,
    customerUserId?: string,
    orderSource: OrderSource = OrderSource.MINIAPP,
  ) {
    const storeId = this.stores.resolveRequestedStoreId(body.storeId);
    const existingOrder = await this.findIdempotentOrder(
      this.prisma,
      storeId,
      customerUserId,
      body.clientRequestId,
    );
    if (existingOrder) return this.mapOrderDetail(existingOrder);

    const delivery = await this.resolveDelivery(body, customerUserId);
    const normalizedItems = body.items.map((item) => {
      const skuId = item.skuId ?? item.sku_id;

      return {
        ...item,
        skuId: skuId ? String(skuId) : undefined,
      };
    });

    if (normalizedItems.some((item) => !item.skuId)) {
      throw new BadRequestException('sku_id cannot be empty');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const duplicateOrder = await this.findIdempotentOrder(
        tx,
        storeId,
        customerUserId,
        body.clientRequestId,
      );
      if (duplicateOrder) return this.mapOrderDetail(duplicateOrder);

      const customer = await this.resolveCustomer(tx, body, customerUserId, delivery?.address);
      const store = await this.stores.resolveCurrentStore(tx);
      const serviceEnabled = body.orderType === 'dine_in'
        ? store.dineInEnabled
        : body.orderType === 'takeout'
          ? store.takeoutEnabled
          : store.pickupEnabled;
      if (store.status !== 'OPEN' || serviceEnabled === false) {
        throw new BadRequestException('Store is not available');
      }
      const skuIds = [...new Set(normalizedItems.map((item) => item.skuId as string))];
      const skus = await tx.productSKU.findMany({
        where: {
          id: {
            in: skuIds,
          },
          isActive: true,
          product: {
            storeId,
          },
        },
        include: {
          product: {
            include: {
              selectionBindings: {
                where: { isEnabled: true, group: { isActive: true } },
                include: { group: true },
              },
            },
          },
          selectionBindings: {
            where: { isEnabled: true, group: { isActive: true } },
            include: { group: true },
          },
        },
      });

      if (skus.length !== skuIds.length) {
        throw new NotFoundException('Some SKUs do not exist');
      }

      const selectionOptionIds = [...new Set(normalizedItems.flatMap((item) =>
        item.selections?.map((selection) => selection.selectionOptionId) ?? [],
      ))];
      const selectionOptions = selectionOptionIds.length
        ? await tx.selectionOption.findMany({
            where: {
              id: {
                in: selectionOptionIds,
              },
              isActive: true,
            },
            include: {
              group: true,
              referencedSku: true,
            },
          })
        : [];

      if (selectionOptions.length !== selectionOptionIds.length) {
        throw new NotFoundException('Some selection options do not exist');
      }

      const skuMap = new Map(skus.map((sku) => [sku.id, sku]));
      const selectionOptionMap = new Map(
        selectionOptions.map((option) => [option.id, option]),
      );

      let totalAmountInCents = 0;
      const orderItems = [];

      for (const item of normalizedItems) {
        const sku = skuMap.get(item.skuId as string);

        if (!sku) {
          throw new NotFoundException('Some SKUs do not exist');
        }

        if (sku.product.status !== 'ACTIVE') {
          throw new BadRequestException('Product is not available');
        }

        const allowedGroups = new Map(
          [...sku.product.selectionBindings, ...sku.selectionBindings]
            .map((binding) => [binding.groupId, binding.group] as const),
        );
        const selectionCounts = new Map<string, number>();

        const selectionSnapshots = (item.selections ?? []).map((selection) => {
          const option = selectionOptionMap.get(selection.selectionOptionId);

          if (!option) {
            throw new NotFoundException('Some selection options do not exist');
          }

          const group = allowedGroups.get(option.groupId);
          if (!group || (selection.selectionGroupId && selection.selectionGroupId !== option.groupId)) {
            throw new BadRequestException('Selection option is not available for this SKU');
          }

          const quantity = selection.quantity ?? 1;
          selectionCounts.set(option.groupId, (selectionCounts.get(option.groupId) ?? 0) + quantity);

          return {
            selectionGroupId: option.groupId,
            selectionOptionId: option.id,
            groupNameSnapshot: option.group.name,
            optionNameSnapshot: option.name,
            optionType: option.optionType,
            referencedSkuId: option.referencedSkuId,
            referencedSkuName: option.referencedSku?.skuName ?? null,
            priceDelta: Number(option.priceDelta) * quantity,
            quantity,
          };
        });

        for (const group of allowedGroups.values()) {
          const selected = selectionCounts.get(group.id) ?? 0;
          const minimum = Math.max(group.minSelect, group.isRequired ? 1 : 0);
          if (selected < minimum || selected > group.maxSelect || (group.selectionMode === 'SINGLE' && selected > 1)) {
            throw new BadRequestException(`Invalid selection count for ${group.name}`);
          }
        }

        const unitPriceInCents = toCents(sku.price);
        const selectionPriceInCents = selectionSnapshots.reduce(
          (sum, selection) => sum + toCents(selection.priceDelta),
          0,
        );
        const subtotalInCents = (unitPriceInCents + selectionPriceInCents) * item.quantity;
        if (subtotalInCents < 0) throw new BadRequestException('Order item subtotal cannot be negative');
        totalAmountInCents += subtotalInCents;

        orderItems.push({
          productId: sku.productId,
          skuId: sku.id,
          productName: sku.product.name,
          skuName: sku.skuName,
          unitPrice: fromCents(unitPriceInCents),
          quantity: item.quantity,
          subtotal: fromCents(subtotalInCents),
          remark: item.remark,
          selections: {
            create: selectionSnapshots,
          },
        });
      }

      const pickup = await allocatePickupCode(tx, { storeId, orderSource });
      const order = await tx.order.create({
        data: {
          orderNo: `LD${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`,
          storeId,
          orderSource,
          pickupCode: pickup.pickupCode,
          pickupBusinessDate: pickup.pickupBusinessDate,
          customerUserId,
          clientRequestId: customerUserId ? body.clientRequestId : undefined,
          customerName: customer.name,
          customerMobile: customer.mobile,
          deliveryAddress: delivery?.snapshot,
          orderType: orderTypeMap[body.orderType],
          paymentChannel: body.paymentChannel
            ? paymentChannelMap[body.paymentChannel]
            : 'CASH',
          status: 'PENDING_PAYMENT',
          totalAmount: fromCents(totalAmountInCents),
          payableAmount: fromCents(totalAmountInCents),
          remark: body.remark,
          items: {
            create: orderItems,
          },
          statusLogs: {
            create: [
              {
                fromStatus: null,
                toStatus: 'CREATING',
                note: 'Order created',
              },
              {
                fromStatus: 'CREATING',
                toStatus: 'PENDING_PAYMENT',
                note: 'Waiting for payment',
              },
            ],
          },
        },
        include: orderDetailInclude,
      });

      await this.integrationOutbox.enqueueOrderCreated(tx, order);

      return this.mapOrderDetail(order);
    }).catch(async (error: unknown) => {
      if (this.isUniqueConstraintError(error)) {
        const duplicateOrder = await this.findIdempotentOrder(
          this.prisma,
          storeId,
          customerUserId,
          body.clientRequestId,
        );
        if (duplicateOrder) return this.mapOrderDetail(duplicateOrder);
      }
      throw error;
    });
    this.integrationOutbox.kick();
    return result;
  }

  private findIdempotentOrder(
    client: PrismaService | Prisma.TransactionClient,
    storeId: string,
    customerUserId?: string,
    clientRequestId?: string,
  ): Promise<OrderDetailRecord | null> {
    if (!customerUserId || !clientRequestId) return Promise.resolve(null);
    return client.order.findFirst({
      where: { storeId, customerUserId, clientRequestId },
      include: orderDetailInclude,
    }) as Promise<OrderDetailRecord | null>;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private async resolveCustomer(
    tx: Prisma.TransactionClient,
    body: CreateOrderDto,
    customerUserId: string | undefined,
    deliveryAddress?: UserAddress,
  ): Promise<{ name: string; mobile: string }> {
    if (deliveryAddress) {
      return { name: deliveryAddress.recipientName, mobile: deliveryAddress.phoneNumber };
    }
    if (!customerUserId) {
      if (!body.customerName || !body.mobile) {
        throw new BadRequestException('An authenticated customer is required.');
      }
      return { name: body.customerName, mobile: body.mobile };
    }

    const phoneIdentity = await tx.authIdentity.findFirst({
      where: { userId: customerUserId, provider: 'PHONE', verifiedAt: { not: null } },
      select: { phoneE164: true },
    });
    if (!phoneIdentity?.phoneE164) {
      throw new BadRequestException('Authenticated customer has no verified phone identity.');
    }

    return { name: body.customerName ?? 'Customer', mobile: phoneIdentity.phoneE164 };
  }

  private async resolveDelivery(
    body: CreateOrderDto,
    customerUserId: string | undefined,
  ): Promise<{ address: UserAddress; snapshot: string } | undefined> {
    if (body.orderType !== 'takeout') return undefined;
    if (!body.addressId) throw new BadRequestException('Delivery address is required.');
    if (!customerUserId) throw new BadRequestException('An authenticated customer is required for delivery.');
    const address = await this.addresses.findOwnedAddress(customerUserId, body.addressId);
    return { address, snapshot: formatDeliveryAddress(address) };
  }

  async getOrderSummary(query: QueryOrdersDto, scope: OrderScope = {}): Promise<OrderSummaryStatsContract> {
    const scopedWhere = this.buildOrderWhere(query, true, scope);
    const paidStatuses: OrderStatus[] = [
      'PAID',
      'PREPARING',
      'READY',
      'COMPLETED',
    ];

    const [totalCount, pendingPaymentCount, paidCount, refundingCount, refundedCount, amounts] =
      await Promise.all([
        this.prisma.order.count({ where: scopedWhere }),
        this.prisma.order.count({
          where: {
            ...scopedWhere,
            status: 'PENDING_PAYMENT',
          },
        }),
        this.prisma.order.count({
          where: {
            ...scopedWhere,
            status: {
              in: paidStatuses,
            },
          },
        }),
        this.prisma.order.count({
          where: {
            ...scopedWhere,
            status: 'REFUNDING',
          },
        }),
        this.prisma.order.count({
          where: {
            ...scopedWhere,
            status: 'REFUNDED',
          },
        }),
        this.prisma.order.aggregate({
          where: {
            ...scopedWhere,
            status: {
              in: [...paidStatuses, 'REFUNDING', 'REFUNDED'],
            },
          },
          _sum: {
            payableAmount: true,
          },
        }),
      ]);

    return {
      total_count: totalCount,
      pending_payment_count: pendingPaymentCount,
      paid_count: paidCount,
      refunding_count: refundingCount,
      refunded_count: refundedCount,
      total_amount: this.toNumber(amounts._sum.payableAmount),
    };
  }

  async getOrders(query: QueryOrdersDto, scope: OrderScope = {}): Promise<OrderPageContract> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = this.buildOrderWhere(query, true, scope);
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          store: {
            select: {
              id: true,
              name: true,
            },
          },
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
        orderBy: [{ createdAt: 'desc' }],
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
      pickup_business_date: this.toDateOnly(order.pickupBusinessDate),
      store_id: order.storeId,
      store_name: order.store.name,
      customer_name: order.customerName,
      customer_mobile: order.customerMobile,
      delivery_address: order.deliveryAddress,
      order_type: order.orderType,
      status: order.status,
      payment_channel: order.paymentChannel,
      total_amount: this.toNumber(order.totalAmount),
      payable_amount: this.toNumber(order.payableAmount),
      remark: order.remark,
      item_count: order.items.reduce((sum, item) => sum + item.quantity, 0),
      item_summary: order.items.map((item) => ({
        id: item.id,
        name: item.productName,
        sku_name: item.skuName,
        quantity: item.quantity,
        subtotal: this.toNumber(item.subtotal),
      })),
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
    }));

    return { items, total, page, page_size: pageSize };
  }

  async getOrderDetail(orderId: string, scope: OrderScope = {}) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...this.scopeWhere(scope),
      },
      include: orderDetailInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderDetail(order);
  }

  async updateOrderStatus(orderId: string, body: UpdateOrderStatusDto, scope: OrderScope = {}) {
    const targetStatus = body.status as OrderStatus;
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...this.scopeWhere(scope),
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.isDeleted || order.status === 'DELETED') {
      throw new BadRequestException('Deleted orders cannot be updated');
    }

    if (order.status === targetStatus) {
      return this.getOrderDetail(orderId, scope);
    }

    if (targetStatus === 'PAID' && order.paymentChannel !== 'CASH') {
      throw new BadRequestException('Online payments can only be marked paid by a verified payment webhook');
    }

    const allowedTransitions = editableTransitions[order.status] ?? [];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Order status cannot change from ${order.status} to ${targetStatus}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
          isDeleted: false,
          ...this.scopeWhere(scope),
        },
        data: {
          status: targetStatus,
          ...this.buildStatusTimestampPatch(targetStatus),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Order changed concurrently. Reload and try again.');
      }
      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: targetStatus,
          operatorName: body.operatorName,
          note: body.note,
        },
      });
    });

    return this.getOrderDetail(orderId, scope);
  }

  async deleteOrder(orderId: string, operatorName?: string, scope: OrderScope = {}) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...this.scopeWhere(scope),
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.isDeleted || order.status === 'DELETED') {
      return this.getOrderDetail(orderId, scope);
    }

    if (!deletableStatuses.has(order.status)) {
      throw new BadRequestException(
        'Only completed, refunded, cancelled, timed-out, or failed orders can be deleted',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
          isDeleted: false,
          ...this.scopeWhere(scope),
        },
        data: {
          status: 'DELETED',
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Order changed concurrently. Reload and try again.');
      }
      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: 'DELETED',
          operatorName,
          note: 'Soft deleted',
        },
      });
    });

    return this.getOrderDetail(orderId, scope);
  }

  private buildOrderWhere(query: QueryOrdersDto, excludeDeleted = true, scope: OrderScope = {}): Prisma.OrderWhereInput {
    const createdAt = this.buildDateRange(query.startDate, query.endDate);
    const where: Prisma.OrderWhereInput = this.scopeWhere(scope);

    if (excludeDeleted) {
      where.isDeleted = false;
    }

    if (query.status) {
      where.status = query.status as OrderStatus;
      if (query.status === 'DELETED') {
        delete where.isDeleted;
      }
    }

    if (query.orderType) {
      where.orderType = query.orderType as OrderType;
    }

    if (query.paymentChannel) {
      where.paymentChannel = query.paymentChannel as PaymentChannel;
    }

    if (createdAt) {
      where.createdAt = createdAt;
    }

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        {
          orderNo: {
            contains: keyword,
          },
        },
        {
          pickupCode: {
            contains: keyword,
          },
        },
        {
          customerName: {
            contains: keyword,
          },
        },
        {
          customerMobile: {
            contains: keyword,
          },
        },
        {
          remark: {
            contains: keyword,
          },
        },
      ];
    }

    return where;
  }

  private scopeWhere(scope: OrderScope): Prisma.OrderWhereInput {
    const storeIds = this.stores.resolveStoreIds(scope.storeIds);
    return {
      storeId: { in: storeIds },
      ...(scope.customerUserId ? { customerUserId: scope.customerUserId } : {}),
    };
  }

  private buildDateRange(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) {
      return undefined;
    }

    const range: Prisma.DateTimeFilter = {};

    if (startDate) {
      const parsedStartDate = new Date(startDate);
      if (Number.isNaN(parsedStartDate.getTime())) {
        throw new BadRequestException('Invalid startDate');
      }

      range.gte = parsedStartDate;
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (Number.isNaN(parsedEndDate.getTime())) {
        throw new BadRequestException('Invalid endDate');
      }

      range.lte = parsedEndDate;
    }

    return range;
  }

  private buildStatusTimestampPatch(status: OrderStatus) {
    const now = new Date();

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

  private mapOrderDetail(
    order: Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>,
  ): OrderDetailContract {
    return {
      id: order.id,
      order_no: order.orderNo,
      order_source: order.orderSource,
      pickup_code: order.pickupCode,
      pickup_business_date: this.toDateOnly(order.pickupBusinessDate),
      store_id: order.storeId,
      store_name: order.store.name,
      store_code: order.store.code,
      customer_name: order.customerName,
      customer_mobile: order.customerMobile,
      delivery_address: order.deliveryAddress,
      order_type: order.orderType,
      status: order.status,
      payment_channel: order.paymentChannel,
      total_amount: this.toNumber(order.totalAmount),
      payable_amount: this.toNumber(order.payableAmount),
      remark: order.remark,
      item_count: order.items.reduce((sum, item) => sum + item.quantity, 0),
      is_deleted: order.isDeleted,
      deleted_at: order.deletedAt?.toISOString() ?? null,
      paid_at: order.paidAt?.toISOString() ?? null,
      cancelled_at: order.cancelledAt?.toISOString() ?? null,
      refunding_at: order.refundingAt?.toISOString() ?? null,
      refunded_at: order.refundedAt?.toISOString() ?? null,
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        product_id: item.productId,
        sku_id: item.skuId,
        product_name: item.productName,
        sku_name: item.skuName,
        unit_price: this.toNumber(item.unitPrice),
        quantity: item.quantity,
        subtotal: this.toNumber(item.subtotal),
        remark: item.remark,
        selections: item.selections.map((selection) => ({
          id: selection.id,
          selection_group_id: selection.selectionGroupId,
          selection_option_id: selection.selectionOptionId,
          group_name: selection.groupNameSnapshot,
          option_name: selection.optionNameSnapshot,
          option_type: selection.optionType,
          referenced_sku_id: selection.referencedSkuId,
          referenced_sku_name: selection.referencedSkuName,
          price_delta: this.toNumber(selection.priceDelta),
          quantity: selection.quantity,
        })),
      })),
      status_logs: order.statusLogs.map((log) => ({
        id: log.id,
        from_status: log.fromStatus,
        to_status: log.toStatus,
        operator_name: log.operatorName,
        note: log.note,
        created_at: log.createdAt.toISOString(),
      })),
    };
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value == null) {
      return 0;
    }

    return Number(value);
  }

  private toDateOnly(value: Date | null | undefined): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }
}

function formatDeliveryAddress(address: UserAddress): string {
  return `${address.recipientName} ${address.phoneNumber} ${address.provinceName}${address.cityName}${address.countyName}${address.streetName}${address.detailInfo}`;
}
