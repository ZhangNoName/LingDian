import type { Prisma } from '@lingdian/db';

/** Only lines that can still deliver stock count as outstanding procurement. */
export function pendingPurchaseLines(
  db: Pick<Prisma.TransactionClient, 'purchaseOrderLine'>,
  storeId: string,
  itemId?: string,
): Prisma.PurchaseOrderLineWhereInput {
  return {
    storeId,
    ...(itemId ? { itemId } : {}),
    receivedQuantity: { lt: db.purchaseOrderLine.fields.quantity },
    order: { storeId, status: { in: ['OPEN', 'PARTIAL'] } },
  };
}
