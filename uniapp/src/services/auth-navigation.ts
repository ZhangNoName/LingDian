import { customerAuth } from './auth'

const REGISTERED_CUSTOMER_PATHS = new Set([
  '/pages/home/home',
  '/pages/order/order',
  '/pages/spec/spec',
  '/pages/checkout/checkout',
  '/pages/his/his',
  '/pages/order-detail/order-detail',
  '/pages/address/address',
  '/pages/user/user',
])

const PROTECTED_CUSTOMER_PATHS = new Set([
  '/pages/checkout/checkout',
  '/pages/his/his',
  '/pages/order-detail/order-detail',
  '/pages/address/address',
  '/pages/user/user',
])

type CustomerAuthGuard = Pick<typeof customerAuth, 'isSignedIn' | 'refresh'>

function pathOnly(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? ''
}

function decodeReturnTarget(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function isProtectedCustomerRoute(url: string): boolean {
  return PROTECTED_CUSTOMER_PATHS.has(pathOnly(url))
}

export function isSafeCustomerReturnUrl(url: string): boolean {
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\')) return false
  return REGISTERED_CUSTOMER_PATHS.has(pathOnly(url))
}

export function resolveCustomerReturnUrl(value: string | undefined): string {
  const candidate = value ? decodeReturnTarget(value) : ''
  return isSafeCustomerReturnUrl(candidate) ? candidate : '/pages/user/user'
}

export function buildCustomerLoginUrl(returnUrl: string): string {
  const safeReturnUrl = isSafeCustomerReturnUrl(returnUrl) ? returnUrl : '/pages/user/user'
  return `/pages/auth/login?redirect=${encodeURIComponent(safeReturnUrl)}`
}

export async function requireCustomerAuth(
  returnUrl: string,
  auth: CustomerAuthGuard = customerAuth,
): Promise<boolean> {
  if (auth.isSignedIn() || (await auth.refresh())) return true
  uni.navigateTo({ url: buildCustomerLoginUrl(returnUrl) })
  return false
}
