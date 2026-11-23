export type StocktakeStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export interface StocktakeLine {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  expectedQuantity: number;
  reservedQuantity: number;
  itemVersion: number;
  capturedAt: string;
  countedQuantity: number | null;
  currentQuantity: number;
  currentReserved: number;
  currentVersion: number;
}
export interface StocktakeRecord {
  id: string;
  storeId: string;
  title: string;
  note: string;
  status: StocktakeStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedBy: string | null;
  postedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  lines: StocktakeLine[];
}
export interface StocktakePage {
  items: StocktakeRecord[];
  total: number;
  page: number;
  pageSize: number;
}
export interface CreateStocktake {
  requestId: string;
  title: string;
  note: string;
  itemIds: string[];
}
export interface SaveStocktake {
  expectedVersion: number;
  lines: { lineId: string; countedQuantity: number | null }[];
}
