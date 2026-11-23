import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@lingdian/db';
import { syncInventoryAlert } from './inventory-alert-state';

type OrderRef = { id: string; storeId: string; orderNo: string };
const MAX_QUANTITY = 999999000;
export const STOCK_HOLD_MINUTES = 30;

/** All calls run in the caller's order transaction. Lock order: order → SKUs → materials. */
@Injectable()
export class OrderStockService {
  async reserve(tx: Prisma.TransactionClient, order: OrderRef, lines: { skuId: string; quantity: number }[], actorId: string): Promise<Date | null> {
    const quantities = new Map<string, number>();
    for (const line of lines) quantities.set(line.skuId, (quantities.get(line.skuId) ?? 0) + line.quantity);
    const skuIds = [...quantities.keys()].sort();
    // Serialize recipe replacement with checkout. ReadCommitted reads the recipe after this lock.
    for (const id of skuIds) {
      const locked = await tx.productSKU.updateMany({ where: { id, isActive: true, product: { storeId: order.storeId } }, data: { recipeVersion: { increment: 0 } } });
      if (locked.count !== 1) throw new ConflictException('inventory.skuUnavailable');
    }
    const recipes = await tx.inventoryRecipe.findMany({ where: { storeId: order.storeId, skuId: { in: skuIds } } });
    const required = new Map<string, number>();
    for (const recipe of recipes) required.set(recipe.itemId, (required.get(recipe.itemId) ?? 0) + recipe.quantity * quantities.get(recipe.skuId)!);
    if (!required.size) return null;
    for (const [itemId, amount] of [...required].sort(([a], [b]) => a.localeCompare(b))) {
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_QUANTITY) throw new ConflictException('inventory.orderInsufficient');
      const item = await lockMaterial(tx, order.storeId, itemId);
      if (item.isActive === false || item.availableQuantity < amount) throw new ConflictException('inventory.orderInsufficient');
      const next = { quantity: item.quantity, reservedQuantity: item.reservedQuantity + amount, availableQuantity: item.availableQuantity - amount };
      await updateMaterial(tx, item, next);
      await tx.inventoryReservation.create({ data: { storeId: order.storeId, orderId: order.id, itemId, quantity: amount } });
      await movement(tx, order, item, next, 'RESERVE', amount, actorId);
      await syncInventoryAlert(tx, { ...item, ...next }, actorId);
    }
    return new Date(Date.now() + STOCK_HOLD_MINUTES * 60_000);
  }

  async commit(tx: Prisma.TransactionClient, order: OrderRef, actorId: string): Promise<void> { await this.settle(tx, order, actorId, 'COMMIT'); }
  async release(tx: Prisma.TransactionClient, order: OrderRef, actorId: string): Promise<void> { await this.settle(tx, order, actorId, 'RELEASE'); }

  private async settle(tx: Prisma.TransactionClient, order: OrderRef, actorId: string, mode: 'COMMIT' | 'RELEASE'): Promise<void> {
    const holds = await tx.inventoryReservation.findMany({ where: { orderId: order.id, storeId: order.storeId, status: 'RESERVED' }, orderBy: { itemId: 'asc' } });
    for (const hold of holds) {
      const item = await lockMaterial(tx, order.storeId, hold.itemId);
      if (item.reservedQuantity < hold.quantity || item.quantity < hold.quantity) throw new ConflictException('inventory.reservationMismatch');
      const next = {
        quantity: item.quantity - (mode === 'COMMIT' ? hold.quantity : 0), reservedQuantity: item.reservedQuantity - hold.quantity,
        availableQuantity: item.availableQuantity + (mode === 'RELEASE' ? hold.quantity : 0),
      };
      const changed = await tx.inventoryReservation.updateMany({ where: { id: hold.id, storeId: order.storeId, status: 'RESERVED' }, data: { status: mode === 'COMMIT' ? 'COMMITTED' : 'RELEASED' } });
      if (changed.count !== 1) throw new ConflictException('inventory.stale');
      await updateMaterial(tx, item, next);
      await movement(tx, order, item, next, mode === 'COMMIT' ? 'ISSUE' : 'RELEASE', hold.quantity, actorId);
      await syncInventoryAlert(tx, { ...item, ...next }, actorId);
    }
  }
}

type Material = Prisma.InventoryItemGetPayload<Prisma.InventoryItemDefaultArgs>;
type Balance = Pick<Material, 'quantity' | 'reservedQuantity' | 'availableQuantity'>;
async function lockMaterial(tx: Prisma.TransactionClient, storeId: string, id: string): Promise<Material> {
  const locked = await tx.inventoryItem.updateMany({ where: { id, storeId }, data: { version: { increment: 0 } } });
  if (locked.count !== 1) throw new ConflictException('inventory.orderInsufficient');
  const item = await tx.inventoryItem.findUnique({ where: { id_storeId: { id, storeId } } });
  if (!item) throw new ConflictException('inventory.orderInsufficient');
  return item;
}
async function updateMaterial(tx: Prisma.TransactionClient, item: Material, next: Balance) {
  const changed = await tx.inventoryItem.updateMany({ where: { id: item.id, storeId: item.storeId, version: item.version }, data: { ...next, version: { increment: 1 } } });
  if (changed.count !== 1) throw new ConflictException('inventory.stale');
}
async function movement(tx: Prisma.TransactionClient, order: OrderRef, item: Material, next: Balance, kind: 'RESERVE' | 'RELEASE' | 'ISSUE', amount: number, actorId: string) {
  await tx.inventoryMovement.create({ data: {
    storeId: order.storeId, itemId: item.id, requestId: createHash('sha256').update(`${kind}:${order.id}:${item.id}`).digest('hex'), kind, amount,
    quantityBefore: item.quantity, quantityAfter: next.quantity, reservedBefore: item.reservedQuantity, reservedAfter: next.reservedQuantity,
    reorderPointBefore: item.reorderPoint, reorderPointAfter: item.reorderPoint, versionBefore: item.version, actorId,
    reason: `Order ${order.orderNo}: ${kind === 'RESERVE' ? 'stock reserved' : kind === 'ISSUE' ? 'payment confirmed' : 'stock released'}`.slice(0, 240),
  } });
}
