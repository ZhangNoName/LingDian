import type { MerchantCategoryRecord, OnlinePaymentChannel, OrderStatus, OrderType, PaymentProvider, SupplierRecord } from '@lingdian/contracts';
import type { Workspace } from './auth-manager';
import type { DateRange } from './format';

export type OrderListSelection = { dates: DateRange; status?: OrderStatus; orderType?: OrderType };
export type PendingPurchaseItem = { id: string; label: string };
export type PurchaseSuggestion = { itemId: string; itemName: string; unit: string; recommendedQuantity: number };
export type PaymentAccount = {
  id: string; storeId: string; provider: PaymentProvider; channel: OnlinePaymentChannel;
  externalAccountId: string; connectorConfigKey: string; status: 'ACTIVE' | 'DISABLED';
};

type NamedCollection<Names extends string> = { [Name in Names]: { type: 'collection'; name: Name } }[Names];

type InventoryListName = 'inventory' | 'alerts' | 'recipes' | 'suppliers' | 'stocktakes' | 'movements';
type InventoryReportName = 'report' | 'replenishment' | 'receiptReport';
export type InventoryListRoute =
  | NamedCollection<InventoryListName | InventoryReportName>
  | { type: 'collection'; name: 'purchases'; pendingItem?: PendingPurchaseItem };

export type CollectionRoute =
  | InventoryListRoute
  | { type: 'collection'; name: 'orders'; orders?: OrderListSelection }
  | NamedCollection<'products' | 'categories' | 'integrations' | 'holds' | 'logs' | 'accounts' | 'payments'>;

export type InventoryRecordName = 'inventory' | 'alerts' | 'recipes' | 'purchases' | 'stocktakes' | 'trend' | 'usage' | 'changes' | 'receipts';
export type MaterialAction = 'adjust' | 'rename' | 'lifecycle';
export type PurchaseAction = 'receive' | 'cancel';
export type StocktakeAction = 'counts' | 'recount' | 'post' | 'cancel';
export type SkuAction = 'sku-price' | 'sku-stock';

export type InventoryFormRoute = { type: 'form' } & (
  | { name: 'inventory' | 'suppliers' | 'stocktakes'; action: 'create' }
  | { name: 'inventory'; action: MaterialAction; id: string }
  | { name: 'suppliers'; action: 'edit'; id: string; data: SupplierRecord }
  | { name: 'purchases'; action: 'create'; data?: PurchaseSuggestion }
  | { name: 'purchases'; action: PurchaseAction; id: string }
  | { name: 'stocktakes'; action: StocktakeAction; id: string }
  | { name: 'alerts'; action: 'acknowledge'; id: string }
  | { name: 'recipes'; action: 'edit'; id: string }
);

export type CatalogFormRoute = { type: 'form' } & (
  | { name: 'products' | 'categories'; action: 'create' }
  | { name: 'categories'; action: 'edit'; id: string; data: MerchantCategoryRecord }
  | { name: 'products'; action: 'edit' | 'config' | 'image' | 'status'; id: string }
  | { name: 'products'; action: SkuAction; id: string; skuId: string }
);

export type AccountFormRoute = { type: 'form'; name: 'accounts' } & (
  | { action: 'create' }
  | { action: 'edit' | 'password' | 'status'; id: string }
);

export type PaymentFormRoute = { type: 'form'; name: 'payments' } & (
  | { action: 'create' }
  | { action: 'edit'; data: PaymentAccount }
);

type FormRoute = CatalogFormRoute | InventoryFormRoute | AccountFormRoute | PaymentFormRoute;

export type CartCheckoutRoute = { type: 'checkout'; storeId: string; menuStoreId?: string; recovery?: never };

export type Route =
  | { type: 'login'; workspace?: undefined; checkout?: CartCheckoutRoute }
  | { type: 'login'; workspace: Workspace; checkout?: never }
  | { type: 'product'; storeId: string; menuStoreId?: string; id: string; editLineId?: string }
  | { type: 'customer-stores'; currentStoreId?: string }
  | CartCheckoutRoute
  | { type: 'checkout'; recovery: true; storeId?: string }
  | { type: 'address-editor'; id?: string }
  | { type: 'addresses' | 'profile' | 'password' | 'store' }
  | { type: 'legal'; document: 'agreement' | 'privacy' }
  | { type: 'order'; id: string }
  | CollectionRoute
  | { type: 'record'; name: InventoryRecordName | 'products' | 'holds' | 'logs' | 'accounts'; id: string }
  | FormRoute;

const collectionTitles: Record<CollectionRoute['name'], string> = {
  orders: '订单管理', payments: '收款账户', products: '商品管理', categories: '菜单分类',
  inventory: '原料库存', movements: '库存流水', alerts: '库存预警', recipes: 'SKU 配方',
  suppliers: '供应商', purchases: '采购单', replenishment: '补货建议', receiptReport: '收货报表',
  report: '库存收支', stocktakes: '库存盘点', holds: '库存占用', integrations: '外部集成',
  logs: '系统日志', accounts: '账号管理',
};

export function collectionTitle(name: CollectionRoute['name']) {
  return collectionTitles[name];
}
