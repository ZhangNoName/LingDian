import { afterEach, expect, it, vi } from 'vitest'
import { merchantSession } from '@/auth/session'
import { merchantStore } from '@/auth/merchant-store'
import { requestData } from './api'
import { invalidateMerchantViewData, readMerchantViewData } from './merchant-view-data'

afterEach(() => {
  merchantSession.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('shares an in-flight read and reuses a recent result for the same view and filters', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const fetchView = vi.fn().mockResolvedValue({ total: 4 })
  const first = readMerchantViewData(['suppliers', 'tea'], fetchView, false)
  expect(readMerchantViewData(['suppliers', 'tea'], fetchView, false)).toBe(first)
  await expect(first).resolves.toEqual({ total: 4 })

  vi.setSystemTime(Date.now() + 59_999)
  await readMerchantViewData(['suppliers', 'tea'], fetchView, false)
  expect(fetchView).toHaveBeenCalledTimes(1)
  await readMerchantViewData(['suppliers', 'flour'], fetchView, false)
  expect(fetchView).toHaveBeenCalledTimes(2)

  vi.setSystemTime(Date.now() + 1)
  await readMerchantViewData(['suppliers', 'tea'], fetchView, false)
  expect(fetchView).toHaveBeenCalledTimes(3)
})

it('replaces a cached result on manual refresh and retries failed reads', async () => {
  const key = ['purchase-orders']
  const fetchView = vi.fn().mockResolvedValueOnce('old').mockRejectedValueOnce(new Error('failed')).mockResolvedValue('new')
  await expect(readMerchantViewData(key, fetchView, false)).resolves.toBe('old')
  await expect(readMerchantViewData(key, fetchView, true)).rejects.toThrow('failed')
  await expect(readMerchantViewData(key, fetchView, false)).resolves.toBe('new')
  await expect(readMerchantViewData(key, fetchView, false)).resolves.toBe('new')
  expect(fetchView).toHaveBeenCalledTimes(3)
})

it('never lets a read started before a write overwrite the newer cached result', async () => {
  const key = ['inventory']
  let completeOldRead!: (value: string) => void
  const oldData = new Promise<string>((resolve) => { completeOldRead = resolve })
  const oldRead = readMerchantViewData(key, () => oldData, false)

  invalidateMerchantViewData()
  const fetchView = vi.fn().mockResolvedValue('current')
  await readMerchantViewData(key, fetchView, false)
  completeOldRead('old')
  await oldRead
  await expect(readMerchantViewData(key, fetchView, false)).resolves.toBe('current')
  expect(fetchView).toHaveBeenCalledTimes(1)
})

it('reloads a view after a write through the merchant API', async () => {
  const key = ['inventory']
  const fetchView = vi.fn().mockResolvedValueOnce('old').mockResolvedValue('current')
  const fetch = vi.fn(() => new Response(JSON.stringify({ code: 0, msg: 'ok', data: {} })))
  vi.stubGlobal('fetch', fetch)
  await readMerchantViewData(key, fetchView, false)
  await requestData('/api/merchant/inventory')
  await expect(readMerchantViewData(key, fetchView, false)).resolves.toBe('old')

  await requestData('/api/merchant/inventory', { method: 'POST' })
  await expect(readMerchantViewData(key, fetchView, false)).resolves.toBe('current')
  expect(fetchView).toHaveBeenCalledTimes(2)
})

it('clears results when switching stores or signing in with a different session', async () => {
  const login = (sessionId: string) => merchantSession.acceptLogin({
    access_token: 'test-token',
    expires_in: 900,
    user: { userId: 'merchant', sessionId, audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['a', 'b'] },
  })
  login('first-session')
  merchantStore.setStores([
    { id: 'a', code: 'A', name: 'Store A', status: 'OPEN' },
    { id: 'b', code: 'B', name: 'Store B', status: 'OPEN' },
  ])
  merchantStore.select('a')
  const fetchView = vi.fn(async () => merchantStore.selectedId.value)
  const key = ['products']
  await expect(readMerchantViewData(key, fetchView, false)).resolves.toBe('a')
  merchantStore.select('b')
  await expect(readMerchantViewData(key, fetchView, false)).resolves.toBe('b')
  login('first-session')
  await readMerchantViewData(key, fetchView, false)
  expect(fetchView).toHaveBeenCalledTimes(2)
  login('second-session')
  await readMerchantViewData(key, fetchView, false)
  expect(fetchView).toHaveBeenCalledTimes(3)
})
