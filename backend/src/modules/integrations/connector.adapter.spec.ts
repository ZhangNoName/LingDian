import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { OrderCreatedIntegrationEvent } from '@lingdian/contracts';
import { SignedConnectorAdapter } from './connector.adapter';

const event: OrderCreatedIntegrationEvent = {
  event_id: 'event-1', event_type: 'order.created', schema_version: 1,
  occurred_at: '2026-08-29T00:00:00.000Z', store_id: 'store-1',
  order: {
    id: 'order-1', order_no: 'LD1', order_type: 'PICKUP', status: 'PENDING_PAYMENT',
    order_source: 'MEITUAN_WAIMAI', pickup_code: 'MT-00001', pickup_business_date: '2026-08-29',
    payment_channel: 'CASH', total_amount: 20, payable_amount: 20,
    customer_name: '顾客', customer_mobile: '13800000000', delivery_address: null, remark: null,
    items: [],
  },
};

test('connector delivery is versioned, idempotent and HMAC signed', async () => {
  let captured: { input: string | URL | Request; init?: RequestInit } | undefined;
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    captured = { input, init };
    return new Response(null, { status: 202 });
  }) as typeof fetch;
  const adapter = new SignedConnectorAdapter({
    provider: 'CASHIER', displayName: '收银系统', category: 'CASHIER', deploymentEnabled: true,
    endpoint: 'https://connector.example/events', signingSecret: '12345678901234567890123456789012',
  }, fetcher);

  await adapter.deliver(event);

  assert.equal(captured?.input, 'https://connector.example/events');
  const headers = captured?.init?.headers as Record<string, string>;
  assert.equal(headers['X-LingDian-Event-Id'], 'event-1');
  assert.match(headers['X-LingDian-Signature'], /^sha256=[0-9a-f]{64}$/);
  const payload = JSON.parse(captured?.init?.body as string);
  assert.equal(payload.schema_version, 1);
  assert.equal(payload.order.order_source, 'MEITUAN_WAIMAI');
  assert.equal(payload.order.pickup_code, 'MT-00001');
});

test('connector failures expose status only and never persist a response body', async () => {
  const adapter = new SignedConnectorAdapter({
    provider: 'JD_DAOJIA', displayName: '京东到家连接器', category: 'DELIVERY', deploymentEnabled: true,
    endpoint: 'https://connector.example/events', signingSecret: '12345678901234567890123456789012',
  }, (async () => new Response('secret response', { status: 503 })) as typeof fetch);

  await assert.rejects(adapter.deliver(event), (error: Error) => {
    assert.equal(error.message, 'Connector returned HTTP 503');
    assert.doesNotMatch(error.message, /secret response/);
    return true;
  });
});
