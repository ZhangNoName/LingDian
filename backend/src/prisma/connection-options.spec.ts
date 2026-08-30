import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createMariaDbConnectionConfig } from '@lingdian/db';

test('database connection config preserves local MySQL authentication options', () => {
  const config = createMariaDbConnectionConfig(
    'mysql://local%40user:p%24ss@db:3306/lingdian?allowPublicKeyRetrieval=true',
  );

  assert.equal(config.host, 'db');
  assert.equal(config.port, 3306);
  assert.equal(config.user, 'local@user');
  assert.equal(config.password, 'p$ss');
  assert.equal(config.database, 'lingdian');
  assert.equal(config.allowPublicKeyRetrieval, true);
  assert.equal(config.ssl, undefined);
});

test('external database config loads its CA and enforces certificate and hostname verification', () => {
  const certificateDirectory = mkdtempSync(join(tmpdir(), 'lingdian-db-tls-'));
  try {
    const certificate = [
      '-----BEGIN CERTIFICATE-----',
      'test-only-ca',
      '-----END CERTIFICATE-----',
      '',
    ].join('\n');
    writeFileSync(join(certificateDirectory, 'provider-ca.pem'), certificate, { mode: 0o600 });

    const config = createMariaDbConnectionConfig(
      'mysql://service:secret@db.example.test:3307/lingdian?sslaccept=strict&sslcert=provider-ca.pem',
      { certificateDirectory },
    );
    assert.equal(config.host, 'db.example.test');
    assert.equal(config.port, 3307);
    assert.equal(typeof config.ssl, 'object');
    assert.deepEqual(config.ssl, {
      ca: certificate,
      rejectUnauthorized: true,
      servername: 'db.example.test',
    });
  } finally {
    rmSync(certificateDirectory, { recursive: true, force: true });
  }
});

test('external database TLS configuration fails closed', () => {
  const certificateDirectory = mkdtempSync(join(tmpdir(), 'lingdian-db-tls-'));
  try {
    assert.throws(
      () => createMariaDbConnectionConfig(
        'mysql://service:secret@db.example.test/lingdian?sslaccept=accept_invalid_certs&sslcert=provider-ca.pem',
        { certificateDirectory },
      ),
      /sslaccept=strict/,
    );
    assert.throws(
      () => createMariaDbConnectionConfig(
        'mysql://service:secret@db.example.test/lingdian?sslaccept=strict',
        { certificateDirectory },
      ),
      /sslcert/,
    );
    assert.throws(
      () => createMariaDbConnectionConfig(
        'mysql://service:secret@db.example.test/lingdian',
        { certificateDirectory, requireTls: true },
      ),
      /requires sslaccept=strict/,
    );
    assert.throws(
      () => createMariaDbConnectionConfig(
        'mysql://service:do-not-leak@db.example.test/lingdian?sslaccept=strict&sslcert=missing.pem',
        { certificateDirectory },
      ),
      (error: unknown) => error instanceof Error &&
        /not readable/.test(error.message) && !error.message.includes('do-not-leak'),
    );
    assert.throws(
      () => createMariaDbConnectionConfig(
        'mysql://service:secret@db.example.test/lingdian?sslaccept=strict&sslcert=..%2Foutside.pem',
        { certificateDirectory },
      ),
      /inside the database schema directory/,
    );
  } finally {
    rmSync(certificateDirectory, { recursive: true, force: true });
  }
});
