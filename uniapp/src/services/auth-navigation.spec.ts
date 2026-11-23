import { afterEach, describe, expect, it, vi } from 'vitest'
import { isProtectedCustomerRoute, requireCustomerAuth } from './auth-navigation'
import { currentCustomerPage, customerLoginForPage } from './customer-login'

afterEach(() => {
  customerLoginForPage(currentCustomerPage())?.finish(false)
  vi.restoreAllMocks()
})

function guestAuth() {
  return {
    isSignedIn: vi.fn(() => false),
    refresh: vi.fn(async () => false),
    getSessionRecoveryError: vi.fn<[], string | undefined>(() => undefined),
  }
}

function waitForDrawer() {
  return vi.waitFor(() => {
    const drawer = customerLoginForPage(currentCustomerPage())
    if (!drawer) throw new Error('Expected a login drawer on the current page.')
    return drawer
  })
}

describe('customer authentication navigation', () => {
  it('allows guest browsing but identifies account and order routes as protected', () => {
    expect(isProtectedCustomerRoute('/pages/home/home')).toBe(false)
    expect(isProtectedCustomerRoute('/pages/order/order')).toBe(false)
    expect(isProtectedCustomerRoute('/pages/checkout/checkout')).toBe(true)
    expect(isProtectedCustomerRoute('/pages/his/his')).toBe(true)
    expect(isProtectedCustomerRoute('/pages/address/address')).toBe(true)
    expect(isProtectedCustomerRoute('/pages/user/user')).toBe(true)
    expect(isProtectedCustomerRoute('/pages/order-detail/order-detail?id=order-1')).toBe(true)
  })

  it.each([true, false])('resumes the guarded action only if the drawer completes with %s', async (signedIn) => {
    const navigateTo = vi.fn()
    Object.assign(uni, { navigateTo })
    const confirmed = requireCustomerAuth(guestAuth())
    const drawer = await waitForDrawer()
    drawer.finish(signedIn)

    await expect(confirmed).resolves.toBe(signedIn)
    expect(navigateTo).not.toHaveBeenCalled()
    expect(customerLoginForPage(currentCustomerPage())).toBeUndefined()
  })

  it('shares one drawer and only resumes the latest action on the current page', async () => {
    const previous = requireCustomerAuth(guestAuth())
    const drawer = await waitForDrawer()
    const latest = requireCustomerAuth(guestAuth())
    expect(customerLoginForPage(currentCustomerPage())).toBe(drawer)

    drawer.finish(true)

    await expect(previous).resolves.toBe(false)
    await expect(latest).resolves.toBe(true)
  })

  it('allows a restored session without opening the drawer', async () => {
    const auth = guestAuth()
    auth.refresh.mockResolvedValue(true)

    await expect(requireCustomerAuth(auth)).resolves.toBe(true)
    expect(customerLoginForPage(currentCustomerPage())).toBeUndefined()
  })

  it('keeps the customer on the current page when session recovery can be retried', async () => {
    const showToast = vi.fn()
    Object.assign(uni, { showToast })
    const auth = guestAuth()
    auth.getSessionRecoveryError.mockReturnValue('暂时无法恢复登录，请稍后重试。')

    await expect(requireCustomerAuth(auth)).resolves.toBe(false)
    expect(customerLoginForPage(currentCustomerPage())).toBeUndefined()
    expect(showToast).toHaveBeenCalledWith({ title: '暂时无法恢复登录，请稍后重试。', icon: 'none' })
  })
})
