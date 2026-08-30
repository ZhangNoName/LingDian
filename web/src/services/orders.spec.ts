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
