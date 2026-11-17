/** Keep stock-list context when navigating its history and reports. It never changes API scope. */
export function inventoryLifecycleQuery(query: Record<string, unknown>): Record<string, string> {
  return query.inventoryLifecycle === 'ARCHIVED' || query.inventoryLifecycle === 'ALL'
    ? { inventoryLifecycle: query.inventoryLifecycle }
    : {}
}
