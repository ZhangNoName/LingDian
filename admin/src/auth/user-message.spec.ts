import { describe, expect, it } from 'vitest'
import { getAdminAuthMessage } from './user-message'

describe('administrator authentication messages', () => {
  it.each([
    ['Account credentials are invalid.', '账号或密码错误，请重新输入。'],
    ['Please sign in again.', '登录状态已失效，请重新登录。'],
    ['Network request failed.', '网络连接异常，请检查网络后重试。'],
  ])('maps %s to an actionable Chinese message', (source, expected) => {
    expect(getAdminAuthMessage(new Error(source))).toBe(expected)
  })

  it('keeps the existing API-unavailable guidance', () => {
    const source = '后端服务暂时不可用，请确认 API 已在 9000 端口启动'
    expect(getAdminAuthMessage(new Error(source))).toBe(source)
  })

  it('uses a safe fallback for unknown details', () => {
    expect(getAdminAuthMessage(new Error('internal database error'))).toBe('登录失败，请稍后重试。')
  })
})
