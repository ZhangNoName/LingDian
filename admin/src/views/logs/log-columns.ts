import type { SystemLogRecord } from '@lingdian/contracts'
import type { SchemaColumn } from '../../components/schema-table'
import { DICTIONARY_CODES } from '../../dictionaries'

export function createLogColumns(): SchemaColumn<SystemLogRecord>[] {
  return [
    {
      dataIndex: 'level',
      label: '级别',
      slot: 'level',
      width: 105,
      isSearch: true,
      queryKey: 'level',
      searchType: 'select',
      dictionaryCode: DICTIONARY_CODES.logLevel,
      searchOrder: 2,
    },
    {
      dataIndex: 'source',
      label: '来源',
      width: 120,
      isSearch: true,
      queryKey: 'source',
      searchType: 'select',
      dictionaryCode: DICTIONARY_CODES.logSource,
      searchOrder: 1,
    },
    { dataIndex: 'event', label: '事件', minWidth: 180, showOverflowTooltip: true },
    { dataIndex: 'message', label: '消息', minWidth: 360, showOverflowTooltip: true },
    {
      dataIndex: 'createdAt',
      label: '时间',
      minWidth: 190,
      formatter: (value) => new Date(String(value)).toLocaleString(),
    },
    {
      key: 'actions',
      label: '操作',
      slot: 'actions',
      fixed: 'right',
      width: 82,
      align: 'center',
    },
  ]
}
