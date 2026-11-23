import type { AuthenticatedUser, CustomerProfile } from '@lingdian/contracts'

export type CustomerPresentation = {
  isSignedIn: boolean
  displayName: string
  secondaryText: string
}

export function buildCustomerPresentation(user: AuthenticatedUser | undefined, profile?: Pick<CustomerProfile, 'nickname'>): CustomerPresentation {
  if (!user) {
    return {
      isSignedIn: false,
      displayName: '登录 / 注册',
      secondaryText: '登录后查看订单',
    }
  }

  return {
    isSignedIn: true,
    displayName: profile?.nickname?.trim() || `用户 ${user.userId.slice(-6)}`,
    secondaryText: '账号已登录',
  }
}
