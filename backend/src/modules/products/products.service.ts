import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    const products = await this.prisma.product.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        skus: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      is_active: product.status === 'ACTIVE',
      status: product.status,
      category: product.category?.name ?? '',
      category_id: product.categoryId,
      skus: product.skus.map((sku) => ({
        id: sku.id,
        product_id: sku.productId,
        sku_name: sku.skuName,
        price: Number(sku.price),
        stock_count: sku.stockCount,
      })),
    }));
  }

  async updateSkuStock(skuId: string, stockCount: number) {
    try {
      const sku = await this.prisma.productSKU.update({
        where: {
          id: skuId,
        },
        data: {
          stockCount,
        },
      });

      return {
        id: sku.id,
        stock_count: sku.stockCount,
      };
    } catch {
      throw new NotFoundException('SKU 不存在');
    }
  }

  async updateSkuPrice(skuId: string, price: number) {
    try {
      const sku = await this.prisma.productSKU.update({
        where: {
          id: skuId,
        },
        data: {
          price,
        },
      });

      return {
        id: sku.id,
        price: Number(sku.price),
      };
    } catch {
      throw new NotFoundException('SKU 不存在');
    }
  }
}
