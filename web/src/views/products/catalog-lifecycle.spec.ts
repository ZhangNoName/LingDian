import { expect, it } from 'vitest'
import { catalogStatusActions } from './catalog-lifecycle'
it('keeps archived restore explicit and hides actions for unknown catalogue states', () => {
  expect(catalogStatusActions('ARCHIVED')).toEqual([{ status: 'DRAFT', label: 'restore' }])
  expect(catalogStatusActions('DRAFT').map((row) => row.status)).toEqual(['ACTIVE', 'ARCHIVED'])
  expect(catalogStatusActions('ACTIVE').map((row) => row.status)).toEqual(['SOLD_OUT', 'DRAFT', 'ARCHIVED'])
  expect(catalogStatusActions('FUTURE')).toEqual([])
})
