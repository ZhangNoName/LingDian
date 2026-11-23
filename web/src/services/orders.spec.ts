import { describe, expect, it } from 'vitest'
import { buildOrderQuery } from './orders'

describe('merchant order query', () => {
  it('serializes pagination and trimmed filters', () => {
    const query = buildOrderQuery({
      page: 2,
      pageSize: 50,
      keyword: '  LD-100  ',
      status: 'PAID',
      orderType: 'PICKUP',
      paymentChannel: 'WECHAT',
      dateRange: [],
    })

    expect(query).toBe('page=2&pageSize=50&keyword=LD-100&status=PAID&orderType=PICKUP&paymentChannel=WECHAT')
  })

  it('omits pagination from the summary request query', () => {
    const query = buildOrderQuery({
      page: 9,
      pageSize: 100,
      keyword: '',
      status: 'REFUNDING',
      orderType: '',
      paymentChannel: '',
      dateRange: [],
    }, false)

    expect(query).toBe('status=REFUNDING')
  })
})

describe('order period boundary compatibility', () => {
  it('uses an exclusive UTC end for shareable order ranges', () => {
    const params = new URLSearchParams(buildOrderQuery({ page: 1, pageSize: 20, keyword: '', status: 'PAID', orderType: '', paymentChannel: '', dateRange: [], startAt: '2026-11-01T00:00:00Z', endAt: '2026-11-02T00:00:00Z' }))
    expect(params.get('endBefore')).toBe('2026-11-02T00:00:00Z')
    expect(params.has('endDate')).toBe(false)
  })
})
