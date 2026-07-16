import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { AccountAuthService } from './account-auth.service';

const context = { deviceId: 'web', ip: '127.0.0.1' };

function merchantAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-identity',
    provider: 'ACCOUNT',
    subject: 'merchant-one',
    passwordCredential: { passwordHash: 'encoded-password' },
    user: {
      id: 'merchant-user',
      status: 'ACTIVE',
      sessionVersion: 1,
      roles: [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-1', status: 'ACTIVE' }],
      identities: [
        { id: 'account-identity', provider: 'ACCOUNT', phoneE164: null, verifiedAt: new Date() },
        { id: 'phone-identity', provider: 'PHONE', phoneE164: '+8613800000000', verifiedAt: new Date() },
      ],
    },
    ...overrides,
  };
}

test('issues a merchant session only for an account with a store-scoped merchant role', async () => {
  const calls: unknown[] = [];
  const accountAuth = new AccountAuthService(
    { authIdentity: { findUnique: async () => merchantAccount() } } as never,
    { consume: async () => undefined, issue: async () => ({ messageId: 'message-1' }) } as never,
    {
      create: async (...args: unknown[]) => {
        calls.push(args);
        return { accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, user: { audience: 'merchant-api' } };
      },
    } as never,
    { verify: async () => true, replace: async () => undefined } as never,
    { record: async () => undefined } as never,
  );

  const tokens = await accountAuth.login(
    { username: ' Merchant-One ', password: 'merchant-password-123', audience: 'merchant-api' },
    context,
  );

  assert.equal(tokens.user.audience, 'merchant-api');
  assert.equal((calls[0] as unknown[])[1], 'merchant-api');
  assert.deepEqual((calls[0] as unknown[])[0], {
    id: 'merchant-user', sessionVersion: 1, roles: ['MERCHANT'], merchantStoreIds: ['store-1'],
  });
});

test('rejects merchant account login without an active store-scoped merchant role', async () => {
  const accountAuth = new AccountAuthService(
    {
      authIdentity: {
        findUnique: async () => merchantAccount({
          user: {
            id: 'merchant-user', status: 'ACTIVE', sessionVersion: 1,
            roles: [{ role: 'MERCHANT', scopeType: 'GLOBAL', scopeId: '', status: 'ACTIVE' }],
            identities: [],
          },
        }),
      },
    } as never,
    {} as never,
    { create: async () => { throw new Error('session must not be created'); } } as never,
    { verify: async () => true } as never,
    { record: async () => undefined } as never,
  );

  await assert.rejects(
    () => accountAuth.login({ username: 'merchant-one', password: 'merchant-password-123', audience: 'merchant-api' }, context),
    /credentials.*invalid/i,
  );
});

test('forgot-password response does not reveal an unknown account', async () => {
  let issueCalled = false;
  const accountAuth = new AccountAuthService(
    { authIdentity: { findUnique: async () => null } } as never,
    { issue: async () => { issueCalled = true; }, consume: async () => undefined } as never,
    {} as never,
    {} as never,
    { record: async () => undefined } as never,
  );

  const response = await accountAuth.requestPasswordReset({ username: 'unknown', audience: 'merchant-api' }, context);

  assert.deepEqual(response, { accepted: true });
  assert.equal(issueCalled, false);
});

test('merchant password reset consumes PASSWORD_RESET and revokes sessions', async () => {
  let consumedPurpose = '';
  let replaced: unknown[] | undefined;
  const accountAuth = new AccountAuthService(
    { authIdentity: { findUnique: async () => merchantAccount() } } as never,
    {
      consume: async ({ purpose }: { purpose: string }) => { consumedPurpose = purpose; },
      issue: async () => ({ messageId: 'message-1' }),
    } as never,
    {} as never,
    {
      replace: async (...args: unknown[]) => { replaced = args; },
      verify: async () => true,
    } as never,
    { record: async () => undefined } as never,
  );

  await accountAuth.resetPassword(
    { username: 'merchant-one', audience: 'merchant-api', code: '123456', password: 'replacement-password-123' },
    context,
  );

  assert.equal(consumedPurpose, 'PASSWORD_RESET');
  assert.deepEqual(replaced?.slice(0, 3), ['account-identity', 'replacement-password-123', 'merchant-user']);
});

test('password reset gives unknown merchants the same generic failure as an invalid code', async () => {
  const unknownAccount = new AccountAuthService(
    { authIdentity: { findUnique: async () => null } } as never,
    {} as never,
    {} as never,
    {} as never,
    { record: async () => undefined } as never,
  );
  const invalidCode = new AccountAuthService(
    { authIdentity: { findUnique: async () => merchantAccount() } } as never,
    { consume: async () => { throw new BadRequestException('Verification code is invalid or expired.'); } } as never,
    {} as never,
    {} as never,
    { record: async () => undefined } as never,
  );
  const input = { username: 'merchant-one', audience: 'merchant-api' as const, code: '123456', password: 'replacement-password-123' };

  const unknownError = await rejection(() => unknownAccount.resetPassword({ ...input, username: 'unknown' }, context));
  const invalidCodeError = await rejection(() => invalidCode.resetPassword(input, context));

  assert.equal(statusOf(unknownError), statusOf(invalidCodeError));
  assert.equal(messageOf(unknownError), messageOf(invalidCodeError));
});

test('login verifies a fixed dummy hash when account lookup or eligibility is rejected', async () => {
  const verifyCalls: Array<[string, string]> = [];
  const attempts = [
    { account: null, audience: 'merchant-api' as const },
    { account: merchantAccount({ passwordCredential: null }), audience: 'merchant-api' as const },
    { account: merchantAccount({ user: { ...merchantAccount().user, status: 'DISABLED' } }), audience: 'merchant-api' as const },
    { account: merchantAccount(), audience: 'admin-api' as const },
  ];
  let lookupIndex = 0;
  const accountAuth = new AccountAuthService(
    { authIdentity: { findUnique: async () => attempts[lookupIndex++]?.account ?? null } } as never,
    {} as never,
    { create: async () => { throw new Error('session must not be created'); } } as never,
    { verify: async (password: string, hash: string) => { verifyCalls.push([password, hash]); return false; } } as never,
    { record: async () => undefined } as never,
  );

  for (const attempt of attempts) {
    await assert.rejects(
      () => accountAuth.login({ username: 'merchant-one', password: 'merchant-password-123', audience: attempt.audience }, context),
      /credentials.*invalid/i,
    );
  }

  assert.equal(verifyCalls.length, 4);
  assert.ok(verifyCalls.every(([password]) => password === 'merchant-password-123'));
  assert.ok(verifyCalls.every(([, hash]) => hash === verifyCalls[0][1]));
  assert.match(verifyCalls[0][1], /^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
});

test('password-change code is issued only for the signed-in merchant account phone', async () => {
  const issued: unknown[] = [];
  const accountAuth = new AccountAuthService(
    {
      user: {
        findUnique: async () => merchantAccount().user,
      },
    } as never,
    { issue: async (input: unknown) => { issued.push(input); return { messageId: 'message-1' }; } } as never,
    {} as never,
    {} as never,
    { record: async () => undefined } as never,
  );

  await accountAuth.requestPasswordChangeCode(
    { userId: 'merchant-user', sessionId: 'session-1', audience: 'merchant-api', roles: ['MERCHANT'] },
    context,
  );

  assert.deepEqual(issued, [{ purpose: 'PASSWORD_RESET', phone: '+8613800000000', ip: '127.0.0.1', deviceId: 'web' }]);
});

async function rejection(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    await operation();
    assert.fail('Expected operation to reject.');
  } catch (error) {
    return error;
  }
}

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'getStatus' in error
    ? (error as { getStatus(): number }).getStatus()
    : undefined;
}

function messageOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: unknown }).message)
    : undefined;
}
