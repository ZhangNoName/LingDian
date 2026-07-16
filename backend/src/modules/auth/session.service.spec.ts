import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from './session.service';

type SessionRecord = {
  id: string;
  userId: string;
  audience: 'USER_API' | 'ADMIN_API';
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  refreshTokenHistory: string[];
  device: string;
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: Date;
  revokedAt: Date | null;
  user: {
    id: string;
    status: 'ACTIVE' | 'DISABLED';
    sessionVersion: number;
    roles: Array<{ role: 'USER' | 'ADMIN'; status: 'ACTIVE' | 'DISABLED' }>;
  };
};

function createService() {
  const sessions: SessionRecord[] = [];
  const auditEvents: Array<{ event: string; ip?: string; device?: string }> = [];
  const user: SessionRecord['user'] = {
    id: 'user-1',
    status: 'ACTIVE',
    sessionVersion: 4,
    roles: [
      { role: 'USER', status: 'ACTIVE' },
      { role: 'ADMIN', status: 'ACTIVE' },
    ],
  };
  const prisma = {
    authSession: {
      upsert: async ({ create, update }: { create: Omit<SessionRecord, 'id' | 'user'>; update: Partial<SessionRecord> }) => {
        const existing = sessions.find(
          (session) =>
            session.userId === create.userId && session.audience === create.audience && session.device === create.device,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const { status: _status, revokedAt: _revokedAt, ...persisted } = create;
        const session = {
          id: `session-${sessions.length + 1}`,
          status: 'ACTIVE' as const,
          revokedAt: null,
          ...persisted,
          user,
        };
        sessions.push(session);
        return session;
      },
      findFirst: async ({ where }: { where: { OR?: Array<{ refreshTokenHash?: string; previousRefreshTokenHash?: string; refreshTokenHistory?: { array_contains: string[] } }>; previousRefreshTokenHash?: string } }) =>
        sessions.find((session) => session.previousRefreshTokenHash === where.previousRefreshTokenHash || where.OR?.some((condition) =>
          (condition.refreshTokenHash !== undefined && session.refreshTokenHash === condition.refreshTokenHash) ||
          (condition.previousRefreshTokenHash !== undefined && session.previousRefreshTokenHash === condition.previousRefreshTokenHash) ||
          (condition.refreshTokenHistory?.array_contains.some((hash) => session.refreshTokenHistory.includes(hash)) ?? false),
        )) ?? null,
      findUnique: async ({ where }: { where: { refreshTokenHash: string } }) =>
        sessions.find((session) => session.refreshTokenHash === where.refreshTokenHash) ?? null,
      updateMany: async ({ where, data }: { where: { id?: string; userId?: string; status?: 'ACTIVE'; refreshTokenHash?: string; expiresAt?: { gt: Date } }; data: Partial<SessionRecord> }) => {
        const matches = sessions.filter(
          (session) =>
            (!where.id || session.id === where.id) &&
            (!where.userId || session.userId === where.userId) &&
            (!where.status || session.status === where.status) &&
            (!where.refreshTokenHash || session.refreshTokenHash === where.refreshTokenHash) &&
            (!where.expiresAt || session.expiresAt > where.expiresAt.gt),
        );
        for (const session of matches) Object.assign(session, data);
        return { count: matches.length };
      },
    },
    user: {
      update: async ({ data }: { data: { sessionVersion: { increment: number } } }) => {
        user.sessionVersion += data.sessionVersion.increment;
        return user;
      },
    },
    $transaction: async <T>(operations: Promise<T>[]) => Promise.all(operations),
  };
  const jwt = new JwtService({ secret: 'a'.repeat(32) });
  const config = {
    get: (key: string) =>
      ({ 'auth.accessTokenTtlSeconds': 900, 'auth.refreshTokenTtlDays': 30 }[key]),
  };
  const service = new SessionService(prisma as never, jwt, 'test-refresh-pepper', config as never, {
    record: async (entry: { event: string; ip?: string; device?: string }) => { auditEvents.push(entry); },
  } as never);

  return { jwt, service, sessions, user, auditEvents };
}

test('creates a 32-byte opaque refresh token, stores only its HMAC, and signs the required claims', async () => {
  const { jwt, service, sessions } = createService();
  const before = Math.floor(Date.now() / 1000);

  const result = await service.create(
    { id: 'user-1', sessionVersion: 4, roles: ['USER', 'ADMIN'] },
    'admin-api',
    'device-1',
  );

  assert.equal(Buffer.from(result.refreshToken, 'base64url').byteLength, 32);
  assert.equal(sessions.length, 1);
  assert.equal(
    sessions[0].refreshTokenHash,
    createHmac('sha256', 'test-refresh-pepper').update(result.refreshToken).digest('hex'),
  );
  assert.notEqual(sessions[0].refreshTokenHash, result.refreshToken);

  const claims = await jwt.verifyAsync(result.accessToken, { secret: 'a'.repeat(32) });
  assert.deepEqual(
    { sub: claims.sub, sid: claims.sid, aud: claims.aud, sv: claims.sv, roles: claims.roles },
    { sub: 'user-1', sid: 'session-1', aud: 'admin-api', sv: 4, roles: ['USER', 'ADMIN'] },
  );
  assert.ok(claims.exp >= before + 899 && claims.exp <= before + 901);
});

test('signs merchant store scope claims and refreshes them from active store assignments', async () => {
  const { jwt, service, user } = createService();
  user.roles = [{ role: 'MERCHANT', scopeType: 'STORE', scopeId: 'store-a', status: 'ACTIVE' }] as never;

  const issued = await service.create(
    { id: 'user-1', sessionVersion: 4, roles: ['MERCHANT'], merchantStoreIds: ['store-a'] },
    'merchant-api',
    'device-1',
  );
  const issuedClaims = await jwt.verifyAsync(issued.accessToken, { secret: 'a'.repeat(32) });
  assert.deepEqual(issuedClaims.merchantStoreIds, ['store-a']);

  const refreshed = await service.refresh(issued.refreshToken);
  const refreshedClaims = await jwt.verifyAsync(refreshed.accessToken, { secret: 'a'.repeat(32) });
  assert.deepEqual(refreshedClaims.merchantStoreIds, ['store-a']);
});

test('does not disclose merchant store scopes in a non-merchant audience token', async () => {
  const { jwt, service } = createService();

  const issued = await service.create(
    { id: 'user-1', sessionVersion: 4, roles: ['ADMIN'], merchantStoreIds: ['store-a'] },
    'admin-api',
    'device-1',
  );
  const claims = await jwt.verifyAsync(issued.accessToken, { secret: 'a'.repeat(32) });

  assert.equal(claims.merchantStoreIds, undefined);
});

test('refresh rejects an inactive, expired, or disabled session', async () => {
  const { service, sessions, user } = createService();
  const issued = await service.create({ id: 'user-1', sessionVersion: 4, roles: ['USER'] }, 'user-api', 'device-1');

  sessions[0].status = 'REVOKED';
  await assert.rejects(() => service.refresh(issued.refreshToken), /session is inactive or expired/i);

  sessions[0].status = 'ACTIVE';
  sessions[0].expiresAt = new Date(Date.now() - 1);
  await assert.rejects(() => service.refresh(issued.refreshToken), /session is inactive or expired/i);

  sessions[0].expiresAt = new Date(Date.now() + 60_000);
  user.status = 'DISABLED';
  await assert.rejects(() => service.refresh(issued.refreshToken), /user is inactive/i);
});

test('refresh atomically rotates the raw token and rejects replay by revoking the session', async () => {
  const { service, sessions } = createService();
  const issued = await service.create({ id: 'user-1', sessionVersion: 4, roles: ['USER'] }, 'user-api', 'device-1');

  const refreshed = await service.refresh(issued.refreshToken);

  const successor = refreshed as unknown as { refreshToken: string };
  assert.notEqual(successor.refreshToken, issued.refreshToken);
  assert.equal(
    sessions[0].refreshTokenHash,
    createHmac('sha256', 'test-refresh-pepper').update(successor.refreshToken).digest('hex'),
  );
  assert.equal(
    sessions[0].previousRefreshTokenHash,
    createHmac('sha256', 'test-refresh-pepper').update(issued.refreshToken).digest('hex'),
  );
  const twiceRefreshed = await service.refresh(successor.refreshToken);
  assert.ok(sessions[0].refreshTokenHistory.includes(createHmac('sha256', 'test-refresh-pepper').update(issued.refreshToken).digest('hex')));
  assert.notEqual(twiceRefreshed.refreshToken, successor.refreshToken);
  await assert.rejects(() => service.refresh(issued.refreshToken), /refresh token replay detected/i);
  assert.equal(sessions[0].status, 'REVOKED');
});

test('revokeAll revokes active sessions and advances the user session version', async () => {
  const { service, sessions, user } = createService();
  await service.create({ id: 'user-1', sessionVersion: 4, roles: ['USER'] }, 'user-api', 'device-1');

  await service.revokeAll('user-1');

  assert.equal(sessions[0].status, 'REVOKED');
  assert.ok(sessions[0].revokedAt instanceof Date);
  assert.equal(user.sessionVersion, 5);
});

test('audits session create, refresh, replay rejection, revoke, and revoke-all with request context', async () => {
  const { service, auditEvents } = createService();
  const issued = await service.create({ id: 'user-1', sessionVersion: 4, roles: ['USER'] }, 'user-api', 'device-1', { ip: '127.0.0.1', device: 'device-1' });
  await service.refresh(issued.refreshToken, { ip: '127.0.0.1', device: 'device-1' });
  await assert.rejects(() => service.refresh(issued.refreshToken, { ip: '127.0.0.1', device: 'device-1' }), /replay/i);
  await service.revoke('session-1', { ip: '127.0.0.1', device: 'device-1' });
  await service.revokeAll('user-1', { ip: '127.0.0.1', device: 'device-1' });

  assert.deepEqual(auditEvents.map((entry) => entry.event), [
    'SESSION_CREATED', 'SESSION_REFRESHED', 'SESSION_REVOKED', 'SESSION_REFRESH_REJECTED', 'SESSION_REVOKED', 'SESSION_REVOKED_ALL',
  ]);
  assert.ok(auditEvents.every((entry) => entry.ip === '127.0.0.1' && entry.device === 'device-1'));
});
