import { describe, expect, it } from 'vitest'
import { createUserColumns } from './user-columns'

describe('account management columns', () => {
  it('shows only category-relevant fields while retaining common filters and fixed actions', async () => {
    const stores = [{ id: 'store-1', name: '中心店' }]
    const admin = createUserColumns('ADMINISTRATOR', stores)
    const merchant = createUserColumns('MERCHANT', stores)
    const user = createUserColumns('USER', stores)

    expect(admin.filter((column) => column.isSearch).map((column) => column.queryKey)).toEqual(['keyword', 'status'])
    expect(admin.some((column) => column.key === 'roles')).toBe(true)
    expect(admin.some((column) => column.key === 'stores')).toBe(false)
    expect(merchant.some((column) => column.key === 'roles')).toBe(false)
    expect(merchant.filter((column) => column.isSearch).map((column) => column.queryKey)).toEqual(['keyword', 'storeId', 'status'])
    expect(await Promise.resolve(merchant.find((column) => column.key === 'stores')?.options)).toEqual([
      { value: 'store-1', labelKey: 'store.store-1', fallbackLabel: '中心店' },
    ])
    expect(user.some((column) => column.key === 'roles' || column.key === 'stores')).toBe(false)
    expect(user.at(-1)).toMatchObject({ key: 'actions', fixed: 'right', slot: 'actions' })
  })
})
