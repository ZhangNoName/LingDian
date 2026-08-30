import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import test from 'node:test'
import { LEGAL_DOCUMENT_VERSIONS } from '../dist/index.js'

test('production build excludes test fixtures', () => {
  const distFiles = readdirSync(new URL('../dist', import.meta.url))

  assert.equal(distFiles.some((file) => /(?:spec|test)\.[^.]+$/.test(file)), false)
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
  assert.equal(contracts.login.legalConsent.userAgreementVersion, '2026-08-17')
  assert.equal(contracts.address.isDefault, true)
  assert.equal(contracts.profile.avatar_data_url, null)
  assert.match(contracts.deliveryAddress, /13800000000/)
})
