import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard } from './access-token.guard';

type Session = {
  id: string;
  userId: string;
  audience: 'USER_API' | 'ADMIN_API';
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: Date;
  user: { status: 'ACTIVE' | 'DISABLED'; sessionVersion: number };
};

const accessSecret = 'a'.repeat(32);

function createGuard(sessionOverrides: Partial<Session> = {}) {
  const session: Session = {
    id: 'session-1',
    userId: 'user-1',
    audience: 'USER_API',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 60_000),
    user: { status: 'ACTIVE', sessionVersion: 3 },
    ...sessionOverrides,
  };
  const prisma = {
    authSession: {
      findUnique: async () => session,
    },
  };
  const jwt = new JwtService({ secret: accessSecret });
  const config = { getOrThrow: () => accessSecret };
  return { guard: new AccessTokenGuard(prisma as never, jwt, config as never), jwt, session };
}

async function signedToken(jwt: JwtService, claims: Record<string, unknown> = {}) {
  return jwt.signAsync(
    { sub: 'user-1', sid: 'session-1', aud: 'user-api', sv: 3, roles: ['USER'], ...claims },
    { secret: accessSecret },
  );
}

function contextWithToken(token: string, allowPasswordChange = false) {
  const request: { headers: { authorization: string }; user?: unknown } = {
    headers: { authorization: `Bearer ${token}` },
  };
  const handler = () => undefined;
  if (allowPasswordChange) Reflect.defineMetadata('allowPasswordChangeRequired', true, handler);
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
    },
  };
}

test('AccessTokenGuard rejects a token with an invalid signature', async () => {
  const { guard } = createGuard();
  const token = await new JwtService({ secret: 'b'.repeat(32) }).signAsync({
    sub: 'user-1', sid: 'session-1', aud: 'user-api', sv: 3, roles: ['USER'],
  });

  await assert.rejects(() => guard.canActivate(contextWithToken(token).context as never), /invalid or expired/i);
});

test('AccessTokenGuard rejects missing and malformed required claims', async () => {
  const { guard, jwt } = createGuard();
  const malformedClaims = [
    { roles: undefined },
    { aud: 'partner-api' },
    { sv: '3' },
    { roles: ['ROOT'] },
    { merchantStoreIds: ['store-1'] },
  ];

  for (const claims of malformedClaims) {
    const token = await signedToken(jwt, claims);
    await assert.rejects(() => guard.canActivate(contextWithToken(token).context as never), /claims are invalid/i);
  }
});

test('AccessTokenGuard rejects revoked and expired sessions', async () => {
  for (const sessionOverrides of [
    { status: 'REVOKED' as const },
    { expiresAt: new Date(Date.now() - 1) },
  ]) {
    const { guard, jwt } = createGuard(sessionOverrides);
    const token = await signedToken(jwt);
    await assert.rejects(() => guard.canActivate(contextWithToken(token).context as never), /session is no longer active/i);
  }
});

test('AccessTokenGuard rejects a disabled user', async () => {
  const { guard, jwt } = createGuard({ user: { status: 'DISABLED', sessionVersion: 3 } });
  const token = await signedToken(jwt);

  await assert.rejects(() => guard.canActivate(contextWithToken(token).context as never), /session is no longer active/i);
});

test('AccessTokenGuard rejects a session-version mismatch', async () => {
  const { guard, jwt } = createGuard({ user: { status: 'ACTIVE', sessionVersion: 4 } });
  const token = await signedToken(jwt);

  await assert.rejects(() => guard.canActivate(contextWithToken(token).context as never), /session is no longer active/i);
});

test('AccessTokenGuard rejects a stored-audience mismatch', async () => {
  const { guard, jwt } = createGuard({ audience: 'ADMIN_API' });
  const token = await signedToken(jwt);

  await assert.rejects(() => guard.canActivate(contextWithToken(token).context as never), /session is no longer active/i);
});

test('AccessTokenGuard permits mandatory password-change state only on an allowed endpoint', async () => {
  const { guard, jwt } = createGuard();
  const token = await signedToken(jwt, { mustChangePassword: true });
  await assert.rejects(() => guard.canActivate(contextWithToken(token).context as never), /password change is required/i);
  const wrapped = contextWithToken(token, true);
  await guard.canActivate(wrapped.context as never);
  assert.equal((wrapped.request.user as { mustChangePassword?: boolean }).mustChangePassword, true);
});
