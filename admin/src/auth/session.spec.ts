import { afterEach, expect, it, vi } from 'vitest'
import { canManageMerchants } from './access'
import { adminRequest } from './api-client'
import { adminSession } from './session'

afterEach(() => {
  adminSession.clear()
  vi.unstubAllGlobals()
})

it('logs a super administrator in using admin-api', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    code: 0,
    msg: 'success',
    data: {
      access_token: 'admin-access-token',
      expires_in: 900,
      user: { userId: 'admin-1', sessionId: 'session-1', audience: 'admin-api', roles: ['SUPER_ADMIN'] },
    },
  }), { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)

  await adminSession.login('admin', 'long-password-123')

  expect(fetchMock).toHaveBeenCalledWith('/api/auth/account/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username: 'admin', password: 'long-password-123', audience: 'admin-api' }),
  })
  expect(adminSession.getAccessToken()).toBe('admin-access-token')
})

it('reports an unavailable API instead of exposing a JSON parser error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502, statusText: 'Bad Gateway' })))

  await expect(adminSession.login('admin', 'long-password-123'))
    .rejects.toThrow('后端服务暂时不可用，请确认 API 已在 9000 端口启动')
})

it('uses the HttpOnly refresh cookie without persisting the access token', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    code: 0,
    msg: 'success',
    data: {
      access_token: 'refreshed-admin-token',
      expires_in: 900,
      user: { userId: 'admin-1', sessionId: 'session-1', audience: 'admin-api', roles: ['ADMIN'] },
    },
  }), { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)

  await expect(adminSession.refresh()).resolves.toBe(true)

  expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: '{}',
  })
  expect(localStorage.getItem('access_token')).toBeNull()
})

it('retries a protected request once after a 401 using the refresh cookie', async () => {
  adminSession.acceptLogin({
    access_token: 'expired-token', expires_in: 900,
    user: { userId: 'admin-1', sessionId: 'session-1', audience: 'admin-api', roles: ['SUPER_ADMIN'] },
  })
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 401, msg: 'token expired', data: null }), { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      code: 0, msg: 'success', data: {
        access_token: 'fresh-token', expires_in: 900,
        user: { userId: 'admin-1', sessionId: 'session-2', audience: 'admin-api', roles: ['SUPER_ADMIN'] },
      },
    }), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, msg: 'success', data: { id: 'merchant-1' } }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  await expect(adminRequest<{ id: string }>('/admin/merchants')).resolves.toEqual({ id: 'merchant-1' })

  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ headers: { Authorization: 'Bearer fresh-token' } })
})

it('clears the session after refresh fails instead of retrying a 401 loop', async () => {
  adminSession.acceptLogin({
    access_token: 'expired-token', expires_in: 900,
    user: { userId: 'admin-1', sessionId: 'session-1', audience: 'admin-api', roles: ['SUPER_ADMIN'] },
  })
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 401, msg: 'token expired', data: null }), { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 401, msg: 'refresh expired', data: null }), { status: 401 }))
  vi.stubGlobal('fetch', fetchMock)

  await expect(adminRequest('/admin/merchants')).rejects.toThrow('请先登录')

  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(adminSession.getAccessToken()).toBeUndefined()
})

it('allows merchant management only for a super administrator', () => {
  expect(canManageMerchants(['SUPER_ADMIN', 'ADMIN'])).toBe(true)
  expect(canManageMerchants(['ADMIN'])).toBe(false)
})
