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
      throw new BadRequestException('sku_id 不能为空');
    }

    return this.prisma.$transaction(async (tx) => {
      const skuIds = normalizedItems.map((item) => item.skuId as string);
      const skus = await tx.productSKU.findMany({
        where: {
          id: {
            in: skuIds,
          },
        },
        include: {
          product: true,
        },
      });

      const skuMap = new Map(skus.map((sku) => [sku.id, sku]));

      if (skus.length !== skuIds.length) {
        throw new NotFoundException('SKU 不存在');
      }

      let totalAmount = 0;
      const orderItems = [];

      for (const item of normalizedItems) {
        const sku = skuMap.get(item.skuId as string);

        if (!sku) {
          throw new NotFoundException('SKU 不存在');
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
          throw new BadRequestException('库存不足');
        }

        const unitPrice = Number(sku.price);
        const subtotal = unitPrice * item.quantity;
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
          items: true,
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
        })),
        createdAt: order.createdAt.toISOString(),
      };
    });
  }
}
