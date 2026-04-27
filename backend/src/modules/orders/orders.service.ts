import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

const orderTypeMap: Record<CreateOrderDto['orderType'], OrderType> = {
  dine_in: 'DINE_IN',
  takeout: 'TAKEOUT',
  pickup: 'PICKUP',
};

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
          totalAmount,
          payableAmount: totalAmount,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              selections: true,
            },
          },
        },
      });

      return {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        storeId: order.storeId,
        orderType: order.orderType,
        totalAmount: Number(order.totalAmount),
        payableAmount: Number(order.payableAmount),
        customerName: order.customerName,
        customerMobile: order.customerMobile,
        items: order.items.map((item) => ({
          id: item.id,
          product_id: item.productId,
          sku_id: item.skuId,
          product_name: item.productName,
          sku_name: item.skuName,
          unit_price: Number(item.unitPrice),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
          selections: item.selections.map((selection) => ({
            id: selection.id,
            selection_group_id: selection.selectionGroupId,
            selection_option_id: selection.selectionOptionId,
            group_name: selection.groupNameSnapshot,
            option_name: selection.optionNameSnapshot,
            option_type: selection.optionType,
            referenced_sku_id: selection.referencedSkuId,
            referenced_sku_name: selection.referencedSkuName,
            price_delta: Number(selection.priceDelta),
            quantity: selection.quantity,
          })),
        })),
        createdAt: order.createdAt.toISOString(),
      };
    });
  }
}
