import type { AuthenticatedUser } from '@lingdian/contracts'

export type CustomerPresentation = {
  isSignedIn: boolean
  displayName: string
  secondaryText: string
  membershipText: string
  pointsText: string
  couponText: string
  balanceText: string
}

export function buildCustomerPresentation(user: AuthenticatedUser | undefined): CustomerPresentation {
  if (!user) {
    return {
      isSignedIn: false,
      displayName: '登录 / 注册',
      secondaryText: '登录后查看会员权益',
      membershipText: '游客',
      pointsText: '—',
      couponText: '—',
      balanceText: '—',
    }
  }

  return {
    isSignedIn: true,
    displayName: `用户 ${user.userId.slice(-6)}`,
    secondaryText: '账号已登录',
    membershipText: '已登录用户',
    pointsText: '—',
    couponText: '—',
    balanceText: '—',
  }
}
