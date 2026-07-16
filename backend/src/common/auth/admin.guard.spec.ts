import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AdminGuard } from './admin.guard';
import { AuthenticatedUser } from './authenticated-user.type';

function contextWithUser(user: AuthenticatedUser) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

test('AdminGuard rejects a user-api token even when it contains ADMIN', async () => {
  const context = contextWithUser({ userId: 'u1', sessionId: 's1', audience: 'user-api', roles: ['ADMIN'] });
  const guard = new AdminGuard();

  await assert.rejects(() => guard.canActivate(context as never), /admin audience required/i);
});
