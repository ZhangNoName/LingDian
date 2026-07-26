import type { Component } from 'vue'
import type { DictionaryOption, DictionarySource, DictionaryValue } from '../../dictionaries'

export type SchemaSearchType = 'input' | 'select' | 'date' | 'dateRange'

export type SchemaColumn<Row> = {
  key?: string
  dataIndex?: string
  queryKey?: string
  label: string
  width?: string | number
  minWidth?: string | number
  fixed?: boolean | 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  formatter?: (value: unknown, row: Row, index: number) => unknown
  /** @deprecated Use formatter. */
  formater?: (value: unknown, row: Row, index: number) => unknown
  slot?: string
  showOverflowTooltip?: boolean
  dictionaryCode?: string
  isSearch?: boolean
  searchType?: SchemaSearchType
  searchOrder?: number
  placeholder?: string
  clearable?: boolean
  filterable?: boolean
  options?: DictionarySource
  resetValue?: unknown
  hidden?: boolean
}

export type SchemaAction<Row> = {
  key: string
  label: string
  icon: Component
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  disabled?: boolean | ((row: Row) => boolean)
  hidden?: boolean | ((row: Row) => boolean)
  onClick: (row: Row) => void | Promise<void>
}

export type SchemaPagination = {
  page: number
  pageSize: number
  total: number
  pageSizes?: number[]
}

export type ResolvedSearchOption = DictionaryOption
export type QueryRecord = Record<string, unknown>
export type CellValue = DictionaryValue | null | undefined | object
