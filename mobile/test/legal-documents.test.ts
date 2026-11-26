import { LEGAL_DOCUMENT_VERSIONS, MOBILE_LEGAL_DOCUMENT_VERSIONS } from '@lingdian/contracts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { privacyPolicyDocument, userAgreementDocument } from '../src/legal-documents';

test('App consent uses its own versions and describes the App sign-in and storage', () => {
  assert.equal(userAgreementDocument.version, MOBILE_LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT);
  assert.equal(privacyPolicyDocument.version, MOBILE_LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY);
  assert.notEqual(userAgreementDocument.version, LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT);
  const text = JSON.stringify([userAgreementDocument, privacyPolicyDocument]);
  assert.match(text, /短信验证码/);
  assert.match(text, /照片选择器/);
  assert.match(text, /加密保存购物袋及待确认订单/);
  assert.doesNotMatch(text, /微信|小程序/);
});
