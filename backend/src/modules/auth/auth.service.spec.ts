import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AuthService } from './auth.service';

test('admin phone login rejects a verified user without ADMIN role', async () => {
  const authService = new AuthService(
    {
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
        callback({
          authIdentity: {
            findUnique: async () => ({
              user: {
                id: 'user-1',
                status: 'ACTIVE',
                sessionVersion: 1,
                roles: [{ role: 'USER', status: 'ACTIVE' }],
              },
            }),
          },
        }),
    } as never,
    { consume: async () => undefined } as never,
    { create: async () => { throw new Error('session must not be created'); } } as never,
  );
  const requestContext = { deviceId: 'device-1' };

  await assert.rejects(
    () => authService.phoneLogin({ phone: '13800000000', code: '123456', audience: 'admin-api' }, requestContext),
    /administrator role required/i,
  );
});

test('user phone login consumes the code before creating a phone user and USER role', async () => {
  const events: string[] = [];
  const authService = new AuthService(
    {
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
        callback({
          authIdentity: {
            findUnique: async () => {
              assert.deepEqual(events, ['consume']);
              events.push('lookup');
              return null;
            },
          },
          user: {
            create: async ({ data }: { data: { identities: { create: { subject: string } }; roles: { create: { role: string } } } }) => {
              assert.equal(data.identities.create.subject, '+8613800000000');
              assert.equal(data.roles.create.role, 'USER');
              events.push('create');
              return { id: 'user-1', status: 'ACTIVE', sessionVersion: 1, roles: [{ role: 'USER', status: 'ACTIVE' }] };
            },
          },
        }),
    } as never,
    { consume: async () => { events.push('consume'); } } as never,
    { create: async () => ({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, user: {} }) } as never,
  );

  await authService.phoneLogin(
    { phone: '13800000000', code: '123456', audience: 'user-api' },
    { deviceId: 'device-1' },
  );

  assert.deepEqual(events, ['consume', 'lookup', 'create']);
});

test('admin phone login never creates an account for an unknown phone identity', async () => {
  let created = false;
  const authService = new AuthService(
    {
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
        callback({
          authIdentity: { findUnique: async () => null },
          user: { create: async () => { created = true; } },
        }),
    } as never,
    { consume: async () => undefined } as never,
    { create: async () => { throw new Error('session must not be created'); } } as never,
  );

  await assert.rejects(
    () => authService.phoneLogin({ phone: '13800000000', code: '123456', audience: 'admin-api' }, { deviceId: 'd1' }),
    /administrator role required/i,
  );
  assert.equal(created, false);
});

test('concurrent valid phone logins recover the unique PHONE identity race and create sessions for both callers', async () => {
  const user = {
    id: 'user-1',
    status: 'ACTIVE' as const,
    sessionVersion: 1,
    roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }],
  };
  let initialLookups = 0;
  let created = false;
  let sessionCount = 0;
  let releaseInitialLookups!: () => void;
  const initialLookupsReady = new Promise<void>((resolve) => {
    releaseInitialLookups = resolve;
  });
  const identity = { user };
  const authIdentity = {
    findUnique: async () => {
      initialLookups += 1;
      if (initialLookups <= 2) {
        if (initialLookups === 2) releaseInitialLookups();
        await initialLookupsReady;
        return null;
      }
      return identity;
    },
  };
  const authService = new AuthService(
    {
      authIdentity,
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
        callback({
          authIdentity,
          user: {
            create: async () => {
              if (created) throw Object.assign(new Error('duplicate phone identity'), { code: 'P2002' });
              created = true;
              return user;
            },
          },
        }),
    } as never,
    { consume: async () => undefined } as never,
    {
      create: async () => {
        sessionCount += 1;
        return { accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, user: {} };
      },
    } as never,
  );

  await Promise.all([
    authService.phoneLogin({ phone: '13800000000', code: '111111', audience: 'user-api' }, { deviceId: 'd1' }),
    authService.phoneLogin({ phone: '13800000000', code: '222222', audience: 'user-api' }, { deviceId: 'd2' }),
  ]);

  assert.equal(created, true);
  assert.equal(sessionCount, 2);
  assert.ok(initialLookups >= 3);
});

test('retries a serializable phone-user transaction after a Prisma P2034 write conflict', async () => {
  const user = {
    id: 'user-1',
    status: 'ACTIVE' as const,
    sessionVersion: 1,
    roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }],
  };
  let transactionAttempts = 0;
  const authService = new AuthService(
    {
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => {
        transactionAttempts += 1;
        if (transactionAttempts === 1) throw Object.assign(new Error('write conflict'), { code: 'P2034' });
        return callback({ authIdentity: { findUnique: async () => ({ user }) } });
      },
    } as never,
    { consume: async () => undefined } as never,
    { create: async () => ({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, user: {} }) } as never,
  );

  await authService.phoneLogin(
    { phone: '13800000000', code: '123456', audience: 'user-api' },
    { deviceId: 'device-1' },
  );

  assert.equal(transactionAttempts, 2);
});

test('audits successful and rejected phone logins with request IP and device context', async () => {
  const events: Array<{ event: string; ip?: string; device?: string }> = [];
  const user = { id: 'user-1', status: 'ACTIVE' as const, sessionVersion: 1, roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }] };
  const authService = new AuthService(
    {
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => callback({ authIdentity: { findUnique: async () => ({ user }) } }),
    } as never,
    { consume: async ({ code }: { code: string }) => { if (code === '000000') throw new Error('bad code'); } } as never,
    { create: async () => ({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, user: { sessionId: 'session-1' } }) } as never,
    { record: async (entry: { event: string; ip?: string; device?: string }) => { events.push(entry); } } as never,
  );

  await authService.phoneLogin({ phone: '13800000000', code: '123456', audience: 'user-api' }, { deviceId: 'device-123', ip: '127.0.0.1' });
  await assert.rejects(
    () => authService.phoneLogin({ phone: '13800000000', code: '000000', audience: 'user-api' }, { deviceId: 'device-123', ip: '127.0.0.1' }),
    /bad code/,
  );

  assert.deepEqual(events.map((entry) => entry.event), ['PHONE_LOGIN_SUCCEEDED', 'PHONE_LOGIN_REJECTED']);
  assert.ok(events.every((entry) => entry.ip === '127.0.0.1' && entry.device === 'device-123'));
});
