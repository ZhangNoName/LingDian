import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { isDirectCustomerOrder, LEGAL_DOCUMENT_VERSIONS } from '@lingdian/contracts'

test('production build excludes test fixtures', () => {
  const distFiles = readdirSync(new URL('../dist', import.meta.url))

  assert.equal(distFiles.some((file) => /(?:spec|test)\.[^.]+$/.test(file)), false)
})

test('publishes the browser runtime as ESM and retains the CommonJS entrypoint', () => {
  const require = createRequire(import.meta.url)
  assert.match(import.meta.resolve('@lingdian/contracts'), /\/dist\/esm\/index\.js$/)
  assert.equal(isDirectCustomerOrder('APP'), true)
  assert.equal(require('@lingdian/contracts').isDirectCustomerOrder('POS'), false)
})

test('customer contract runtime values are exported only through the public entrypoint', () => {
  const contracts = {
    login: {
      audience: 'user-api',
      legalConsent: {
        userAgreementVersion: LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
        privacyPolicyVersion: LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
      },
    },
    address: { isDefault: true },
    profile: { avatar_data_url: null },
    deliveryAddress: '张三 13800000000 北京市北京市西城区太平街甲6号',
  }

  assert.equal(contracts.login.audience, 'user-api')
  assert.equal(contracts.login.legalConsent.userAgreementVersion, '2026-11-23')
  assert.equal(contracts.login.legalConsent.privacyPolicyVersion, '2026-11-23')
  assert.equal(contracts.address.isDefault, true)
  assert.equal(contracts.profile.avatar_data_url, null)
  assert.match(contracts.deliveryAddress, /13800000000/)
})
