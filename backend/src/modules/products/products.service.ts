import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  ProductType,
} from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ProductPageContract,
  ProductSkuOptionContract,
  ProductStatsContract,
} from '@lingdian/contracts';
import { SyncProductConfigDto } from './dto/sync-product-config.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { mapProductRecord } from './products.mapper';
import { StoreContextResolver } from '../stores/store-context.resolver';
import { ProductConfigurationService } from './product-configuration.service';
import {
  PRODUCT_LIST_SELECT,
  PRODUCT_MANAGEMENT_INCLUDE,
  PRODUCT_MENU_INCLUDE,
} from './product-query-shapes';

@Injectable()
export class ProductsService {
  private readonly statsCache = new Map<string, { expiresAt: number; value: ProductStatsContract }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreContextResolver,
    private readonly configuration: ProductConfigurationService,
  ) {}

  async getCategories() {
    const store = await this.stores.resolveCurrentStore();
    const categories = await this.prisma.category.findMany({
      where: {
        storeId: store.id,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return categories.map((category) => ({
      id: category.id,
      store_id: category.storeId,
      name: category.name,
      sort_order: category.sortOrder,
      is_visible: category.isVisible,
    }));
  }

  async createCategory(payload: CreateCategoryDto) {
    const store = await this.stores.resolveCurrentStore();
    const category = await this.prisma.category.create({
      data: {
        storeId: store.id,
        name: payload.name,
        sortOrder: payload.sort_order ?? 0,
        isVisible: payload.is_visible ?? true,
      },
    });

    return {
      id: category.id,
      store_id: category.storeId,
      name: category.name,
      sort_order: category.sortOrder,
      is_visible: category.isVisible,
    };
  }

  async updateCategory(categoryId: string, payload: UpdateCategoryDto) {
    const [storeId] = this.stores.resolveStoreIds();
    const existing = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('分类不存在');
    const category = await this.prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.sort_order !== undefined ? { sortOrder: payload.sort_order } : {}),
        ...(payload.is_visible !== undefined ? { isVisible: payload.is_visible } : {}),
      },
    });

    return {
      id: category.id,
      store_id: category.storeId,
      name: category.name,
      sort_order: category.sortOrder,
      is_visible: category.isVisible,
    };
  }

  async getProducts(query: QueryProductsDto = new QueryProductsDto(), storeIds?: string[]): Promise<ProductPageContract> {
    const effectiveStoreIds = this.stores.resolveStoreIds(storeIds);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const keyword = query.keyword?.trim();
    const where: Prisma.ProductWhereInput = {
      storeId: { in: effectiveStoreIds },
      ...(query.type ? { type: query.type } : {}),
      ...(keyword ? {
        OR: [
          { name: { contains: keyword } },
          { description: { contains: keyword } },
          { category: { name: { contains: keyword } } },
          { skus: { some: { skuName: { contains: keyword } } } },
        ],
      } : {}),
    };
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: products.map((product) => ({
        id: product.id,
        store_id: product.storeId,
        category_id: product.categoryId,
        category: product.category?.name ?? '',
        name: product.name,
        description: product.description,
        image_url: product.imageUrl,
        type: product.type,
        price: Number(product.price),
        stock: product.stock,
        status: product.status,
        is_active: product.status === ProductStatus.ACTIVE,
        is_featured: product.isFeatured,
        skus: product.skus.map((sku) => ({
          id: sku.id,
          product_id: sku.productId,
          sku_name: sku.skuName,
          price: Number(sku.price),
          stock_count: sku.stockCount,
          is_default: sku.isDefault,
          is_active: sku.isActive,
        })),
        selection_group_count: product._count.selectionBindings
          + product.skus.reduce((sum, sku) => sum + sku._count.selectionBindings, 0),
      })),
      total,
      page,
      page_size: pageSize,
    };
  }

  async getProductStats(storeIds?: string[]): Promise<ProductStatsContract> {
    const effectiveStoreIds = this.stores.resolveStoreIds(storeIds);
    const cacheKey = [...effectiveStoreIds].sort().join(',');
    const cached = this.statsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const productWhere: Prisma.ProductWhereInput = { storeId: { in: effectiveStoreIds } };
    const skuWhere: Prisma.ProductSKUWhereInput = { product: { storeId: { in: effectiveStoreIds } } };
    const bindingWhere: Prisma.ProductSelectionGroupWhereInput = {
      isEnabled: true,
      OR: [
        { product: { storeId: { in: effectiveStoreIds } } },
        { variant: { product: { storeId: { in: effectiveStoreIds } } } },
      ],
    };
    const [productGroups, skuCount, selectionGroupCount] = await Promise.all([
      this.prisma.product.groupBy({ by: ['status', 'type'], where: productWhere, _count: { _all: true } }),
      this.prisma.productSKU.count({ where: skuWhere }),
      this.prisma.productSelectionGroup.count({ where: bindingWhere }),
    ]);
    const value = {
      total_count: productGroups.reduce((sum, group) => sum + group._count._all, 0),
      active_count: productGroups
        .filter((group) => group.status === ProductStatus.ACTIVE)
        .reduce((sum, group) => sum + group._count._all, 0),
      package_count: productGroups
        .filter((group) => group.type === ProductType.PACKAGE)
        .reduce((sum, group) => sum + group._count._all, 0),
      sku_count: skuCount,
      selection_group_count: selectionGroupCount,
    };
    this.statsCache.set(cacheKey, { expiresAt: Date.now() + 15_000, value });
    return value;
  }

  async getProductSkuOptions(storeIds?: string[]): Promise<ProductSkuOptionContract[]> {
    const effectiveStoreIds = this.stores.resolveStoreIds(storeIds);
    const skus = await this.prisma.productSKU.findMany({
      where: { product: { storeId: { in: effectiveStoreIds } } },
      select: { id: true, skuName: true, product: { select: { name: true } } },
      orderBy: [{ product: { name: 'asc' } }, { createdAt: 'asc' }],
    });
    return skus.map((sku) => ({ value: sku.id, label: `${sku.product.name} / ${sku.skuName}` }));
  }

  async createProduct(payload: CreateProductDto) {
    const store = await this.stores.resolveCurrentStore();
    await this.ensureCategoryBelongsToStore(payload.category_id, store.id);

    const product = await this.prisma.product.create({
      data: {
        storeId: store.id,
        categoryId: payload.category_id,
        name: payload.name,
        description: payload.description,
        imageUrl: payload.image_url,
        type: ProductType.SINGLE,
        price: payload.price,
        stock: payload.stock ?? 0,
        status: ProductStatus.DRAFT,
        isFeatured: payload.is_featured ?? false,
        skus: {
          create: {
            skuName: '默认',
            price: payload.price,
            stockCount: payload.stock ?? 0,
            isDefault: true,
            isActive: true,
          },
        },
      },
      include: PRODUCT_MANAGEMENT_INCLUDE,
    });

    this.invalidateProductStats();
    return mapProductRecord(product);
  }

  async updateProduct(productId: string, payload: UpdateProductDto, storeIds?: string[]) {
    const effectiveStoreIds = this.stores.resolveStoreIds(storeIds);
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        id: productId,
        storeId: { in: effectiveStoreIds },
      },
      include: {
        skus: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!existingProduct) {
      throw new NotFoundException('商品不存在');
    }

    if (payload.category_id) {
      await this.ensureCategoryBelongsToStore(payload.category_id, existingProduct.storeId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: {
          id: productId,
        },
        data: {
          ...(payload.category_id !== undefined ? { categoryId: payload.category_id } : {}),
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.image_url !== undefined ? { imageUrl: payload.image_url } : {}),
          ...(payload.price !== undefined ? { price: payload.price } : {}),
          ...(payload.stock !== undefined ? { stock: payload.stock } : {}),
          ...(payload.is_featured !== undefined ? { isFeatured: payload.is_featured } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
        },
      });

      const defaultSku = existingProduct.skus.find((sku) => sku.isDefault) ?? existingProduct.skus[0];
      if (defaultSku && (payload.price !== undefined || payload.stock !== undefined)) {
        await tx.productSKU.update({
          where: {
            id: defaultSku.id,
          },
          data: {
            ...(payload.price !== undefined ? { price: payload.price } : {}),
            ...(payload.stock !== undefined ? { stockCount: payload.stock } : {}),
          },
        });
      }

      await this.configuration.refreshProductSummary(tx, productId);
    });

    this.invalidateProductStats();
    return this.getProductDetail(productId, effectiveStoreIds);
  }

  async updateProductStatus(productId: string, status: ProductStatus, storeIds?: string[]) {
    const effectiveStoreIds = this.stores.resolveStoreIds(storeIds);
    await this.assertProductInStores(productId, effectiveStoreIds);
    await this.prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        status,
      },
    });

    this.invalidateProductStats();
    return this.getProductDetail(productId, effectiveStoreIds);
  }

  async getCurrentMenu() {
    const store = await this.stores.resolveCurrentStore();
    const categories = await this.prisma.category.findMany({
      where: {
        storeId: store.id,
        isVisible: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        products: {
          where: {
            status: ProductStatus.ACTIVE,
          },
          orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
          include: PRODUCT_MENU_INCLUDE,
        },
      },
    });

    return {
      store: {
        id: store.id,
        code: store.code,
        name: store.name,
        status: store.status.toLowerCase(),
        businessHours: store.businessHours,
        dineInEnabled: store.dineInEnabled,
        takeoutEnabled: store.takeoutEnabled,
        pickupEnabled: store.pickupEnabled,
      },
      categories: categories
        .map((category) => ({
          id: category.id,
          name: category.name,
          sort_order: category.sortOrder,
          products: category.products
            .map(mapProductRecord)
            .filter((product) => product.skus.some((sku) => sku.is_active)),
        }))
        .filter((category) => category.products.length > 0),
    };
  }

  async getProductDetail(productId: string, storeIds?: string[]) {
    const effectiveStoreIds = this.stores.resolveStoreIds(storeIds);
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        storeId: { in: effectiveStoreIds },
      },
      include: PRODUCT_MANAGEMENT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    return mapProductRecord(product);
  }

  async syncProductConfiguration(productId: string, payload: SyncProductConfigDto, storeIds?: string[]) {
    const effectiveStoreIds = this.stores.resolveStoreIds(storeIds);
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        storeId: { in: effectiveStoreIds },
      },
      select: { id: true, storeId: true },
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    await this.configuration.sync(productId, product.storeId, payload);
    this.invalidateProductStats();
    return this.getProductDetail(productId, effectiveStoreIds);
  }

  async updateSkuStock(skuId: string, stockCount: number, storeIds?: string[]) {
    await this.assertSkuInStores(skuId, this.stores.resolveStoreIds(storeIds));
    const sku = await this.prisma.productSKU.update({
      where: { id: skuId },
      data: { stockCount },
    });
    await this.configuration.refreshProductSummary(this.prisma, sku.productId);

    return { id: sku.id, stock_count: sku.stockCount };
  }

  async updateSkuPrice(skuId: string, price: number, storeIds?: string[]) {
    await this.assertSkuInStores(skuId, this.stores.resolveStoreIds(storeIds));
    const sku = await this.prisma.productSKU.update({
      where: { id: skuId },
      data: { price },
    });
    await this.configuration.refreshProductSummary(this.prisma, sku.productId);

    return { id: sku.id, price: Number(sku.price) };
  }

  private invalidateProductStats() {
    this.statsCache.clear();
  }

  private async ensureCategoryBelongsToStore(categoryId: string, storeId: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!category || category.storeId !== storeId) {
      throw new BadRequestException('分类不存在或不属于当前门店');
    }
  }

  private async assertProductInStores(productId: string, storeIds: string[]) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: { in: storeIds } },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('商品不存在');
  }

  private async assertSkuInStores(skuId: string, storeIds: string[]) {
    const sku = await this.prisma.productSKU.findFirst({
      where: { id: skuId, product: { storeId: { in: storeIds } } },
      select: { id: true },
    });
    if (!sku) throw new NotFoundException('SKU 不存在');
  }
}
