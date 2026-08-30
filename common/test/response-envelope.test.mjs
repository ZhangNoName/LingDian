import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { isResponseEnvelope } from '../dist/esm/index.js'

const require = createRequire(import.meta.url)

test('accepts a complete response envelope', () => {
  assert.equal(isResponseEnvelope({ code: 0, msg: 'success', data: { id: 'one' } }), true)
})

test('rejects lookalike objects with invalid protocol fields', () => {
  assert.equal(isResponseEnvelope({ code: '0', msg: 'success', data: null }), false)
  assert.equal(isResponseEnvelope({ code: 0, msg: 123, data: null }), false)
  assert.equal(isResponseEnvelope({ code: 9999, msg: 'unknown', data: null }), false)
  assert.equal(isResponseEnvelope({ code: 0, msg: 'success' }), false)
})

test('publishes the same validator through the CommonJS package export', () => {
  const common = require('@lingdian/common')

  assert.equal(typeof common.isResponseEnvelope, 'function')
  assert.equal(common.isResponseEnvelope({ code: 0, msg: 'success', data: null }), true)
})
