import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { PrismaService } from '../../../prisma/prisma.service';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
import { ProductsService } from '../products.service';
import { claimCatalogVersion } from '../product-write-policy';
import { assertPublishable, assertStatusTransition } from './catalog-publish-policy';
import {
  CreateMerchantProductDto,
  MerchantCategoryDto,
  MerchantCategoryQueryDto,
  MerchantProductStatusDto,
  UpdateMerchantProductDto,
} from './merchant-catalog.dto';
const categoryRecord = (row: { id: string; storeId: string; name: string; sortOrder: number; isVisible: boolean }) => ({
  id: row.id,
  store_id: row.storeId,
  name: row.name,
  sort_order: row.sortOrder,
  is_visible: row.isVisible,
});
@Injectable()
export class MerchantCatalogService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
    private readonly products: ProductsService,
  ) {}
  async categories(user: AuthenticatedUser, storeId: string, query: MerchantCategoryQueryDto) {
    this.scope.assertIncludes(user, storeId);
    const where = {
      storeId,
      ...(query.categoryId ? { id: query.categoryId } : {}),
      ...(query.keyword ? { name: { contains: query.keyword } } : {}),
    };
    return this.db.$transaction(
      async (tx) => ({
        items: (
          await tx.category.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            take: query.pageSize,
            skip: (query.page - 1) * query.pageSize,
          })
        ).map(categoryRecord),
        total: await tx.category.count({ where }),
        page: query.page,
        pageSize: query.pageSize,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async createCategory(user: AuthenticatedUser, storeId: string, body: MerchantCategoryDto) {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT id FROM stores WHERE id = ${storeId} FOR UPDATE`,
        );
        if (!locked.length) throw new NotFoundException('catalog.storeUnavailable');
        const existing = await tx.category.findFirst({ where: { storeId, name: body.name }, orderBy: { id: 'asc' } });
        if (existing) {
          if (!existing.isVisible) throw new BadRequestException('catalog.categoryHidden');
          return categoryRecord(existing);
        }
        const saved = await tx.category.create({ data: { storeId, name: body.name } });
        await this.audit(tx, user, storeId, 'CATALOG_CATEGORY_CREATED', saved.id, { name: saved.name });
        return categoryRecord(saved);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
  async create(user: AuthenticatedUser, storeId: string, body: CreateMerchantProductDto) {
    this.scope.assertIncludes(user, storeId);
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          actor: user.userId,
          category: body.category_id,
          name: body.name,
          description: body.description,
          priceCents: Math.round(body.price * 100),
          skuName: body.sku_name,
          featured: body.is_featured,
        }),
      )
      .digest('hex');
    const where = { storeId_creationRequestId: { storeId, creationRequestId: body.requestId } };
    const previous = await this.db.product.findUnique({ where });
    if (previous) {
      if (previous.creationFingerprint !== hash) throw new ConflictException('catalog.requestConflict');
      return this.products.getProductDetail(previous.id, [storeId]);
    }
    let id: string;
    try {
      id = await this.db.$transaction(
        async (tx) => {
          await this.category(tx, storeId, body.category_id);
          const product = await tx.product.create({
            data: {
              storeId,
              categoryId: body.category_id,
              name: body.name,
              description: body.description,
              isFeatured: body.is_featured,
              price: body.price,
              status: 'DRAFT',
              creationRequestId: body.requestId,
              creationFingerprint: hash,
              skus: {
                create: { skuName: body.sku_name, price: body.price, stockCount: 0, isActive: true, isDefault: true },
              },
            },
          });
          await this.audit(tx, user, storeId, 'CATALOG_PRODUCT_CREATED', product.id, {
            name: body.name,
            categoryId: body.category_id,
          });
          return product.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) {
        const committed = await this.db.product.findUnique({ where });
        if (committed) {
          if (committed.creationFingerprint !== hash) throw new ConflictException('catalog.requestConflict');
          this.products.invalidateProductStats();
          return this.products.getProductDetail(committed.id, [storeId]);
        }
      }
      throw e;
    }
    this.products.invalidateProductStats();
    return this.products.getProductDetail(id, [storeId]);
  }
  async details(user: AuthenticatedUser, storeId: string, id: string, body: UpdateMerchantProductDto) {
    this.scope.assertIncludes(user, storeId);
    await this.db.$transaction(
      async (tx) => {
        const found = await tx.product.findFirst({ where: { id, storeId } });
        if (!found) throw new NotFoundException('catalog.productUnavailable');
        await claimCatalogVersion(tx, id, storeId, body.expected_version);
        const product = await tx.product.findUniqueOrThrow({ where: { id } });
        const category = await this.category(tx, storeId, body.category_id);
        if (product.status === 'ACTIVE' && !category.isVisible) throw new BadRequestException('catalog.categoryHidden');
        await tx.product.update({
          where: { id },
          data: {
            name: body.name,
            description: body.description,
            categoryId: body.category_id,
            isFeatured: body.is_featured,
          },
        });
        await this.audit(tx, user, storeId, 'CATALOG_PRODUCT_DETAILS_UPDATED', id, {
          expectedVersion: body.expected_version,
          name: body.name,
          categoryId: body.category_id,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    this.products.invalidateProductStats();
    return this.products.getProductDetail(id, [storeId]);
  }
  async status(user: AuthenticatedUser, storeId: string, id: string, body: MerchantProductStatusDto) {
    this.scope.assertIncludes(user, storeId);
    await this.db.$transaction(
      async (tx) => {
        const found = await tx.product.findFirst({ where: { id, storeId } });
        if (!found) throw new NotFoundException('catalog.productUnavailable');
        await claimCatalogVersion(tx, id, storeId, body.expected_version);
        const product = await tx.product.findUniqueOrThrow({ where: { id } });
        assertStatusTransition(product.status, body.status);
        if (body.status === 'ACTIVE') await assertPublishable(tx, id, storeId);
        await tx.product.update({ where: { id }, data: { status: body.status } });
        await this.audit(tx, user, storeId, 'CATALOG_PRODUCT_STATUS_UPDATED', id, {
          expectedVersion: body.expected_version,
          from: product.status,
          to: body.status,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    this.products.invalidateProductStats();
    return this.products.getProductDetail(id, [storeId]);
  }
  private async category(tx: Prisma.TransactionClient, storeId: string, id: string) {
    const category = await tx.category.findFirst({ where: { id, storeId } });
    if (!category) throw new BadRequestException('catalog.categoryUnavailable');
    return category;
  }
  private audit(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    storeId: string,
    event: string,
    objectId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    return tx.authAuditLog.create({
      data: { event, userId: user.userId, sessionId: user.sessionId, metadata: { storeId, objectId, ...metadata } },
    });
  }
}
