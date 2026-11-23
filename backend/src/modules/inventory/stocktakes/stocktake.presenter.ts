import type { Prisma } from '@lingdian/db';
import type { StocktakeRecord, StocktakeStatus } from '@lingdian/contracts';
export const stocktakeInclude = {
  lines: { include: { item: true }, orderBy: { itemId: 'asc' as const } },
} satisfies Prisma.InventoryStocktakeInclude;
export type Stocktake = Prisma.InventoryStocktakeGetPayload<{ include: typeof stocktakeInclude }>;
export function presentStocktake(row: Stocktake): StocktakeRecord {
  return {
    id: row.id,
    storeId: row.storeId,
    title: row.title,
    note: row.note,
    status: row.status as StocktakeStatus,
    version: row.version,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    postedBy: row.postedBy,
    postedAt: row.postedAt?.toISOString() ?? null,
    cancelledBy: row.cancelledBy,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      itemName: line.itemName,
      itemCode: line.itemCode,
      unit: line.unit,
      expectedQuantity: line.expectedQuantity / 1000,
      reservedQuantity: line.reservedQuantity / 1000,
      itemVersion: line.itemVersion,
      capturedAt: line.capturedAt.toISOString(),
      countedQuantity: line.countedQuantity === null ? null : line.countedQuantity / 1000,
      currentQuantity: line.item.quantity / 1000,
      currentReserved: line.item.reservedQuantity / 1000,
      currentVersion: line.item.version,
    })),
  };
}
