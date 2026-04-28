import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  OrderType,
  PaymentChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

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

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(body: CreateOrderDto) {
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

    return this.prisma.$transaction(async (tx) => {
      const skuIds = normalizedItems.map((item) => item.skuId as string);
      const skus = await tx.productSKU.findMany({
        where: {
          id: {
            in: skuIds,
          },
          isActive: true,
        },
        include: {
          product: true,
        },
      });

      if (skus.length !== skuIds.length) {
        throw new NotFoundException('Some SKUs do not exist');
      }

      const selectionOptionIds = normalizedItems.flatMap((item) =>
        item.selections?.map((selection) => selection.selectionOptionId) ?? [],
      );
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

      let totalAmount = 0;
      const orderItems = [];

      for (const item of normalizedItems) {
        const sku = skuMap.get(item.skuId as string);

        if (!sku) {
          throw new NotFoundException('Some SKUs do not exist');
        }

        const stockResult = await tx.productSKU.updateMany({
          where: {
            id: sku.id,
            stockCount: {
              gte: item.quantity,
            },
          },
          data: {
            stockCount: {
              decrement: item.quantity,
            },
          },
        });

        if (stockResult.count !== 1) {
          throw new BadRequestException('Inventory not enough');
        }

        const selectionSnapshots = (item.selections ?? []).map((selection) => {
          const option = selectionOptionMap.get(selection.selectionOptionId);

          if (!option) {
            throw new NotFoundException('Some selection options do not exist');
          }

          const quantity = selection.quantity ?? 1;

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

        const unitPrice = Number(sku.price);
        const selectionPrice = selectionSnapshots.reduce(
          (sum, selection) => sum + selection.priceDelta,
          0,
        );
        const subtotal = unitPrice * item.quantity + selectionPrice;
        totalAmount += subtotal;

        orderItems.push({
          productId: sku.productId,
          skuId: sku.id,
          productName: sku.product.name,
          skuName: sku.skuName,
          unitPrice,
          quantity: item.quantity,
          subtotal,
          remark: item.remark,
          selections: {
            create: selectionSnapshots,
          },
        });
      }

      const order = await tx.order.create({
        data: {
          orderNo: `LD${Date.now()}`,
          storeId: body.storeId,
          customerName: body.customerName,
          customerMobile: body.mobile,
          orderType: orderTypeMap[body.orderType],
          paymentChannel: body.paymentChannel
            ? paymentChannelMap[body.paymentChannel]
            : 'CASH',
          status: 'PENDING_PAYMENT',
          totalAmount,
          payableAmount: totalAmount,
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

      return this.mapOrderDetail(order);
    });
  }

  async getOrderSummary(query: QueryOrdersDto) {
    const scopedWhere = this.buildOrderWhere(query, false);
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

  async getOrders(query: QueryOrdersDto) {
    const orders = await this.prisma.order.findMany({
      where: this.buildOrderWhere(query),
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
    });

    return orders.map((order) => ({
      id: order.id,
      order_no: order.orderNo,
      store_id: order.storeId,
      store_name: order.store.name,
      customer_name: order.customerName,
      customer_mobile: order.customerMobile,
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
  }

  async getOrderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: orderDetailInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapOrderDetail(order);
  }

  async updateOrderStatus(orderId: string, body: UpdateOrderStatusDto) {
    const targetStatus = body.status as OrderStatus;
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.isDeleted || order.status === 'DELETED') {
      throw new BadRequestException('Deleted orders cannot be updated');
    }

    if (order.status === targetStatus) {
      return this.getOrderDetail(orderId);
    }

    const allowedTransitions = editableTransitions[order.status] ?? [];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Order status cannot change from ${order.status} to ${targetStatus}`,
      );
    }

    await this.prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: targetStatus,
        ...this.buildStatusTimestampPatch(targetStatus),
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus: targetStatus,
            operatorName: body.operatorName,
            note: body.note,
          },
        },
      },
    });

    return this.getOrderDetail(orderId);
  }

  async deleteOrder(orderId: string, operatorName?: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.isDeleted || order.status === 'DELETED') {
      return this.getOrderDetail(orderId);
    }

    if (!deletableStatuses.has(order.status)) {
      throw new BadRequestException(
        'Only completed, refunded, cancelled, timed-out, or failed orders can be deleted',
      );
    }

    await this.prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: 'DELETED',
        isDeleted: true,
        deletedAt: new Date(),
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus: 'DELETED',
            operatorName,
            note: 'Soft deleted',
          },
        },
      },
    });

    return this.getOrderDetail(orderId);
  }

  private buildOrderWhere(query: QueryOrdersDto, excludeDeleted = true): Prisma.OrderWhereInput {
    const createdAt = this.buildDateRange(query.startDate, query.endDate);
    const where: Prisma.OrderWhereInput = {};

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

  private mapOrderDetail(order: Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>) {
    return {
      id: order.id,
      order_no: order.orderNo,
      store_id: order.storeId,
      store_name: order.store.name,
      store_code: order.store.code,
      customer_name: order.customerName,
      customer_mobile: order.customerMobile,
      order_type: order.orderType,
      status: order.status,
      payment_channel: order.paymentChannel,
      total_amount: this.toNumber(order.totalAmount),
      payable_amount: this.toNumber(order.payableAmount),
      remark: order.remark,
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
}
