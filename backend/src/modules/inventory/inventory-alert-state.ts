import { Prisma } from '@lingdian/db';

type Balance = Pick<Prisma.InventoryItemGetPayload<Prisma.InventoryItemDefaultArgs>, 'id' | 'storeId' | 'availableQuantity' | 'reorderPoint'>;
/** Caller already owns the material row lock. Keep the alert in the same stock transaction. */
export async function syncInventoryAlert(tx: Prisma.TransactionClient, item: Balance, actorId: string): Promise<void> {
  const active = await tx.inventoryAlert.findUnique({ where: { activeItemKey: item.id } });
  const severity = item.availableQuantity === 0 ? 'OUT' : item.availableQuantity <= item.reorderPoint ? 'LOW' : null;
  if (!active) {
    if (severity) await tx.inventoryAlert.create({ data: {
      storeId: item.storeId, itemId: item.id, activeItemKey: item.id, severity,
      availableAtTrigger: item.availableQuantity, thresholdAtTrigger: item.reorderPoint,
      availableLatest: item.availableQuantity, thresholdLatest: item.reorderPoint,
    } });
    return;
  }
  if (active.storeId !== item.storeId) throw new Error('Inventory alert tenant mismatch');
  if (severity === active.severity && item.availableQuantity === active.availableLatest && item.reorderPoint === active.thresholdLatest) return;
  const escalated = severity === 'OUT' && active.severity === 'LOW';
  const resolved = !severity;
  await tx.inventoryAlert.update({ where: { id: active.id }, data: {
    availableLatest: item.availableQuantity, thresholdLatest: item.reorderPoint, version: { increment: 1 },
    ...(severity ? { severity, ...(escalated ? { status: 'OPEN' } : {}) } : { status: 'RESOLVED', activeItemKey: null, resolvedAt: new Date() }),
  } });
  if (escalated || resolved) await tx.authAuditLog.create({ data: {
    event: resolved ? 'INVENTORY_ALERT_RESOLVED' : 'INVENTORY_ALERT_ESCALATED', userId: actorId,
    metadata: { storeId: item.storeId, alertId: active.id, itemId: item.id, previousStatus: active.status, previousSeverity: active.severity, available: item.availableQuantity, threshold: item.reorderPoint },
  } });
}
