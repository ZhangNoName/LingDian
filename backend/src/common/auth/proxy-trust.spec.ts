import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ExpressAdapter } from '@nestjs/platform-express';

// Resolve the actual Express dependency used by Nest; do not add a second implementation just for tests.
const platformRequire = createRequire(require.resolve('@nestjs/platform-express/package.json'));
const expressRequire = createRequire(platformRequire.resolve('express'));
const proxy = expressRequire('proxy-addr') as {
  compile(value: string): (ip: string, index: number) => boolean;
};

test('mapped IPv6 trust ranges never turn unrelated IPv4 clients into trusted proxies', () => {
  for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
    const trust = proxy.compile(subnet);
    assert.equal(trust('198.51.100.10', 0), false);
    assert.equal(trust('203.0.113.15', 0), false);
  }
  const correct = proxy.compile('::ffff:10.0.0.0/104');
  assert.equal(correct('10.2.3.4', 0), true);
  assert.equal(correct('198.51.100.10', 0), false);
  const loopback = proxy.compile('loopback');
  assert.equal(loopback('::ffff:127.0.0.1', 0), true);
  assert.equal(loopback('198.51.100.10', 0), false);
});

test('one-hop Express trust uses the last forwarded client, ignoring an injected earlier address', async () => {
  await verifyHttpTrust(1, '198.51.100.10', ['198.51.100.10']);
});

test('disabled Express proxy trust ignores forwarded addresses entirely', async () => {
  await verifyHttpTrust(0, '127.0.0.1', []);
});

async function verifyHttpTrust(hops: number, expectedIp: string, expectedIps: string[]) {
  const adapter = new ExpressAdapter();
  const app = adapter.getInstance();
  app.set('trust proxy', hops);
  app.get('/ip', (request: IncomingMessage & { ip: string; ips: string[] }, response: ServerResponse) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ ip: request.ip, ips: request.ips }));
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const result = await fetch(`http://127.0.0.1:${address.port}/ip`, {
      headers: { 'X-Forwarded-For': '203.0.113.15, 198.51.100.10' },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { ip: expectedIp, ips: expectedIps });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
