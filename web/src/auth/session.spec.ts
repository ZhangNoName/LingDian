import type { AuthenticatedUser } from '@lingdian/contracts'
import { afterEach, expect, it, vi } from 'vitest'
import { merchantSession } from './session'

const merchantUser: AuthenticatedUser = {
  userId: 'merchant-1',
  sessionId: 'session-1',
  audience: 'merchant-api',
  roles: ['MERCHANT'],
}

const adminUser: AuthenticatedUser = {
  userId: 'admin-1',
  sessionId: 'admin-session-1',
  audience: 'admin-api',
  roles: ['ADMIN'],
}

const merchantAudienceWithoutRole: AuthenticatedUser = {
  userId: 'user-1',
  sessionId: 'user-session-1',
  audience: 'merchant-api',
  roles: ['USER'],
}

afterEach(() => {
  vi.unstubAllGlobals()
  merchantSession.clear()
})

it('does not persist the access token in localStorage', async () => {
  merchantSession.acceptLogin({ access_token: 'jwt', expires_in: 900, user: merchantUser })
  expect(localStorage.getItem('access_token')).toBeNull()
})

it('logs a merchant in using merchant-api and receives the browser refresh cookie', async () => {
  const tokens = { access_token: 'new-jwt', expires_in: 900, user: merchantUser }
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ code: 0, msg: 'success', data: tokens }), { status: 201 }),
  )
  vi.stubGlobal('fetch', fetchMock)

  await merchantSession.login('merchant-demo', 'merchant-password-123')

  expect(merchantSession.getAccessToken()).toBe('new-jwt')
  expect(fetchMock).toHaveBeenCalledWith('https://api.zsf.shopping/api/auth/account/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': expect.any(String) },
    credentials: 'include',
    body: JSON.stringify({ username: 'merchant-demo', password: 'merchant-password-123', audience: 'merchant-api' }),
  })
})

it('rejects an account login response that is not a merchant session', async () => {
  const tokens = { access_token: 'admin-jwt', expires_in: 900, user: adminUser }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: 'success', data: tokens }), { status: 201 })))

  await expect(merchantSession.login('merchant-demo', 'merchant-password-123')).rejects.toThrow('Merchant session required.')
  expect(merchantSession.getAccessToken()).toBeUndefined()
})

it('refreshes access with the HTTP-only browser cookie', async () => {
  const tokens = { access_token: 'refreshed-jwt', expires_in: 900, user: merchantUser }
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ code: 0, msg: 'success', data: tokens }), { status: 201 }),
  )
  vi.stubGlobal('fetch', fetchMock)

  await expect(merchantSession.refresh()).resolves.toBe(true)

  expect(merchantSession.getAccessToken()).toBe('refreshed-jwt')
  expect(fetchMock).toHaveBeenCalledWith('https://api.zsf.shopping/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': expect.any(String) },
    credentials: 'include',
    body: '{}',
  })
})

it('shares one refresh request across concurrent callers', async () => {
  const tokens = { access_token: 'shared-jwt', expires_in: 900, user: merchantUser }
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ code: 0, msg: 'success', data: tokens }), { status: 201 }),
  )
  vi.stubGlobal('fetch', fetchMock)

  await expect(Promise.all([merchantSession.refresh(), merchantSession.refresh()])).resolves.toEqual([true, true])
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('clears and rejects a refresh response without the merchant role', async () => {
  const redirectToLogin = vi.fn()
  merchantSession.setUnauthorizedHandler(redirectToLogin)
  const tokens = { access_token: 'user-jwt', expires_in: 900, user: merchantAudienceWithoutRole }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: 'success', data: tokens }), { status: 201 })))

  await expect(merchantSession.refresh()).resolves.toBe(false)
  expect(merchantSession.getAccessToken()).toBeUndefined()
  expect(redirectToLogin).toHaveBeenCalledOnce()
})

it('clears in-memory access and redirects when refresh is unauthorized', async () => {
  const redirectToLogin = vi.fn()
  merchantSession.acceptLogin({ access_token: 'expired-jwt', expires_in: 900, user: merchantUser })
  merchantSession.setUnauthorizedHandler(redirectToLogin)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

  await expect(merchantSession.refresh()).resolves.toBe(false)

  expect(merchantSession.getAccessToken()).toBeUndefined()
  expect(redirectToLogin).toHaveBeenCalledOnce()
})

it('logs out with the bearer token and clears in-memory access', async () => {
  merchantSession.acceptLogin({ access_token: 'logout-jwt', expires_in: 900, user: merchantUser })
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)

  await merchantSession.logout()

  expect(fetchMock).toHaveBeenCalledWith('https://api.zsf.shopping/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: 'Bearer logout-jwt', 'X-Device-Id': expect.any(String) },
    credentials: 'include',
  })
  expect(merchantSession.getAccessToken()).toBeUndefined()
})

it('uses a valid in-memory access token without refreshing', async () => {
  merchantSession.acceptLogin({ access_token: 'current-jwt', expires_in: 900, user: merchantUser })
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  await expect(merchantSession.ensureAccessToken()).resolves.toBe(true)

  expect(fetchMock).not.toHaveBeenCalled()
})

it('uses the password-reset code flow for forgotten merchant passwords', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ code: 0, msg: 'success', data: { ok: true } }), { status: 201 }),
  )
  vi.stubGlobal('fetch', fetchMock)

  await merchantSession.requestPasswordReset('merchant-demo')
  await merchantSession.resetPassword('merchant-demo', '123456', 'replacement-password-123')

  expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.zsf.shopping/api/auth/password/forgot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username: 'merchant-demo', audience: 'merchant-api' }),
  })
  expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.zsf.shopping/api/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username: 'merchant-demo', code: '123456', password: 'replacement-password-123', audience: 'merchant-api' }),
  })
})

it('changes the signed-in merchant password using the same code and clears its in-memory session', async () => {
  merchantSession.acceptLogin({ access_token: 'merchant-jwt', expires_in: 900, user: merchantUser })
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: 'success', data: { ok: true } }), { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)

  await merchantSession.requestPasswordChangeCode()
  await merchantSession.changePassword('123456', 'replacement-password-123')

  expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.zsf.shopping/api/auth/password/change/code', {
    method: 'POST',
    headers: { Authorization: 'Bearer merchant-jwt' },
    credentials: 'include',
  })
  expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.zsf.shopping/api/auth/password/change', {
    method: 'POST',
    headers: { Authorization: 'Bearer merchant-jwt', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code: '123456', password: 'replacement-password-123' }),
  })
  expect(merchantSession.getAccessToken()).toBeUndefined()
})
