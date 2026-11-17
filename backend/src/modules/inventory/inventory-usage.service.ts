import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { InventoryUsagePage, InventoryUsageRow } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { InventoryUsageQueryDto } from './dto/inventory-usage.dto';
import { pendingPurchaseLines } from './purchasing/pending-purchase-lines';
import { presentItem } from './inventory-presenter';
@Injectable()
export class InventoryUsageService {
  constructor(private readonly db: PrismaService, private readonly scope: MerchantStoreScope) {}
  async usage(user: AuthenticatedUser, storeId: string, itemId: string, query: InventoryUsageQueryDto): Promise<InventoryUsagePage> {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(async tx => {
      const item = await tx.inventoryItem.findUnique({ where: { id_storeId: { id: itemId, storeId } } });
      if (!item) throw new NotFoundException('inventory.notFound');
      const recipes: Prisma.InventoryRecipeWhereInput = { storeId, itemId, sku: { product: { storeId } } };
      const purchases = pendingPurchaseLines(tx, storeId, itemId);
      const stocktakes: Prisma.InventoryStocktakeLineWhereInput = { storeId, itemId, stocktake: { storeId, status: 'DRAFT' } };
      const recipeCount = await tx.inventoryRecipe.count({ where: recipes });
      // Legacy recipes did not have a store composite foreign key to SKU. Never expose a foreign product.
      const allRecipes = await tx.inventoryRecipe.count({ where: { storeId, itemId } });
      const counts = { recipes: recipeCount, purchases: await tx.purchaseOrderLine.count({ where: purchases }), stocktakes: await tx.inventoryStocktakeLine.count({ where: stocktakes }) };
      const total = query.view === 'RECIPES' ? counts.recipes : query.view === 'PURCHASES' ? counts.purchases : counts.stocktakes;
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / 20))), skip = (page - 1) * 20;
      let items: InventoryUsageRow[];
      if (query.view === 'RECIPES') {
        const rows = await tx.inventoryRecipe.findMany({ where: recipes, include: { sku: { include: { product: { select: { name: true, status: true } } } } }, orderBy: [{ skuId: 'asc' }, { id: 'asc' }], skip, take: 20 });
        items = rows.map(row => ({ kind: 'RECIPES', skuId: row.skuId, productName: row.sku.product.name, skuName: row.sku.skuName, skuIsActive: row.sku.isActive, productStatus: row.sku.product.status, quantity: row.quantity / 1000 }));
      } else if (query.view === 'PURCHASES') {
        const rows = await tx.purchaseOrderLine.findMany({ where: purchases, include: { order: true }, orderBy: [{ order: { createdAt: 'desc' } }, { orderId: 'desc' }, { id: 'asc' }], skip, take: 20 });
        items = rows.map(row => ({ kind: 'PURCHASES', orderId: row.orderId, orderNo: row.order.orderNo, supplierName: row.order.supplierName, status: row.order.status as 'OPEN' | 'PARTIAL', remainingQuantity: (row.quantity - row.receivedQuantity) / 1000, expectedAt: row.order.expectedAt?.toISOString() ?? null }));
      } else {
        const rows = await tx.inventoryStocktakeLine.findMany({ where: stocktakes, include: { stocktake: true }, orderBy: [{ stocktake: { createdAt: 'desc' } }, { stocktakeId: 'desc' }, { id: 'asc' }], skip, take: 20 });
        items = rows.map(row => ({ kind: 'STOCKTAKES', stocktakeId: row.stocktakeId, title: row.stocktake.title, createdAt: row.stocktake.createdAt.toISOString(), countedQuantity: row.countedQuantity === null ? null : row.countedQuantity / 1000 }));
      }
      return { storeId, item: presentItem(item), view: query.view, page, pageSize: 20, total, counts, unavailableRecipes: Math.max(0, allRecipes - recipeCount), generatedAt: new Date().toISOString(), items };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
