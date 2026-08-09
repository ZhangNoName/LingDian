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

test('profile retrieval returns null when no avatar has been uploaded', async () => {
  const profile = new ProfileService({
    user: {
      findUniqueOrThrow: async () => ({ nickname: '零点用户', avatarData: null, avatarMimeType: null }),
    },
  } as never);

  assert.deepEqual(await (profile as any).get('user-1'), {
    nickname: '零点用户',
    avatar_data_url: null,
  });
});

test('a valid PNG avatar is stored and returned as a data URL', async () => {
  let saved: any;
  const profile = new ProfileService({
    user: {
      update: async ({ data }: any) => {
        saved = data;
        return { nickname: '零点用户', ...data };
      },
    },
  } as never);
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  const result = await (profile as any).setAvatar('user-1', {
    buffer,
    mimetype: 'image/png',
    size: buffer.length,
  });

  assert.deepEqual(saved, { avatarData: Uint8Array.from(buffer), avatarMimeType: 'image/png' });
  assert.deepEqual(result, {
    nickname: '零点用户',
    avatar_data_url: `data:image/png;base64,${buffer.toString('base64')}`,
  });
});

test('profile avatar rejects files larger than 512 KiB', async () => {
  const profile = new ProfileService({ user: { update: async () => assert.fail('oversized avatar must not be stored') } } as never);

  await assert.rejects(
    () => (profile as any).setAvatar('user-1', {
      buffer: Buffer.alloc(524_289),
      mimetype: 'image/png',
      size: 524_289,
    }),
    /512 KiB/i,
  );
});

test('profile avatar rejects non-image MIME types', async () => {
  const profile = new ProfileService({ user: { update: async () => assert.fail('invalid MIME must not be stored') } } as never);

  await assert.rejects(
    () => (profile as any).setAvatar('user-1', {
      buffer: Buffer.from('not an image'),
      mimetype: 'text/plain',
      size: 12,
    }),
    /JPEG, PNG, or WebP/i,
  );
});
