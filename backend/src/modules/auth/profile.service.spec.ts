import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProfileService } from './profile.service';

test('an authenticated user nickname is trimmed, repeatable, and cannot exceed 32 characters', async () => {
  const savedNicknames = new Map<string, string | null>();
  const profile = new ProfileService({
    user: {
      update: async ({ where, data }: { where: { id: string }; data: { nickname: string } }) => {
        savedNicknames.set(where.id, data.nickname);
        return { nickname: data.nickname };
      },
    },
  } as never);

  assert.deepEqual(await profile.setNickname('user-1', '  灵点用户  '), { nickname: '灵点用户' });
  assert.deepEqual(await profile.setNickname('user-2', '灵点用户'), { nickname: '灵点用户' });
  assert.equal(savedNicknames.get('user-1'), '灵点用户');
  assert.equal(savedNicknames.get('user-2'), '灵点用户');
  await assert.rejects(() => profile.setNickname('user-1', 'x'.repeat(33)), /32/);
});
