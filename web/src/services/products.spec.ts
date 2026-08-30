import { describe, expect, it } from 'vitest'
import { buildProductQuery } from './products'

describe('merchant product query', () => {
  it('serializes pagination and normalized filters', () => {
    expect(buildProductQuery({
      page: 3,
      pageSize: 50,
      keyword: '  鸡腿堡  ',
      type: 'SINGLE',
    })).toBe('page=3&pageSize=50&keyword=%E9%B8%A1%E8%85%BF%E5%A0%A1&type=SINGLE')
  })

  it('omits empty optional filters', () => {
    expect(buildProductQuery({ page: 1, pageSize: 20, keyword: ' ', type: '' }))
      .toBe('page=1&pageSize=20')
  })
})
