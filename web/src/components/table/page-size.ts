export const tablePageSizes = [10, 20, 50] as const
export const extendedTablePageSizes = [...tablePageSizes, 100] as const

export function parseTablePageSize(value: unknown, fallback = 20, options: readonly number[] = tablePageSizes) {
  const size = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  return typeof size === 'number' && options.includes(size) ? size : fallback
}
