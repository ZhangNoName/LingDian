import assert = require('node:assert/strict');
import { test } from 'node:test';
import { deflateSync, gzipSync } from 'node:zlib';
import { Body, Controller, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { Test } from '@nestjs/testing';

@Controller('parser')
class ParserFixtureController {
  @Post()
  parse(@Body() body: unknown, @Req() request: RawBodyRequest<unknown>) {
    return { body, rawBody: request.rawBody?.toString('utf8') };
  }
}

test('Nest preserves the original JSON bytes for raw-body consumers', async () => {
  const module = await Test.createTestingModule({ controllers: [ParserFixtureController] }).compile();
  const app = module.createNestApplication({ logger: false, rawBody: true });
  try {
    await app.listen(0, '127.0.0.1');
    const endpoint = `${await app.getUrl()}/parser`;
    const rawBody = '{\n  "order": "示例订单", "amount": 1.125\n}\n';
    const bytes = Buffer.from(rawBody);
    const requests = [
      { encoding: 'identity', body: bytes },
      { encoding: 'gzip', body: gzipSync(bytes) },
      { encoding: 'deflate', body: deflateSync(bytes) },
    ];
    for (const { encoding, body } of requests) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': encoding },
        body: new Uint8Array(body),
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(response.status, 201, encoding);
      assert.deepEqual(await response.json(), { body: JSON.parse(rawBody), rawBody }, encoding);
    }
  } finally {
    await app.close();
  }
});
