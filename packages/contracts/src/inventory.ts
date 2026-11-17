/** Quantities in API contracts are in the displayed unit, with at most three decimals. */
export type InventoryStatus = 'HEALTHY' | 'LOW' | 'OUT';
export type InventoryAdjustmentKind = 'RECEIVE' | 'ISSUE' | 'LOSS' | 'COUNT' | 'THRESHOLD';
export type InventoryMovementKind = InventoryAdjustmentKind | 'RESERVE' | 'RELEASE';
export interface InventoryItemContract {
  id: string;
  storeId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  reservedQuantity?: number;
  availableQuantity?: number;
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
  kind: InventoryAdjustmentKind;
  amount: number;
  expectedVersion: number;
  reason: string;
}
export interface InventoryMovementContract {
  purchaseOrderId?: string;
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  kind: InventoryMovementKind;
  amount: number;
  quantityBefore: number;
  quantityAfter: number;
  reservedBefore?: number;
  reservedAfter?: number;
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

export interface InventoryRecipeEntry { itemId: string; name: string; code: string; unit: string; quantity: number }
export interface InventoryRecipeRecord { skuId: string; productName: string; skuName: string; version: number; entries: InventoryRecipeEntry[] }
export interface InventoryRecipePage { items: InventoryRecipeRecord[]; total: number; page: number; pageSize: number }
export interface SaveInventoryRecipeRequest { expectedVersion: number; entries: { itemId: string; quantity: number }[] }

export type InventoryAlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export interface InventoryAlertRecord {
  id: string; storeId: string; itemId: string; name: string; code: string; unit: string;
  status: InventoryAlertStatus; severity: 'LOW' | 'OUT'; version: number;
  availableAtTrigger: number; thresholdAtTrigger: number; availableLatest: number; thresholdLatest: number;
  detectedAt: string; updatedAt: string; acknowledgedAt: string | null; acknowledgedBy: string | null; note: string | null; resolvedAt: string | null;
}
export interface InventoryAlertPage {
  items: InventoryAlertRecord[]; total: number; page: number; pageSize: number;
  summary: { open: number; acknowledged: number; out: number };
}
export interface AcknowledgeInventoryAlertRequest { expectedVersion: number; note: string }
