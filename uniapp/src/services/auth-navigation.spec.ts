import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCustomerLoginUrl,
  isProtectedCustomerRoute,
  isSafeCustomerReturnUrl,
  requireCustomerAuth,
  resolveCustomerReturnUrl,
} from './auth-navigation'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('customer authentication navigation', () => {
  it('allows guest browsing but identifies account and order routes as protected', () => {
    expect(isProtectedCustomerRoute('/pages/home/home')).toBe(false)
    expect(isProtectedCustomerRoute('/pages/order/order')).toBe(false)
    expect(isProtectedCustomerRoute('/pages/checkout/checkout')).toBe(true)
    expect(isProtectedCustomerRoute('/pages/his/his')).toBe(true)
    expect(isProtectedCustomerRoute('/pages/user/user')).toBe(true)
    expect(isProtectedCustomerRoute('/pages/order-detail/order-detail?id=order-1')).toBe(true)
  })

  it('encodes a safe return target in the login URL', () => {
    expect(buildCustomerLoginUrl('/pages/checkout/checkout?store=store-1')).toBe(
      '/pages/auth/login?redirect=%2Fpages%2Fcheckout%2Fcheckout%3Fstore%3Dstore-1',
    )
  })

  it('accepts only registered internal page targets', () => {
    expect(isSafeCustomerReturnUrl('/pages/his/his')).toBe(true)
    expect(isSafeCustomerReturnUrl('/pages/order-detail/order-detail?id=1')).toBe(true)
    expect(isSafeCustomerReturnUrl('//attacker.example')).toBe(false)
    expect(isSafeCustomerReturnUrl('https://attacker.example')).toBe(false)
    expect(isSafeCustomerReturnUrl('/pages/not-registered/index')).toBe(false)
  })

  it('falls back to profile for an unsafe login return target', () => {
    expect(resolveCustomerReturnUrl('https%3A%2F%2Fattacker.example')).toBe('/pages/user/user')
  })

  it('redirects a guest to login and preserves the requested destination', async () => {
    const navigateTo = vi.fn()
    Object.assign(uni, { navigateTo })
    const auth = {
      isSignedIn: vi.fn(() => false),
      refresh: vi.fn(async () => false),
    }

    await expect(requireCustomerAuth('/pages/his/his', auth)).resolves.toBe(false)
    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/auth/login?redirect=%2Fpages%2Fhis%2Fhis',
    })
  })

  it('allows a restored session without opening login', async () => {
    const navigateTo = vi.fn()
    Object.assign(uni, { navigateTo })
    const auth = {
      isSignedIn: vi.fn(() => false),
      refresh: vi.fn(async () => true),
    }

    await expect(requireCustomerAuth('/pages/user/user', auth)).resolves.toBe(true)
    expect(navigateTo).not.toHaveBeenCalled()
  })
})
