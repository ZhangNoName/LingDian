import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@lingdian/db';
export const scale = (quantity: number) => Math.round(quantity * 1000);
/** Round once per receipt line, half up, without multiplying unsafe JS integers. */
export function lineCost(quantity: number, unitPriceCents: number): bigint {
  return (BigInt(quantity) * BigInt(unitPriceCents) + 500n) / 1000n;
}
export function cents(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new BadRequestException('purchasing.tooLarge');
  return result;
}
export function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function distinct(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new BadRequestException('purchasing.duplicateLine');
}
export function assertReplay(existing: { fingerprint: string }, hash: string) {
  if (existing.fingerprint !== hash) throw new ConflictException('purchasing.requestConflict');
}
export function race(error: unknown) {
  return (
    error instanceof ConflictException ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code))
  );
}
export function serializableError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
    throw new ConflictException('purchasing.stale');
  throw error;
}
export const orderInclude = { lines: { orderBy: { itemId: 'asc' } } } satisfies Prisma.PurchaseOrderInclude;
type Order = Prisma.PurchaseOrderGetPayload<{ include: typeof orderInclude }>;
export function presentOrder(order: Order): import('@lingdian/contracts').PurchaseRecord {
  return {
    id: order.id,
    storeId: order.storeId,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    supplierCode: order.supplierCode,
    orderNo: order.orderNo,
    status: order.status as import('@lingdian/contracts').PurchaseStatus,
    version: order.version,
    totalCostCents: cents(order.totalCostCents),
    receivedCostCents: cents(order.receivedCostCents),
    expectedAt: order.expectedAt?.toISOString() ?? null,
    note: order.note,
    createdBy: order.createdBy,
    createdAt: order.createdAt.toISOString(),
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelledBy: order.cancelledBy,
    cancelReason: order.cancelReason,
    lines: order.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      itemName: line.itemName,
      itemCode: line.itemCode,
      unit: line.unit,
      quantity: line.quantity / 1000,
      receivedQuantity: line.receivedQuantity / 1000,
      unitPriceCents: line.unitPriceCents,
    })),
  };
}
export const receiptInclude = {
  lines: { include: { orderLine: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.PurchaseReceiptInclude;
export function presentReceipt(
  receipt: Prisma.PurchaseReceiptGetPayload<{ include: typeof receiptInclude }>,
): import('@lingdian/contracts').PurchaseReceiptRecord {
  return {
    id: receipt.id,
    orderId: receipt.orderId,
    note: receipt.note,
    actorId: receipt.actorId,
    totalCostCents: cents(receipt.totalCostCents),
    createdAt: receipt.createdAt.toISOString(),
    lines: receipt.lines.map((line) => ({
      lineId: line.orderLineId,
      itemName: line.orderLine.itemName,
      itemCode: line.orderLine.itemCode,
      unit: line.orderLine.unit,
      quantity: line.quantity / 1000,
      costCents: cents(line.costCents),
    })),
  };
}
