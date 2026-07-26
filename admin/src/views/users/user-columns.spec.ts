import { describe, expect, it } from 'vitest'
import { DICTIONARY_CODES } from '../../dictionaries'
import { createUserColumns } from './user-columns'

describe('user management columns', () => {
  it('defines reusable search fields, slots, and a fixed action column', async () => {
    const columns = createUserColumns([{ id: 'store-1', name: '中心店' }])
    const searchColumns = columns
      .filter((column) => column.isSearch)
      .sort((left, right) => (left.searchOrder ?? 0) - (right.searchOrder ?? 0))

    expect(searchColumns.map((column) => column.queryKey)).toEqual(['keyword', 'role', 'status', 'storeId'])
    expect(searchColumns.find((column) => column.queryKey === 'role')?.dictionaryCode).toBe(DICTIONARY_CODES.userRole)
    expect(searchColumns.find((column) => column.queryKey === 'status')?.dictionaryCode).toBe(DICTIONARY_CODES.userStatus)
    expect(await Promise.resolve(searchColumns.find((column) => column.queryKey === 'storeId')?.options)).toEqual([
      { value: 'store-1', labelKey: 'store.store-1', fallbackLabel: '中心店' },
    ])
    expect(columns.find((column) => column.key === 'identity')?.slot).toBe('identity')
    expect(columns.find((column) => column.key === 'roles')?.slot).toBe('roles')
    expect(columns.at(-1)).toMatchObject({ key: 'actions', fixed: 'right', slot: 'actions' })
  })
})
