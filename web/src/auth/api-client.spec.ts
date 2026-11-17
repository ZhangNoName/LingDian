import type { AuthenticatedUser } from '@lingdian/contracts'
import { afterEach, expect, it, vi } from 'vitest'
import { authenticatedFetch } from './api-client'
import { merchantSession } from './session'

const merchantUser: AuthenticatedUser = {
  userId: 'merchant-1',
  sessionId: 'session-1',
  audience: 'merchant-api',
  roles: ['MERCHANT'],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('adds the in-memory bearer token and includes browser credentials', async () => {
  merchantSession.acceptLogin({ access_token: 'api-jwt', expires_in: 900, user: merchantUser })
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  await authenticatedFetch('/api/products')

  expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.zsf.shopping/api/products')
  const init = fetchMock.mock.calls[0]?.[1]
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer api-jwt')
  expect(init?.credentials).toBe('include')
})

it('refreshes once and retries a rejected authenticated request', async () => {
  merchantSession.acceptLogin({ access_token: 'expired-jwt', expires_in: 900, user: merchantUser })
  const refreshed = { access_token: 'refreshed-jwt', expires_in: 900, user: merchantUser }
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, msg: 'success', data: refreshed }), { status: 201 }))
    .mockResolvedValueOnce(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  await expect(authenticatedFetch('/api/products')).resolves.toMatchObject({ status: 200 })

  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(fetchMock.mock.calls[2]?.[0]).toBe('https://api.zsf.shopping/api/products')
  expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe('Bearer refreshed-jwt')
})

it('keeps the original store context when a rejected request retries after a store switch', async () => {
  const { merchantStore } = await import('./merchant-store')
  const user = { ...merchantUser, merchantStoreIds: ['a', 'b'] }
  merchantSession.acceptLogin({ access_token: 'old', expires_in: 900, user })
  merchantStore.setStores([
    { id: 'a', code: 'A', name: 'A', status: 'OPEN' },
    { id: 'b', code: 'B', name: 'B', status: 'OPEN' },
  ])
  merchantStore.select('a')
  const fetchMock = vi.fn()
    .mockImplementationOnce(async () => { merchantStore.select('b'); return new Response(null, { status: 401 }) })
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'new', expires_in: 900, user }), { status: 200 }))
    .mockResolvedValueOnce(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  await authenticatedFetch('/api/merchant/orders/order-a/status', { method: 'PATCH' })
  expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-Store-Id')).toBe('a')
  expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('X-Store-Id')).toBe('a')
  expect(merchantStore.selectedId.value).toBe('b')
  merchantSession.clear()
})
