import { describe, expect, it } from 'vitest'
import { getCustomerAuthMessage } from './auth-message'

describe('customer authentication messages', () => {
  it.each([
    ['Verification code is invalid.', '验证码错误或已失效，请重新获取。'],
    ['Network request failed.', '网络连接异常，请检查网络后重试。'],
    ['This platform does not support the selected sign-in provider.', '当前环境暂不支持该登录方式。'],
  ])('maps %s to a useful Chinese message', (source, expected) => {
    expect(getCustomerAuthMessage(new Error(source))).toBe(expected)
  })

  it('uses a safe fallback for unknown details', () => {
    expect(getCustomerAuthMessage(new Error('internal auth error'))).toBe('登录失败，请稍后重试。')
  })
})
