import type { InventoryItemContract } from './inventory';
export interface PurchaseReportFilter {
  startAt: string;
  endAt: string;
  keyword?: string;
  supplierId?: string;
  itemId?: string;
}
export interface PurchaseReceiptReportRow {
  receiptId: string;
  orderId: string;
  orderNo: string;
  receivedAt: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  costCents: number;
  actorId: string;
  note: string;
}
export interface PurchaseSupplierSummary {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  receiptCount: number;
  orderCount: number;
  totalCostCents: number;
}
export interface PurchaseMaterialSummary {
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  quantity: number;
  receiptCount: number;
  totalCostCents: number;
}
export interface PurchaseReceiptReport {
  storeId: string;
  startAt: string;
  endAt: string;
  generatedAt: string;
  currency: 'CNY';
  summary: {
    receiptCount: number;
    orderCount: number;
    supplierCount: number;
    materialCount: number;
    totalCostCents: number;
  };
  suppliers: PurchaseSupplierSummary[];
  materials: PurchaseMaterialSummary[];
  rows: PurchaseReceiptReportRow[];
}
export interface ReplenishmentRow extends InventoryItemContract {
  pendingQuantity: number;
  pendingOrderCount: number;
  recommendedQuantity: number;
}
export interface ReplenishmentSnapshot {
  storeId: string;
  generatedAt: string;
  rows: ReplenishmentRow[];
  summary: { materialCount: number; shortageCount: number; coveredCount: number; neededCount: number };
}
