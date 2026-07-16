import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PasswordService } from './password.service';

type PasswordCredential = {
  identityId: string;
  passwordHash: string;
  passwordChangedAt: Date;
};

type Session = {
  userId: string;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt: Date | null;
};

function createService() {
  const user = { id: 'user-id', sessionVersion: 1 };
  const credential: PasswordCredential = {
    identityId: 'account-id',
    passwordHash: 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    passwordChangedAt: new Date(0),
  };
  const session: Session = { userId: user.id, status: 'ACTIVE', revokedAt: null };
  const auditEvents: Array<{ event: string; userId?: string; ip?: string; device?: string; metadata?: Record<string, string | number | boolean> }> = [];
  const tx = {
    passwordCredential: {
      update: async ({ where, data }: { where: { identityId: string }; data: Pick<PasswordCredential, 'passwordHash' | 'passwordChangedAt'> }) => {
        assert.equal(where.identityId, credential.identityId);
        Object.assign(credential, data);
        return credential;
      },
    },
    user: {
      update: async ({ where, data }: { where: { id: string }; data: { sessionVersion: { increment: number } } }) => {
        assert.equal(where.id, user.id);
        user.sessionVersion += data.sessionVersion.increment;
        return user;
      },
    },
    authSession: {
      updateMany: async ({ where, data }: { where: { userId: string; status: 'ACTIVE' }; data: Pick<Session, 'status' | 'revokedAt'> }) => {
        assert.equal(where.userId, user.id);
        if (session.status === where.status) Object.assign(session, data);
        return { count: session.status === 'REVOKED' ? 1 : 0 };
      },
    },
  };
  const prisma = {
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
  };
  const audit = {
    record: async (entry: { event: string; userId?: string; ip?: string; device?: string; metadata?: Record<string, string | number | boolean> }) => {
      auditEvents.push(entry);
    },
  };

  return { passwords: new PasswordService(prisma as never, audit as never), user, credential, session, auditEvents };
}

test('stores a salted scrypt hash and verifies only the original password', async () => {
  const { passwords } = createService();

  const encoded = await passwords.hash('long-password-123');

  assert.match(encoded, /^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.equal(await passwords.verify('long-password-123', encoded), true);
  assert.equal(await passwords.verify('wrong-password-123', encoded), false);
  assert.equal(await passwords.verify('long-password-123', 'scrypt$32768$8$1$invalid$invalid$extra'), false);
});

test('replacing a password invalidates existing sessions', async () => {
  const { passwords, user, credential, session, auditEvents } = createService();
  const context = { ip: '127.0.0.1', device: 'device-1' };

  await passwords.replace('account-id', 'replacement-password-123', 'user-id', context);

  assert.equal(user.sessionVersion, 2);
  assert.equal(session.status, 'REVOKED');
  assert.ok(session.revokedAt instanceof Date);
  assert.equal(await passwords.verify('replacement-password-123', credential.passwordHash), true);
  assert.deepEqual(auditEvents, [{ event: 'PASSWORD_CHANGED', userId: 'user-id', ip: '127.0.0.1', device: 'device-1' }]);
  assert.equal(JSON.stringify(auditEvents).includes('replacement-password-123'), false);
});

test('rejects passwords shorter than twelve characters', async () => {
  const { passwords } = createService();

  await assert.rejects(() => passwords.hash('short-pass'), /at least 12 characters/i);
});
