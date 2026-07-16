import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AdminGuard } from './admin.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { AuthenticatedUser } from './authenticated-user.type';

function contextWith(user: AuthenticatedUser) {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) };
}

test('SuperAdminGuard only accepts SUPER_ADMIN under the admin audience', async () => {
  const guard = new SuperAdminGuard();

  await assert.rejects(
    () => guard.canActivate(contextWith({ userId: 'admin-1', sessionId: 'session-1', audience: 'admin-api', roles: ['ADMIN'] }) as never),
    /super administrator role required/i,
  );
  assert.equal(
    await guard.canActivate(contextWith({ userId: 'admin-1', sessionId: 'session-1', audience: 'admin-api', roles: ['SUPER_ADMIN'] }) as never),
    true,
  );
});

test('AdminGuard accepts SUPER_ADMIN under the admin audience', async () => {
  const guard = new AdminGuard();

  assert.equal(
    await guard.canActivate(contextWith({ userId: 'admin-1', sessionId: 'session-1', audience: 'admin-api', roles: ['SUPER_ADMIN'] }) as never),
    true,
  );
});
