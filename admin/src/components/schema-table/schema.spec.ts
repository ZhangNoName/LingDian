import { describe, expect, it } from 'vitest'
import { DictionaryRegistry } from '../../dictionaries/registry'
import { columnKey, createResetPatch, formatCellValue, getByDataIndex } from './schema'
import type { SchemaColumn } from './types'

type Row = { id: string; profile: { name: string }; status: string }

describe('schema table helpers', () => {
  it('normalizes explicit keys and resolves nested data indexes', () => {
    expect(columnKey({ key: 'identity', label: '用户' })).toBe('identity')
    expect(columnKey({ dataIndex: 'profile.name', label: '姓名' })).toBe('profile.name')
    expect(getByDataIndex({ profile: { name: '小零' } }, 'profile.name')).toBe('小零')
    expect(getByDataIndex({ profile: null }, 'profile.name')).toBeUndefined()
  })

  it('prefers formatter over the compatibility formater alias', async () => {
    const row: Row = { id: '1', profile: { name: '小零' }, status: 'ACTIVE' }
    const column: SchemaColumn<Row> = {
      dataIndex: 'status',
      label: '状态',
      formatter: (value) => `new:${value}`,
      formater: (value) => `legacy:${value}`,
    }

    expect(await formatCellValue(column, row)).toBe('new:ACTIVE')
  })

  it('uses a dictionary label before falling back to the raw value', async () => {
    const registry = new DictionaryRegistry()
    registry.register('status', [{ value: 'ACTIVE', labelKey: 'active', fallbackLabel: '正常' }])
    const row: Row = { id: '1', profile: { name: '小零' }, status: 'ACTIVE' }

    expect(await formatCellValue({ dataIndex: 'status', label: '状态', dictionaryCode: 'status' }, row, registry)).toBe('正常')
    expect(await formatCellValue({ dataIndex: 'id', label: '编号' }, row, registry)).toBe('1')
  })

  it('creates a reset patch for searchable fields only', () => {
    const columns: SchemaColumn<Row>[] = [
      { dataIndex: 'profile.name', queryKey: 'keyword', label: '关键词', isSearch: true },
      { dataIndex: 'status', label: '状态', isSearch: true, resetValue: '' },
      { dataIndex: 'id', label: '编号' },
    ]

    expect(createResetPatch(columns)).toEqual({ keyword: undefined, status: '' })
  })
})
