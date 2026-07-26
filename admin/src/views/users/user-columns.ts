import type { PlatformAccountType, PlatformUserSummary } from '@lingdian/contracts'
import type { SchemaColumn } from '../../components/schema-table'
import { DICTIONARY_CODES } from '../../dictionaries'

export type StoreOption = { id: string; name: string }

export function createUserColumns(accountType: PlatformAccountType, stores: readonly StoreOption[]): SchemaColumn<PlatformUserSummary>[] {
  const columns: SchemaColumn<PlatformUserSummary>[] = [
    {
      key: 'identity', label: '用户', slot: 'identity', minWidth: 210,
      isSearch: true, queryKey: 'keyword', placeholder: '昵称 / 账号 / 手机号', searchOrder: 1,
    },
    { dataIndex: 'phone', label: '手机号', minWidth: 145 },
  ]

  if (accountType === 'ADMINISTRATOR') {
    columns.push({ key: 'roles', dataIndex: 'roles', label: '角色', slot: 'roles', minWidth: 190 })
  }
  if (accountType === 'MERCHANT') {
    columns.push({
      key: 'stores', dataIndex: 'storeIds', label: '门店范围', minWidth: 130,
      formatter: (_value, row) => row.storeIds.length ? `${row.storeIds.length} 个门店` : '—',
      isSearch: true, queryKey: 'storeId', searchType: 'select', filterable: true, searchOrder: 2,
      options: stores.map((store) => ({ value: store.id, labelKey: `store.${store.id}`, fallbackLabel: store.name })),
    })
  }

  columns.push(
    {
      dataIndex: 'status', label: '状态', slot: 'status', width: 100,
      isSearch: true, queryKey: 'status', searchType: 'select', dictionaryCode: DICTIONARY_CODES.userStatus, searchOrder: 3,
    },
    {
      dataIndex: 'lastLoginAt', label: '最近登录', minWidth: 180,
      formatter: (value) => value ? new Date(String(value)).toLocaleString() : '从未登录',
    },
    { key: 'actions', label: '操作', slot: 'actions', fixed: 'right', width: 150, align: 'center' },
  )
  return columns
}
