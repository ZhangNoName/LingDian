import { dictionaryRegistry, type DictionaryRegistry } from '../../dictionaries'
import type { QueryRecord, SchemaColumn } from './types'

export function columnKey<Row>(column: SchemaColumn<Row>): string {
  return column.key ?? column.dataIndex ?? column.queryKey ?? column.label
}

export function getByDataIndex(value: unknown, dataIndex?: string): unknown {
  if (!dataIndex) return undefined
  return dataIndex.split('.').reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, value)
}

export async function formatCellValue<Row>(
  column: SchemaColumn<Row>,
  row: Row,
  registry: DictionaryRegistry = dictionaryRegistry,
  index = 0,
): Promise<string> {
  const value = getByDataIndex(row, column.dataIndex)
  const formatter = column.formatter ?? column.formater
  if (formatter) return displayValue(formatter(value, row, index))
  if (column.dictionaryCode && isDictionaryValue(value)) {
    return registry.getLabel(column.dictionaryCode, value)
  }
  return displayValue(value)
}

export function createResetPatch<Row>(columns: readonly SchemaColumn<Row>[]): QueryRecord {
  return Object.fromEntries(
    columns
      .filter((column) => column.isSearch)
      .map((column) => [column.queryKey ?? column.dataIndex ?? columnKey(column), column.resetValue]),
  )
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function isDictionaryValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}
