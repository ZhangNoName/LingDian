export function materialId(value: unknown): string {
  return typeof value === 'string' && value.trim().length <= 191 ? value.trim() : ''
}
export function replenishmentState(query: Record<string, unknown>) {
  const itemId = materialId(query.replenishmentItemId)
  return {
    itemId,
    keyword: typeof query.replenishmentKeyword === 'string' ? query.replenishmentKeyword.trim().slice(0, 120) : '',
    subset: typeof query.replenishmentSubset === 'string' && ['NEEDED', 'COVERED', 'ALL'].includes(query.replenishmentSubset)
      ? String(query.replenishmentSubset)
      : itemId
        ? 'ALL'
        : 'NEEDED',
  }
}
export function replenishmentFocus(itemId: string) {
  return {
    view: 'purchases',
    purchaseView: 'replenishment',
    replenishmentItemId: itemId,
    replenishmentKeyword: undefined,
    replenishmentSubset: 'ALL',
    pendingItemId: undefined,
    purchaseId: undefined,
  }
}
