import { describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '@lingdian/contracts'
import { buildCustomerPresentation } from './customer-presentation'

describe('customer presentation', () => {
  it('shows an explicit login state without fabricated assets for a guest', () => {
    expect(buildCustomerPresentation(undefined)).toEqual({
      isSignedIn: false,
      displayName: '登录 / 注册',
      secondaryText: '登录后查看会员权益',
      membershipText: '游客',
      pointsText: '—',
      couponText: '—',
      balanceText: '—',
    })
  })

  it('derives the signed-in label from the real session identifier', () => {
    const user: AuthenticatedUser = {
      userId: 'customer-abc123',
      sessionId: 'session-1',
      audience: 'user-api',
      roles: ['USER'],
    }

    expect(buildCustomerPresentation(user)).toEqual({
      isSignedIn: true,
      displayName: '用户 abc123',
      secondaryText: '账号已登录',
      membershipText: '已登录用户',
      pointsText: '—',
      couponText: '—',
      balanceText: '—',
    })
  })

  it('prefers a saved customer nickname over the generated user label', () => {
    const user: AuthenticatedUser = {
      userId: 'customer-abc123', sessionId: 'session-1', audience: 'user-api', roles: ['USER'],
    }

    expect(buildCustomerPresentation(user, { nickname: '零点用户', avatar_data_url: null }).displayName).toBe('零点用户')
  })
})
