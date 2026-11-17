/** Quantities in API contracts are in the displayed unit, with at most three decimals. */
export type InventoryStatus = 'HEALTHY' | 'LOW' | 'OUT';
export type InventoryMovementKind = 'RECEIVE' | 'ISSUE' | 'LOSS' | 'COUNT' | 'THRESHOLD';
export interface InventoryItemContract {
  id: string;
  storeId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  reorderPoint: number;
  shortage: number;
  status: InventoryStatus;
  version: number;
  updatedAt: string;
}
export interface InventoryPage {
  items: InventoryItemContract[];
  total: number;
  page: number;
  pageSize: number;
  summary: { total: number; low: number; out: number };
}
export interface CreateInventoryItemRequest {
  code: string;
  name: string;
  unit: string;
  reorderPoint: number;
}
export interface AdjustInventoryRequest {
  requestId: string;
  kind: InventoryMovementKind;
  amount: number;
  expectedVersion: number;
  reason: string;
}
export interface InventoryMovementContract {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  kind: InventoryMovementKind;
  amount: number;
  quantityBefore: number;
  quantityAfter: number;
  reorderPointBefore: number;
  reorderPointAfter: number;
  actorId: string;
  reason: string;
  createdAt: string;
}
export interface InventoryMovementPage {
  items: InventoryMovementContract[];
  total: number;
  page: number;
  pageSize: number;
}

/** Instants are inclusive at startAt and exclusive at endAt. */
export interface InventoryActivityFilter {
  startAt?: string;
  endAt?: string;
  itemId?: string;
  keyword?: string;
  kind?: InventoryMovementKind;
}
export interface InventoryReportFilter extends Omit<InventoryActivityFilter, 'kind' | 'startAt' | 'endAt'> {
  startAt: string;
  endAt: string;
}
export interface InventoryReportRow {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  opening: number;
  received: number;
  issued: number;
  lost: number;
  countGain: number;
  countLoss: number;
  closing: number;
  movementCount: number;
}
export interface InventoryPeriodReport {
  storeId: string;
  startAt: string;
  endAt: string;
  generatedAt: string;
  rows: InventoryReportRow[];
}
