export type PurchaseStatus = 'OPEN' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
export interface SupplierRecord {
  id: string;
  storeId: string;
  code: string;
  name: string;
  contact: string;
  note: string;
  isActive: boolean;
  version: number;
}
export interface SupplierInput {
  code: string;
  name: string;
  contact: string;
  note: string;
  isActive: boolean;
}
export interface PurchaseLineInput {
  itemId: string;
  quantity: number;
  unitPrice: number;
}
export interface CreatePurchaseRequest {
  requestId: string;
  supplierId: string;
  expectedAt?: string;
  note: string;
  lines: PurchaseLineInput[];
}
export interface ReceivePurchaseRequest {
  requestId: string;
  expectedVersion: number;
  note: string;
  lines: Array<{ lineId: string; quantity: number }>;
}
export interface PurchaseLine {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  quantity: number;
  receivedQuantity: number;
  unitPriceCents: number;
}
export interface PurchaseRecord {
  id: string;
  storeId: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  orderNo: string;
  status: PurchaseStatus;
  version: number;
  totalCostCents: number;
  receivedCostCents: number;
  expectedAt: string | null;
  note: string;
  createdBy: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  lines: PurchaseLine[];
}
export interface PurchaseReceiptRecord {
  id: string;
  orderId: string;
  note: string;
  actorId: string;
  totalCostCents: number;
  createdAt: string;
  lines: Array<{
    lineId: string;
    itemName: string;
    itemCode: string;
    unit: string;
    quantity: number;
    costCents: number;
  }>;
}
export interface PurchasingPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PurchaseDeliveryFilter = 'ALL' | 'BEFORE' | 'UNDATED';
export interface PurchaseDeliveryQuery {
  delivery?: PurchaseDeliveryFilter;
  /** Exclusive, explicitly zoned instant. Required only for BEFORE. */
  expectedBefore?: string;
}
