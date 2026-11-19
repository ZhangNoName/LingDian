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

it('uses the selected warehouse menu label as the title in either language', () => {
  expect(pageTitle('warehouse', 'zh-CN', { view: 'recipes' })).toBe('销售配方')
  expect(pageTitle('warehouse', 'en-US', { view: 'purchases', purchaseView: 'suppliers' })).toBe('Suppliers')
})
