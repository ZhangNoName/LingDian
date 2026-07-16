import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AuthenticatedUser } from './authenticated-user.type';
import { UserApiGuard } from './user-api.guard';

function contextWithUser(user: AuthenticatedUser) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

test('UserApiGuard rejects an admin-api token from a customer operation', async () => {
  const guard = new UserApiGuard();
  const context = contextWithUser({ userId: 'admin-1', sessionId: 'session-1', audience: 'admin-api', roles: ['ADMIN'] });

  await assert.rejects(() => guard.canActivate(context as never), /user audience required/i);
});
