import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.type';
import { PrismaService } from '../../../prisma/prisma.service';
import { MerchantStoreScope } from '../../merchant/merchant-store-scope';
import { UpdateMerchantCategoryDto } from './merchant-catalog.dto';
@Injectable()
export class MerchantCategoryService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: MerchantStoreScope,
  ) {}
  async update(user: AuthenticatedUser, storeId: string, id: string, body: UpdateMerchantCategoryDto) {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(
      async (tx) => {
        // Share the merchant creation lock, so concurrent renames/creates cannot add a same-name category.
        const store = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT id FROM stores WHERE id = ${storeId} FOR UPDATE`,
        );
        if (!store.length) throw new NotFoundException('catalog.storeUnavailable');
        const claimed = await tx.category.updateMany({
          where: { id, storeId, version: body.expected_version },
          data: { version: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          if (!(await tx.category.findFirst({ where: { id, storeId } })))
            throw new NotFoundException('catalog.categoryUnavailable');
          throw new ConflictException('catalog.categoryStale');
        }
        const before = await tx.category.findUniqueOrThrow({ where: { id } });
        if (
          body.name !== before.name &&
          (await tx.category.findFirst({ where: { storeId, name: body.name, id: { not: id } } }))
        )
          throw new ConflictException('catalog.categoryNameExists');
        const row = await tx.category.update({
          where: { id },
          data: { name: body.name, sortOrder: body.sort_order, isVisible: body.is_visible },
        });
        const productCount = await tx.product.count({ where: { storeId, categoryId: id } }),
          activeCount = await tx.product.count({ where: { storeId, categoryId: id, status: 'ACTIVE' } });
        await tx.authAuditLog.create({
          data: {
            event: 'CATALOG_CATEGORY_UPDATED',
            userId: user.userId,
            sessionId: user.sessionId,
            metadata: {
              storeId,
              categoryId: id,
              expectedVersion: body.expected_version,
              before: { name: before.name, sortOrder: before.sortOrder, isVisible: before.isVisible },
              after: { name: row.name, sortOrder: row.sortOrder, isVisible: row.isVisible },
              productCount,
              activeCount,
            },
          },
        });
        return {
          id: row.id,
          store_id: storeId,
          name: row.name,
          sort_order: row.sortOrder,
          is_visible: row.isVisible,
          configuration_version: row.version,
          product_count: productCount,
          active_product_count: activeCount,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
