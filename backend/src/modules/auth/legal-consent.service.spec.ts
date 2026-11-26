import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateSync } from 'class-validator';
import { LEGAL_DOCUMENT_VERSIONS, MOBILE_LEGAL_DOCUMENT_VERSIONS } from '@lingdian/contracts';
import { LegalConsentDto } from './dto/legal-consent.dto';
import { LegalConsentService } from './legal-consent.service';

const consent = {
  userAgreementVersion: LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
  privacyPolicyVersion: LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
};

const previousConsent = {
  userAgreementVersion: '2026-08-17',
  privacyPolicyVersion: '2026-08-17',
};

test('accepts published versions as matching pairs for user-api logins', () => {
  const service = new LegalConsentService({} as never);
  for (const input of [consent, previousConsent]) {
    assert.deepEqual(validateSync(Object.assign(new LegalConsentDto(), input)), []);
    assert.doesNotThrow(() => service.assertCurrentForAudience('user-api', input));
  }
  assert.throws(
    () => service.assertCurrentForAudience('user-api', { ...consent, privacyPolicyVersion: previousConsent.privacyPolicyVersion }),
    /请更新小程序后重试/,
  );
  assert.throws(() => service.assertCurrentForAudience('user-api', undefined), /请更新小程序后重试/);
  assert.throws(
    () => service.assertCurrentForAudience('user-api', { ...consent, privacyPolicyVersion: 'old' }),
    /请更新小程序后重试/,
  );
  assert.doesNotThrow(() => service.assertCurrentForAudience('admin-api', undefined));
});

test('mobile allows its own published pair and rejects cross-channel consent', () => {
  const service = new LegalConsentService({} as never);
  const mobileConsent = {
    userAgreementVersion: MOBILE_LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
    privacyPolicyVersion: MOBILE_LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
  };
  assert.deepEqual(validateSync(Object.assign(new LegalConsentDto(), mobileConsent)), []);
  assert.doesNotThrow(() => service.assertCurrentForAudience('user-api', mobileConsent, 'mobile'));
  assert.throws(() => service.assertCurrentForAudience('user-api', mobileConsent), /请更新小程序后重试/);
  assert.throws(() => service.assertCurrentForAudience('user-api', consent, 'mobile'), /请更新零点 App 后重试/);
  assert.throws(
    () => service.assertCurrentForAudience('user-api', { ...mobileConsent, privacyPolicyVersion: consent.privacyPolicyVersion }, 'mobile'),
    /请更新零点 App 后重试/,
  );
  assert.doesNotThrow(() => service.assertCurrentForAudience('admin-api', undefined, 'mobile'));
});

test('uses one stable API error contract for missing and stale consumer legal consent', () => {
  const service = new LegalConsentService({} as never);

  for (const input of [undefined, { ...consent, privacyPolicyVersion: 'old' }]) {
    assert.throws(
      () => service.assertCurrentForAudience('user-api', input),
      (error: unknown) => {
        assert.equal((error as { businessCode?: number }).businessCode, 2004);
        assert.equal((error as Error).message, '请更新小程序后重试');
        return true;
      },
    );
  }
});

test('records both current legal documents idempotently', async () => {
  const calls: unknown[] = [];
  const client = {
    userLegalConsent: {
      createMany: async (input: unknown) => {
        calls.push(input);
        return { count: 2 };
      },
    },
  };
  const service = new LegalConsentService(client as never);

  await service.record('user-1', consent, { ip: '127.0.0.1', deviceId: 'miniapp' });

  assert.equal(calls.length, 1);
  assert.deepEqual((calls[0] as { skipDuplicates: boolean }).skipDuplicates, true);
  assert.deepEqual(
    (calls[0] as { data: Array<{ documentType: string; version: string }> }).data.map((item) => [item.documentType, item.version]),
    [
      ['USER_AGREEMENT', consent.userAgreementVersion],
      ['PRIVACY_POLICY', consent.privacyPolicyVersion],
    ],
  );
});
