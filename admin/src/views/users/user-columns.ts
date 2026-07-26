import type { PlatformUserSummary } from '@lingdian/contracts'
import type { SchemaColumn } from '../../components/schema-table'
import { DICTIONARY_CODES } from '../../dictionaries'

export type StoreOption = { id: string; name: string }

export function createUserColumns(stores: readonly StoreOption[]): SchemaColumn<PlatformUserSummary>[] {
  return [
    {
      key: 'identity',
      label: '用户',
      slot: 'identity',
      minWidth: 210,
      isSearch: true,
      queryKey: 'keyword',
      placeholder: '昵称 / 账号 / 手机号',
      searchOrder: 1,
    },
    { dataIndex: 'phone', label: '手机号', minWidth: 145 },
    {
      key: 'roles',
      dataIndex: 'roles',
      label: '角色',
      slot: 'roles',
      minWidth: 190,
      isSearch: true,
      queryKey: 'role',
      searchType: 'select',
      dictionaryCode: DICTIONARY_CODES.userRole,
      searchOrder: 2,
    },
    {
      key: 'stores',
      dataIndex: 'storeIds',
      label: '门店范围',
      minWidth: 130,
      formatter: (_value, row) => row.storeIds.length ? `${row.storeIds.length} 个门店` : '—',
      isSearch: true,
      queryKey: 'storeId',
      searchType: 'select',
      filterable: true,
      options: stores.map((store) => ({
        value: store.id,
        labelKey: `store.${store.id}`,
        fallbackLabel: store.name,
      })),
      searchOrder: 4,
    },
    {
      dataIndex: 'status',
      label: '状态',
      slot: 'status',
      width: 100,
      isSearch: true,
      queryKey: 'status',
      searchType: 'select',
      dictionaryCode: DICTIONARY_CODES.userStatus,
      searchOrder: 3,
    },
    {
      dataIndex: 'lastLoginAt',
      label: '最近登录',
      minWidth: 180,
      formatter: (value) => value ? new Date(String(value)).toLocaleString() : '从未登录',
    },
    {
      key: 'actions',
      label: '操作',
      slot: 'actions',
      fixed: 'right',
      width: 150,
      align: 'center',
    },
  ]
}
