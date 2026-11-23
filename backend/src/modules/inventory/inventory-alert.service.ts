import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import type { InventoryAlertPage, InventoryAlertRecord, InventoryAlertStatus } from '@lingdian/contracts';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { AcknowledgeInventoryAlertDto, InventoryAlertQueryDto } from './dto/inventory-alert.dto';
const include = { item: { select: { name: true, code: true, unit: true, isActive: true } } } satisfies Prisma.InventoryAlertInclude;
type Alert = Prisma.InventoryAlertGetPayload<{ include: typeof include }>;
@Injectable()
export class InventoryAlertService {
  constructor(private readonly prisma: PrismaService, private readonly scope: MerchantStoreScope) {}
  async detail(user: AuthenticatedUser, storeId: string, id: string): Promise<InventoryAlertRecord> {
    this.scope.assertIncludes(user, storeId);
    // The alert and material lifecycle may change together. Read relation metadata from the same snapshot.
    return this.prisma.$transaction(async tx => {
      const row = await tx.inventoryAlert.findUnique({ where: { id_storeId: { id, storeId } }, include });
      if (!row) throw new NotFoundException('inventory.alertNotFound');
      return present(row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async list(user: AuthenticatedUser, storeId: string, query: InventoryAlertQueryDto): Promise<InventoryAlertPage> {
    this.scope.assertIncludes(user, storeId);
    const where: Prisma.InventoryAlertWhereInput = {
      storeId, ...(query.severity ? { severity: query.severity } : {}), ...(query.status === 'ALL' ? {} : query.status === 'ACTIVE' ? { activeItemKey: { not: null } } : { status: query.status }),
      ...(query.keyword ? { item: { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] } } : {}),
    };
    return this.prisma.$transaction(async tx => {
      const items = await tx.inventoryAlert.findMany({ where, include, orderBy: query.status === 'RESOLVED' || query.status === 'ALL' ? [{ detectedAt: 'desc' }, { id: 'desc' }] : [{ severity: 'desc' }, { detectedAt: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize });
      const total = await tx.inventoryAlert.count({ where });
      const open = await tx.inventoryAlert.count({ where: { storeId, status: 'OPEN' } });
      const acknowledged = await tx.inventoryAlert.count({ where: { storeId, status: 'ACKNOWLEDGED' } });
      const out = await tx.inventoryAlert.count({ where: { storeId, activeItemKey: { not: null }, severity: 'OUT' } });
      return { items: items.map(present), total, page: query.page, pageSize: query.pageSize, summary: { open, acknowledged, out } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async acknowledge(user: AuthenticatedUser, storeId: string, id: string, body: AcknowledgeInventoryAlertDto): Promise<InventoryAlertRecord> {
    this.scope.assertIncludes(user, storeId);
    return this.prisma.$transaction(async tx => {
      const existing = await tx.inventoryAlert.findUnique({ where: { id_storeId: { id, storeId } } });
      if (!existing) throw new NotFoundException('inventory.alertNotFound');
      // Same order as stock writers: material then alert. A stale screen must not hide a newer escalation.
      await tx.inventoryItem.updateMany({ where: { id: existing.itemId, storeId }, data: { version: { increment: 0 } } });
      const current = await tx.inventoryAlert.findUniqueOrThrow({ where: { id_storeId: { id, storeId } } });
      // Retrying an uncertain response is safe for this actor and the exact same note.
      if (current.status === 'ACKNOWLEDGED' && current.acknowledgedBy === user.userId && current.note === body.note) return present(await tx.inventoryAlert.findUniqueOrThrow({ where: { id }, include }));
      if (current.status !== 'OPEN' || current.version !== body.expectedVersion) throw new ConflictException('inventory.alertStale');
      const result = await tx.inventoryAlert.update({ where: { id }, data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: user.userId, note: body.note, version: { increment: 1 } }, include });
      await tx.authAuditLog.create({ data: { event: 'INVENTORY_ALERT_ACKNOWLEDGED', userId: user.userId, sessionId: user.sessionId, metadata: { storeId, alertId: id, itemId: current.itemId, severity: current.severity, note: body.note, expectedVersion: body.expectedVersion } } });
      return present(result);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
function present(row: Alert): InventoryAlertRecord {
  return { itemIsActive: row.item.isActive, resolutionReason: row.resolutionReason as 'RECOVERED' | 'ARCHIVED' | null, id: row.id, storeId: row.storeId, itemId: row.itemId, name: row.item.name, code: row.item.code, unit: row.item.unit,
    status: row.status as InventoryAlertStatus, severity: row.severity as 'LOW' | 'OUT', availableAtTrigger: row.availableAtTrigger / 1000, thresholdAtTrigger: row.thresholdAtTrigger / 1000,
    availableLatest: row.availableLatest / 1000, thresholdLatest: row.thresholdLatest / 1000, version: row.version,
    detectedAt: row.detectedAt.toISOString(), updatedAt: row.updatedAt.toISOString(), acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null, acknowledgedBy: row.acknowledgedBy, note: row.note, resolvedAt: row.resolvedAt?.toISOString() ?? null };
}
