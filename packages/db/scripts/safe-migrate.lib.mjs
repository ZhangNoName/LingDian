export const FRESH_BASELINE_MIGRATION = '20260710_fresh_business_baseline';

export const FRESH_BASELINE_COLUMNS = Object.freeze({
  stores: ['id', 'code', 'name', 'contactName', 'contactPhone', 'address', 'businessHours', 'status', 'dineInEnabled', 'takeoutEnabled', 'pickupEnabled', 'createdAt', 'updatedAt'],
  categories: ['id', 'storeId', 'name', 'sortOrder', 'isVisible', 'createdAt', 'updatedAt'],
  products: ['id', 'storeId', 'categoryId', 'name', 'description', 'imageUrl', 'type', 'price', 'status', 'isFeatured', 'stock', 'createdAt', 'updatedAt'],
  product_skus: ['id', 'productId', 'skuName', 'price', 'stockCount', 'isDefault', 'isActive', 'createdAt', 'updatedAt'],
  selection_groups: ['id', 'storeId', 'name', 'groupType', 'selectionMode', 'minSelect', 'maxSelect', 'isRequired', 'isActive', 'sortOrder', 'description', 'createdAt', 'updatedAt'],
  selection_options: ['id', 'groupId', 'name', 'optionType', 'priceDelta', 'stockDelta', 'isDefault', 'isActive', 'sortOrder', 'referencedSkuId', 'extraData', 'createdAt', 'updatedAt'],
  product_selection_groups: ['id', 'productId', 'variantId', 'groupId', 'scope', 'sortOrder', 'isEnabled', 'createdAt', 'updatedAt'],
  orders: ['id', 'orderNo', 'storeId', 'customerName', 'customerMobile', 'orderType', 'status', 'paymentChannel', 'totalAmount', 'payableAmount', 'remark', 'isDeleted', 'deletedAt', 'paidAt', 'cancelledAt', 'refundingAt', 'refundedAt', 'createdAt', 'updatedAt'],
  order_status_logs: ['id', 'orderId', 'fromStatus', 'toStatus', 'operatorName', 'note', 'extra', 'createdAt'],
  order_items: ['id', 'orderId', 'productId', 'skuId', 'productName', 'skuName', 'unitPrice', 'quantity', 'subtotal', 'remark', 'createdAt'],
  order_item_selections: ['id', 'orderItemId', 'selectionGroupId', 'selectionOptionId', 'groupNameSnapshot', 'optionNameSnapshot', 'optionType', 'referencedSkuId', 'referencedSkuName', 'priceDelta', 'quantity', 'createdAt'],
});

export const FRESH_BASELINE_TABLES = Object.freeze(Object.keys(FRESH_BASELINE_COLUMNS));

export function planFreshBaseline({ applicationTables, columnsByTable, primaryKeyColumnsByTable, baselineRecords }) {
  const applicationTableSet = new Set(applicationTables);
  const presentCoreTables = FRESH_BASELINE_TABLES.filter((table) => applicationTableSet.has(table));
  const missingCoreTables = FRESH_BASELINE_TABLES.filter((table) => !applicationTableSet.has(table));
  const baselineApplied = readAppliedState(baselineRecords);

  if (presentCoreTables.length === 0) {
    if (baselineApplied) {
      throw new Error('Fresh baseline is recorded as applied, but every baseline business table is missing. Refusing migration.');
    }
    if (applicationTables.length > 0 || baselineRecords.length > 0) {
      throw new Error('Database is not empty and has no baseline business tables. Refusing to treat a partial or unrelated schema as a fresh database.');
    }
    return { action: 'fresh' };
  }

  if (missingCoreTables.length > 0) {
    throw new Error(`Partial legacy business schema detected; missing baseline tables: ${missingCoreTables.join(', ')}. Refusing migration.`);
  }

  assertCompleteLegacySignature(columnsByTable, primaryKeyColumnsByTable);
  return baselineApplied ? { action: 'ready' } : { action: 'resolve' };
}

function readAppliedState(records) {
  if (records.length === 0) return false;
  const applied = records.some((record) => record.finishedAt && !record.rolledBackAt);
  if (!applied) {
    throw new Error('Fresh baseline has an unfinished or rolled-back migration record. Resolve that failed state explicitly before retrying.');
  }
  return true;
}

function assertCompleteLegacySignature(columnsByTable, primaryKeyColumnsByTable) {
  for (const [table, requiredColumns] of Object.entries(FRESH_BASELINE_COLUMNS)) {
    const actualColumns = new Set(columnsByTable[table] ?? []);
    const missingColumns = requiredColumns.filter((column) => !actualColumns.has(column));
    if (missingColumns.length > 0) {
      throw new Error(`Legacy table ${table} is incompatible with the fresh baseline; missing columns: ${missingColumns.join(', ')}.`);
    }
    const primaryKeyColumns = primaryKeyColumnsByTable[table] ?? [];
    if (primaryKeyColumns.length !== 1 || primaryKeyColumns[0] !== 'id') {
      throw new Error(`Legacy table ${table} does not have the required single-column id primary key. Refusing to resolve the fresh baseline.`);
    }
  }
}
