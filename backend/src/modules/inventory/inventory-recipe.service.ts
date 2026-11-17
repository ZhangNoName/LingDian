import { lockActiveMaterials } from './active-materials';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { InventoryRecipePage, InventoryRecipeRecord } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { RecipeQueryDto, SaveRecipeDto } from './dto/inventory-recipe.dto';

const include = { product: { select: { name: true } }, inventoryRecipes: { include: { item: { select: { name: true, code: true, unit: true } } }, orderBy: { itemId: 'asc' as const } } } satisfies Prisma.ProductSKUInclude;
type RecipeSku = Prisma.ProductSKUGetPayload<{ include: typeof include }>;

@Injectable()
export class InventoryRecipeService {
  constructor(private readonly prisma: PrismaService, private readonly scope: MerchantStoreScope) {}

  async list(user: AuthenticatedUser, storeId: string, query: RecipeQueryDto): Promise<InventoryRecipePage> {
    this.scope.assertIncludes(user, storeId);
    const where: Prisma.ProductSKUWhereInput = { product: { storeId }, ...(query.keyword ? { OR: [{ skuName: { contains: query.keyword } }, { product: { name: { contains: query.keyword } } }] } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.productSKU.findMany({ where, include, orderBy: [{ productId: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize });
      const total = await tx.productSKU.count({ where });
      return { items: items.map(present), total, page: query.page, pageSize: query.pageSize };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async save(user: AuthenticatedUser, storeId: string, skuId: string, body: SaveRecipeDto): Promise<InventoryRecipeRecord> {
    this.scope.assertIncludes(user, storeId);
    const itemIds = body.entries.map((entry) => entry.itemId);
    if (new Set(itemIds).size !== itemIds.length) throw new BadRequestException('inventory.duplicateMaterial');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productSKU.findFirst({ where: { id: skuId, product: { storeId } }, select: { id: true } });
      if (!existing) throw new NotFoundException('inventory.skuUnavailable');
      const changed = await tx.productSKU.updateMany({ where: { id: skuId, product: { storeId }, recipeVersion: body.expectedVersion }, data: { recipeVersion: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('inventory.stale');
      await lockActiveMaterials(tx, storeId, itemIds, 'inventory.notFound', 'inventory.inactive');
      const count = await tx.inventoryItem.count({ where: { id: { in: itemIds }, storeId, isActive: true } });
      if (count !== itemIds.length) throw new BadRequestException('inventory.notFound');
      await tx.inventoryRecipe.deleteMany({ where: { skuId, storeId } });
      if (body.entries.length) await tx.inventoryRecipe.createMany({ data: body.entries.map((entry) => ({ skuId, storeId, itemId: entry.itemId, quantity: Math.round(entry.quantity * 1000) })) });
      await tx.authAuditLog.create({ data: { userId: user.userId, event: 'INVENTORY_RECIPE_UPDATED', metadata: { storeId, skuId, expectedVersion: body.expectedVersion, entries: body.entries.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })) } } });
      return present(await tx.productSKU.findUniqueOrThrow({ where: { id: skuId }, include }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
function present(sku: RecipeSku): InventoryRecipeRecord {
  return { skuId: sku.id, productName: sku.product.name, skuName: sku.skuName, version: sku.recipeVersion,
    entries: sku.inventoryRecipes.map((entry) => ({ itemId: entry.itemId, name: entry.item.name, code: entry.item.code, unit: entry.item.unit, quantity: entry.quantity / 1000 })),
  };
}
