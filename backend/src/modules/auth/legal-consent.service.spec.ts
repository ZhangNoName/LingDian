import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { LEGAL_DOCUMENT_VERSIONS } from '@lingdian/contracts';
import { LegalConsentService } from './legal-consent.service';

const consent = {
  userAgreementVersion: LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
  privacyPolicyVersion: LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
};

test('requires current legal versions for user-api logins', () => {
  const service = new LegalConsentService({} as never);
  assert.throws(() => service.assertCurrentForAudience('user-api', undefined), /请更新小程序后重试/);
  assert.throws(
    () => service.assertCurrentForAudience('user-api', { ...consent, privacyPolicyVersion: 'old' }),
    /请更新小程序后重试/,
  );
  assert.doesNotThrow(() => service.assertCurrentForAudience('admin-api', undefined));
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
      ['USER_AGREEMENT', '2026-08-17'],
      ['PRIVACY_POLICY', '2026-08-17'],
    ],
  );
});
