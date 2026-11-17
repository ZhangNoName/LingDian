import { expect, it } from 'vitest'
import { pageTitle } from './page-titles'
it('translates every production page title and keeps a safe unknown-route fallback', () => {
  for (const name of [
    'dashboard',
    'stores',
    'products',
    'orders',
    'warehouse',
    'settings',
    'login',
    'forgot-password',
    'change-password',
    'profile-nickname',
  ]) {
    expect(pageTitle(name, 'en-US')).not.toMatch(/[\u3400-\u9fff]/)
    expect(pageTitle(name, 'zh-CN')).toMatch(/[\u3400-\u9fff]/)
  }
  expect(pageTitle('unknown', 'en-US')).toBe('LingDian Console')
})
