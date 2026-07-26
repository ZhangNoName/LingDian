import { describe, expect, it } from 'vitest'
import { accountPageConfig } from './account-page-config'

describe('account page config', () => {
  it('keeps create behavior inside the current account category', () => {
    expect(accountPageConfig('ADMINISTRATOR')).toMatchObject({ createLabel: '新建管理员', defaultRoles: ['ADMIN'], showStores: false })
    expect(accountPageConfig('MERCHANT')).toMatchObject({ createLabel: '新建商家', defaultRoles: ['MERCHANT'], showStores: true })
    expect(accountPageConfig('USER')).toMatchObject({ createLabel: '新建用户', defaultRoles: ['USER'], showStores: false })
  })
})
