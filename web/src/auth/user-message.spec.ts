import { describe, expect, it } from 'vitest'
import { getMerchantAuthMessage } from './user-message'

describe('merchant authentication messages', () => {
  it.each([
    ['Account credentials are invalid.', '账号或密码错误，请重新输入。'],
    ['Merchant session required.', '当前账号没有商家端访问权限。'],
    ['Please sign in again.', '登录状态已失效，请重新登录。'],
    ['Failed to fetch', '网络连接异常，请检查网络后重试。'],
  ])('maps %s to an actionable Chinese message', (source, expected) => {
    expect(getMerchantAuthMessage(new Error(source))).toBe(expected)
  })

  it('keeps an existing Chinese service message', () => {
    expect(getMerchantAuthMessage(new Error('验证码已过期，请重新获取'))).toBe('验证码已过期，请重新获取')
  })

  it('does not expose an unknown backend error', () => {
    expect(getMerchantAuthMessage(new Error('database connection refused'))).toBe('登录失败，请稍后重试。')
  })
})
