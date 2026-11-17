import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { InventoryItemContract, InventoryMaterialChangeKind, InventoryMaterialChangePage } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { InventoryMaterialChangesDto, RenameInventoryMaterialDto } from './dto/inventory-material.dto';
import { presentItem } from './inventory-presenter';
@Injectable()
export class InventoryMaterialService {
  constructor(private readonly db: PrismaService, private readonly scope: MerchantStoreScope) {}
  async rename(user: AuthenticatedUser, storeId: string, id: string, body: RenameInventoryMaterialDto): Promise<InventoryItemContract> {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(async tx => {
      // Same material lock as lifecycle/stock writers. A name edit never changes physical balances.
      const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM inventory_items WHERE id = ${id} AND storeId = ${storeId} FOR UPDATE`);
      if (!locked.length) throw new NotFoundException('inventory.notFound');
      const current = await tx.inventoryItem.findUniqueOrThrow({ where: { id_storeId: { id, storeId } } });
      if (current.version !== body.expectedVersion) {
        if (current.version === body.expectedVersion + 1 && current.name === body.name && await tx.inventoryMaterialChange.findFirst({ where: { storeId, itemId: id, kind: 'NAME', versionBefore: body.expectedVersion, actorId: user.userId, reason: body.reason, nameAfter: body.name }, select: { id: true } })) return presentItem(current);
        throw new ConflictException('inventory.stale');
      }
      if (!current.isActive) throw new ConflictException('inventory.inactive');
      if (current.name === body.name) return presentItem(current);
      const result = await tx.inventoryItem.update({ where: { id_storeId: { id, storeId } }, data: { name: body.name, version: { increment: 1 } } });
      await tx.inventoryMaterialChange.create({ data: { storeId, itemId: id, kind: 'NAME', nameBefore: current.name, nameAfter: body.name, reason: body.reason, actorId: user.userId, versionBefore: current.version } });
      await tx.authAuditLog.create({ data: { event: 'INVENTORY_MATERIAL_RENAMED', userId: user.userId, sessionId: user.sessionId, metadata: { storeId, itemId: id, beforeName: current.name, afterName: body.name, expectedVersion: current.version, reason: body.reason } } });
      return presentItem(result);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
  async changes(user: AuthenticatedUser, storeId: string, id: string, query: InventoryMaterialChangesDto): Promise<InventoryMaterialChangePage> {
    this.scope.assertIncludes(user, storeId);
    return this.db.$transaction(async tx => {
      const item = await tx.inventoryItem.findUnique({ where: { id_storeId: { id, storeId } } });
      if (!item) throw new NotFoundException('inventory.notFound');
      const where: Prisma.InventoryMaterialChangeWhereInput = { storeId, itemId: id, ...(query.kind !== 'ALL' ? { kind: query.kind } : {}) };
      const total = await tx.inventoryMaterialChange.count({ where });
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / 20)));
      const items = await tx.inventoryMaterialChange.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20 });
      return { storeId, item: presentItem(item), generatedAt: new Date().toISOString(), kind: query.kind, page, pageSize: 20, total,
        items: items.map(row => ({ id: row.id, kind: row.kind as InventoryMaterialChangeKind, nameBefore: row.nameBefore, nameAfter: row.nameAfter, isActiveBefore: row.isActiveBefore, isActiveAfter: row.isActiveAfter, reason: row.reason, actorId: row.actorId, versionBefore: row.versionBefore, createdAt: row.createdAt.toISOString() })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
