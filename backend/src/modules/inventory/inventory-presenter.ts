import type { Prisma } from '@lingdian/db';
import type { InventoryItemContract } from '@lingdian/contracts';
type Item = Prisma.InventoryItemGetPayload<Prisma.InventoryItemDefaultArgs>;
export function presentItem(item: Item): InventoryItemContract {
  return { isActive: item.isActive, lifecycleActorId: item.lifecycleActorId, lifecycleReason: item.lifecycleReason, lifecycleChangedAt: item.lifecycleChangedAt?.toISOString() ?? null, id: item.id, storeId: item.storeId, code: item.code, name: item.name, unit: item.unit, version: item.version, quantity: item.quantity / 1000, reorderPoint: item.reorderPoint / 1000,
    reservedQuantity: item.reservedQuantity / 1000, availableQuantity: item.availableQuantity / 1000,
    shortage: Math.max(0, item.reorderPoint - item.availableQuantity) / 1000,
    status: item.availableQuantity === 0 ? 'OUT' : item.availableQuantity <= item.reorderPoint ? 'LOW' : 'HEALTHY',
    updatedAt: item.updatedAt.toISOString(),
  };
}
