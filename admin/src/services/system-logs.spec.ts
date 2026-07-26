import { describe, expect, it } from 'vitest'
import { buildSystemLogPath } from './api'

describe('system log query', () => {
  it('serializes filters and cursor without dropping the page limit', () => {
    expect(buildSystemLogPath({ source: 'ADMIN_WEB', level: 'ERROR', cursor: 'log 10' }))
      .toBe('/admin/system-logs?limit=50&source=ADMIN_WEB&level=ERROR&cursor=log+10')
  })
})
