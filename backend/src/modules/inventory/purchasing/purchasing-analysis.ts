import { BadRequestException } from '@nestjs/common';
import type {
  PurchaseReceiptReportRow,
  PurchaseReceiptReport,
  PurchaseSupplierSummary,
  PurchaseMaterialSummary,
} from '@lingdian/contracts';
export function safeInteger(value: number | bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new BadRequestException('purchasing.reportTooLarge');
  return result;
}
export function summarizeReceipts(
  rows: PurchaseReceiptReportRow[],
): Pick<PurchaseReceiptReport, 'summary' | 'suppliers' | 'materials'> {
  const supplierGroups = new Map<
    string,
    { record: PurchaseSupplierSummary; cost: bigint; receipts: Set<string>; orders: Set<string> }
  >();
  const materialGroups = new Map<
    string,
    { record: PurchaseMaterialSummary; cost: bigint; quantity: bigint; receipts: Set<string> }
  >();
  let total = 0n;
  for (const row of rows) {
    const supplierKey = JSON.stringify([row.supplierId, row.supplierName, row.supplierCode]);
    let supplier = supplierGroups.get(supplierKey);
    if (!supplier) {
      supplier = {
        record: {
          supplierId: row.supplierId,
          supplierName: row.supplierName,
          supplierCode: row.supplierCode,
          receiptCount: 0,
          orderCount: 0,
          totalCostCents: 0,
        },
        cost: 0n,
        receipts: new Set(),
        orders: new Set(),
      };
      supplierGroups.set(supplierKey, supplier);
    }
    const materialKey = JSON.stringify([row.itemId, row.itemName, row.itemCode, row.unit]);
    let material = materialGroups.get(materialKey);
    if (!material) {
      material = {
        record: {
          itemId: row.itemId,
          itemName: row.itemName,
          itemCode: row.itemCode,
          unit: row.unit,
          quantity: 0,
          receiptCount: 0,
          totalCostCents: 0,
        },
        cost: 0n,
        quantity: 0n,
        receipts: new Set(),
      };
      materialGroups.set(materialKey, material);
    }
    const cost = BigInt(safeInteger(row.costCents));
    supplier.cost += cost;
    supplier.receipts.add(row.receiptId);
    supplier.orders.add(row.orderId);
    material.cost += cost;
    material.quantity += BigInt(Math.round(row.quantity * 1000));
    material.receipts.add(row.receiptId);
    total += cost;
  }
  return {
    summary: {
      receiptCount: new Set(rows.map((row) => row.receiptId)).size,
      orderCount: new Set(rows.map((row) => row.orderId)).size,
      supplierCount: new Set(rows.map((row) => row.supplierId)).size,
      materialCount: new Set(rows.map((row) => row.itemId)).size,
      totalCostCents: safeInteger(total),
    },
    suppliers: [...supplierGroups.values()].map((group) => ({
      ...group.record,
      receiptCount: group.receipts.size,
      orderCount: group.orders.size,
      totalCostCents: safeInteger(group.cost),
    })),
    materials: [...materialGroups.values()].map((group) => ({
      ...group.record,
      quantity: safeInteger(group.quantity) / 1000,
      receiptCount: group.receipts.size,
      totalCostCents: safeInteger(group.cost),
    })),
  };
}
