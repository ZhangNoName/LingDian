import { describe, expect, it } from 'vitest'
import { buildSystemLogPath } from './api'

describe('system log query', () => {
  it('serializes filters and offset pagination', () => {
    expect(buildSystemLogPath({ source: 'ADMIN_WEB', level: 'ERROR', page: 2, pageSize: 20 }))
      .toBe('/admin/system-logs?page=2&pageSize=20&source=ADMIN_WEB&level=ERROR')
  })
})
