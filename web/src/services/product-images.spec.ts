import { expect, it, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import { uploadMerchantImage, removeMerchantImage, productImageSource } from './product-images'
it('keeps scoped multipart image bytes, replay key and version without overriding the browser boundary', async () => {
  const file = new File(['synthetic'], 'bread.png', { type: 'image/png' })
  await uploadMerchantImage('store/a', 'product/1', file, 'retry-image', 4)
  const [url, init] = requestData.mock.calls.at(-1)!
  expect(new URL(url).pathname).toContain('/store%2Fa/products/product%2F1/image')
  expect(init.method).toBe('POST')
  expect(init.headers).toBeUndefined()
  expect(init.body.get('requestId')).toBe('retry-image')
  expect(init.body.get('expected_version')).toBe('4')
  expect(init.body.get('file')).toBe(file)
  await removeMerchantImage('store/a', 'product/1', 'remove-image', 5)
  expect(requestData.mock.calls.at(-1)![0]).toContain('/product%2F1/image/remove')
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body)).toEqual({ requestId: 'remove-image', expected_version: 5 })
})
it('resolves uploaded media to the API origin and keeps legacy web images without allowing executable URLs', () => {
  expect(
    productImageSource(
      '/uploads/products/a.webp',
      'https://api.example.com/api/',
      'https://console.example.com/products',
    ),
  ).toBe('https://api.example.com/uploads/products/a.webp')
  expect(productImageSource('/uploads/a.webp', '/api/', 'https://console.example.com/products')).toBe(
    'https://console.example.com/uploads/a.webp',
  )
  expect(productImageSource('https://cdn.example.com/a.png', '/api/', 'https://example.com')).toBe(
    'https://cdn.example.com/a.png',
  )
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,test', '//untrusted.test/image', 'invalid', null])
    expect(productImageSource(value, '/api/', 'https://example.com')).toBe('')
})
