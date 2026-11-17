import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { ChangeInventoryLifecycleDto } from './dto/inventory.dto';
import { presentItem } from './inventory-presenter';
import { syncInventoryAlert } from './inventory-alert-state';
import { pendingPurchaseLines } from './purchasing/pending-purchase-lines';
@Injectable()
export class InventoryLifecycleService {
  constructor(private readonly db: PrismaService, private readonly scope: MerchantStoreScope) {}
  async detail(user: AuthenticatedUser, storeId: string, id: string) {
    this.scope.assertIncludes(user, storeId);
    const item = await this.db.inventoryItem.findUnique({ where: { id_storeId: { id, storeId } } });
    if (!item) throw new NotFoundException('inventory.notFound');
    return presentItem(item);
  }
  async change(user: AuthenticatedUser, storeId: string, id: string, body: ChangeInventoryLifecycleDto) {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM inventory_items WHERE id = ${id} AND storeId = ${storeId} FOR UPDATE`);
      if (!locked.length) throw new NotFoundException('inventory.notFound');
      const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id_storeId: { id, storeId } } });
      // Replay only this exact actor/reason/action while its resulting version is still current.
      if (item.version === body.expectedVersion + 1 && item.lifecycleVersion === item.version && item.isActive === body.isActive && item.lifecycleActorId === user.userId && item.lifecycleReason === body.reason) return presentItem(item);
      if (item.version !== body.expectedVersion) throw new ConflictException('inventory.stale');
      if (item.isActive === body.isActive) return presentItem(item);
      if (!body.isActive) {
        if (item.quantity !== 0 || item.reservedQuantity !== 0 || item.availableQuantity !== 0 || await tx.inventoryReservation.count({ where: { storeId, itemId: id, status: 'RESERVED' } })) throw new ConflictException('inventory.archiveStock');
        if (await tx.inventoryRecipe.count({ where: { storeId, itemId: id } })) throw new ConflictException('inventory.archiveRecipe');
        if (await tx.purchaseOrderLine.count({ where: pendingPurchaseLines(tx, storeId, id) })) throw new ConflictException('inventory.archivePurchase');
        if (await tx.inventoryStocktakeLine.count({ where: { storeId, itemId: id, stocktake: { storeId, status: 'DRAFT' } } })) throw new ConflictException('inventory.archiveStocktake');
      }
      const result = await tx.inventoryItem.update({ where: { id_storeId: { id, storeId } }, data: { isActive: body.isActive, version: { increment: 1 }, lifecycleVersion: item.version + 1, lifecycleActorId: user.userId, lifecycleReason: body.reason, lifecycleChangedAt: new Date() } });
      await syncInventoryAlert(tx, result, user.userId);
      await tx.authAuditLog.create({ data: { event: body.isActive ? 'INVENTORY_MATERIAL_RESTORED' : 'INVENTORY_MATERIAL_ARCHIVED', userId: user.userId, sessionId: user.sessionId, metadata: { storeId, itemId: id, expectedVersion: item.version, isActive: body.isActive, reason: body.reason } } });
      return presentItem(result);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
