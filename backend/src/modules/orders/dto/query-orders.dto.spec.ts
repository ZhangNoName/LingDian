import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ORDER_QUERY_PAYMENT_CHANNELS, QueryOrdersDto } from './query-orders.dto';

test('order query accepts every persisted online payment channel', async () => {
  for (const paymentChannel of ORDER_QUERY_PAYMENT_CHANNELS) {
    const dto = plainToInstance(QueryOrdersDto, { paymentChannel });
    assert.deepEqual(await validate(dto), [], `${paymentChannel} should be queryable`);
  }
});

test('order query rejects an unknown payment channel', async () => {
  const dto = plainToInstance(QueryOrdersDto, { paymentChannel: 'CRYPTO' });
  assert.ok((await validate(dto)).length > 0);
});
