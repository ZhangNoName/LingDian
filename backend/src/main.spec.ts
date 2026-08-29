import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { corsOptions, refreshCookieOptions } from './common/auth/http-security';
import { isSwaggerEnabled } from './config/swagger.config';

test('refresh cookies are HTTP-only, configured secure, SameSite=Lax, and limited to auth routes', () => {
  const options = refreshCookieOptions({ getOrThrow: () => true } as never);

  assert.deepEqual(options, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
});

test('CORS accepts only explicitly configured browser origins and allows credentials', async () => {
  const options = corsOptions({ CORS_ALLOWED_ORIGINS: 'https://admin.example.test, https://app.example.test' });

  assert.equal(options.credentials, true);
  assert.deepEqual(options.allowedHeaders, ['Authorization', 'Content-Type', 'X-Device-Id']);
  await assert.doesNotReject(() => resolveOrigin(options.origin, 'https://admin.example.test'));
  await assert.rejects(() => resolveOrigin(options.origin, 'https://untrusted.example.test'), /not allowed by CORS/i);
});

test('API documentation is opt-in in production', () => {
  assert.equal(isSwaggerEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }), true);
  assert.equal(isSwaggerEnabled({ NODE_ENV: 'development' }), true);
});

function resolveOrigin(
  originValidator: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void,
  origin: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    originValidator(origin, (error, allowed) => {
      if (error) return reject(error);
      if (!allowed) return reject(new Error('Origin was not allowed.'));
      return resolve();
    });
  });
}
