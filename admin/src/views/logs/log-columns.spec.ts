import { describe, expect, it } from 'vitest'
import { DICTIONARY_CODES } from '../../dictionaries'
import { createLogColumns } from './log-columns'

describe('system log columns', () => {
  it('uses global dictionaries, overflow protection, and a fixed detail action', () => {
    const columns = createLogColumns()

    expect(columns.find((column) => column.dataIndex === 'level')).toMatchObject({
      isSearch: true,
      searchType: 'select',
      dictionaryCode: DICTIONARY_CODES.logLevel,
      slot: 'level',
    })
    expect(columns.find((column) => column.dataIndex === 'source')?.dictionaryCode).toBe(DICTIONARY_CODES.logSource)
    expect(columns.find((column) => column.dataIndex === 'message')?.showOverflowTooltip).toBe(true)
    expect(columns.at(-1)).toMatchObject({ key: 'actions', fixed: 'right', slot: 'actions' })
  })
})
