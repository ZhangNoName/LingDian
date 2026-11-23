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

  it('maps a known Chinese code error to a localized safe message', () => {
    expect(getMerchantAuthMessage(new Error('验证码已过期，请重新获取'))).toBe('验证码不正确或已过期，请重新获取。')
  })

  it('does not expose an unknown backend error', () => {
    expect(getMerchantAuthMessage(new Error('database connection refused'))).toBe('登录失败，请稍后重试。')
  })
})

it('localizes known auth failures in English and hides unknown messages in either language',()=>{
 expect(getMerchantAuthMessage(new Error('Verification code is invalid or expired.'),'en-US')).toBe('The code is invalid or expired. Request a new one.')
 expect(getMerchantAuthMessage(new Error('数据库连接含内部参数'),'en-US')).toBe('Could not sign in. Please try again.')
 expect(getMerchantAuthMessage(new Error('Too many verification codes requested.'),'en-US')).toBe('Too many code requests. Please try again later.')
})
