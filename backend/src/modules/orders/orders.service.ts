import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  OrderStatus,
  OrderSource,
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
import {
  amountToCents,
  assertManualOrderTransition,
  centsToAmount,
  formatDeliveryAddress,
  isDeletableOrderStatus,
  isPendingPaymentTermination,
  ORDER_TYPE_BY_API_VALUE,
  orderStatusTimestampPatch,
  PAYMENT_CHANNEL_BY_API_VALUE,
} from './order-policy';
import { mapOrderDetail, ORDER_DETAIL_INCLUDE, type OrderDetailRecord } from './order-presenter';
import { OrdersQueryService, type OrderScope } from './orders-query.service';

const NOOP_INTEGRATION_OUTBOX = {
  enqueueOrderCreated: async () => undefined,
  kick: () => undefined,
} as Pick<IntegrationOutboxService, 'enqueueOrderCreated' | 'kick'>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addresses: AddressesService,
    private readonly stores: StoreContextResolver,
    private readonly queries: OrdersQueryService,
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
    if (existingOrder) return mapOrderDetail(existingOrder);

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
      if (duplicateOrder) return mapOrderDetail(duplicateOrder);

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

        const unitPriceInCents = amountToCents(sku.price);
        const selectionPriceInCents = selectionSnapshots.reduce(
          (sum, selection) => sum + amountToCents(selection.priceDelta),
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
          unitPrice: centsToAmount(unitPriceInCents),
          quantity: item.quantity,
          subtotal: centsToAmount(subtotalInCents),
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
          orderType: ORDER_TYPE_BY_API_VALUE[body.orderType],
          paymentChannel: body.paymentChannel
            ? PAYMENT_CHANNEL_BY_API_VALUE[body.paymentChannel]
            : 'CASH',
          status: 'PENDING_PAYMENT',
          totalAmount: centsToAmount(totalAmountInCents),
          payableAmount: centsToAmount(totalAmountInCents),
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
        include: ORDER_DETAIL_INCLUDE,
      });

      await this.integrationOutbox.enqueueOrderCreated(tx, order);

      return mapOrderDetail(order);
    }).catch(async (error: unknown) => {
      if (this.isUniqueConstraintError(error)) {
        const duplicateOrder = await this.findIdempotentOrder(
          this.prisma,
          storeId,
          customerUserId,
          body.clientRequestId,
        );
        if (duplicateOrder) return mapOrderDetail(duplicateOrder);
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
      include: ORDER_DETAIL_INCLUDE,
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

  getOrderSummary(query: QueryOrdersDto, scope: OrderScope = {}) {
    return this.queries.getOrderSummary(query, scope);
  }

  getOrders(query: QueryOrdersDto, scope: OrderScope = {}) {
    return this.queries.getOrders(query, scope);
  }

  getOrderDetail(orderId: string, scope: OrderScope = {}) {
    return this.queries.getOrderDetail(orderId, scope);
  }

  async updateOrderStatus(orderId: string, body: UpdateOrderStatusDto, scope: OrderScope = {}) {
    const targetStatus = body.status as OrderStatus;
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...this.queries.scopeWhere(scope),
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

    assertManualOrderTransition(order.status, targetStatus, order.paymentChannel);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
          paymentChannel: order.paymentChannel,
          isDeleted: false,
          ...this.queries.scopeWhere(scope),
        },
        data: {
          status: targetStatus,
          ...orderStatusTimestampPatch(targetStatus),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Order changed concurrently. Reload and try again.');
      }
      if (isPendingPaymentTermination(order.status, targetStatus)) {
        const activePayment = await tx.paymentIntent.findFirst({
          where: {
            orderId,
            status: { in: ['CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED'] },
          },
          select: { paymentNo: true },
        });
        if (activePayment) {
          throw new ConflictException(
            `Order has an active payment attempt (${activePayment.paymentNo}) and cannot be terminated`,
          );
        }
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
        ...this.queries.scopeWhere(scope),
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.isDeleted || order.status === 'DELETED') {
      return this.getOrderDetail(orderId, scope);
    }

    if (!isDeletableOrderStatus(order.status)) {
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
          ...this.queries.scopeWhere(scope),
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

}
