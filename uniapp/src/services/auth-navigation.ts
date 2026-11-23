import { customerAuth } from './auth'
import { currentCustomerPage, customerLoginForPage, openCustomerLogin } from './customer-login'

const PROTECTED_CUSTOMER_PATHS = new Set([
  '/pages/checkout/checkout',
  '/pages/his/his',
  '/pages/order-detail/order-detail',
  '/pages/address/address',
  '/pages/user/user',
])

type CustomerAuthGuard = Pick<typeof customerAuth, 'isSignedIn' | 'refresh' | 'getSessionRecoveryError'>
const latestAuthAttempt = new WeakMap<NonNullable<ReturnType<typeof currentCustomerPage>>, symbol>()

function pathOnly(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? ''
}

export function isProtectedCustomerRoute(url: string): boolean {
  return PROTECTED_CUSTOMER_PATHS.has(pathOnly(url))
}

export async function requireCustomerAuth(auth: CustomerAuthGuard = customerAuth): Promise<boolean> {
  const page = currentCustomerPage()
  if (!page) return false
  const attempt = Symbol()
  latestAuthAttempt.set(page, attempt)
  const isCurrent = () => page === currentCustomerPage() && latestAuthAttempt.get(page) === attempt
  const pending = customerLoginForPage(page)
  if (pending) return await pending.result && isCurrent()
  if (auth.isSignedIn()) return true
  const restored = await auth.refresh()
  if (!isCurrent()) return false
  if (restored) return true
  const recoveryError = auth.getSessionRecoveryError()
  if (recoveryError) {
    uni.showToast({ title: recoveryError, icon: 'none' })
    return false
  }
  return await openCustomerLogin(page) && isCurrent()
}

export function navigateBackOrRedirect(fallbackUrl: string): void {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else uni.redirectTo({ url: fallbackUrl })
}
