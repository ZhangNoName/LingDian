import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { OrderPickupNotificationService } from './order-pickup-notification.service';
import { readPickupTemplate, sendWechatPickup } from './pickup-notification-wechat';

const config = new ConfigService({
  WECHAT_PICKUP_NOTIFICATION_TEMPLATE_ID: 'pickup-template',
  WECHAT_PICKUP_NOTIFICATION_FIELDS: '{"character_string1":"pickupCode","thing2":"storeName"}',
});
const customer = 'customer-a';
const fixtureOrder = {
  id: 'order-a', status: 'PREPARING', orderSource: 'MINIAPP', orderType: 'PICKUP',
  pickupCode: 'U-0001', pickupNotification: null, updatedAt: new Date(),
};

test('registration is scoped to the order owner and verifies union identity before storing the app open ID', async t => {
  const created: unknown[] = [];
  let linked = false;
  let registered = false;
  const tx = {
    $queryRaw: async () => [],
    order: { findFirst: async () => ({ ...fixtureOrder, status: 'READY', pickupNotification: registered ? { orderId: 'order-a' } : null }) },
    orderPickupNotification: { create: async ({ data }: { data: unknown }) => { registered = true; created.push(data); } },
  };
  const db = {
    order: { findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      assert.equal(where.storeId, 'store-a');
      return where.customerUserId === customer ? { ...fixtureOrder, pickupNotification: registered ? { orderId: 'order-a' } : null } : null;
    } },
    authIdentity: { findFirst: async ({ where }: { where: unknown }) => {
      assert.deepEqual(where, {
        provider: 'WECHAT', subject: { in: ['verified-union', 'wxapp:mini-program-open-id'] },
        userId: customer, verifiedAt: { not: null },
      });
      return linked ? { id: 'identity' } : null;
    } },
    $transaction: async (work: (client: unknown) => unknown) => work(tx),
  };
  const wechat = {
    provider: 'WECHAT', miniProgramAppId: 'wxapp', isMiniProgramConfigured: () => true,
    exchangeMiniProgramCode: async ({ code }: { code: string }) => {
      assert.equal(code, 'fresh-login');
      return { openId: 'mini-program-open-id', unionId: 'verified-union' };
    },
  };
  const service = new OrderPickupNotificationService(db as never, wechat as never, { mode: 'single', primaryStoreId: () => 'store-a' } as never, config);
  const kick = t.mock.method(service, 'kick', () => undefined);
  await assert.rejects(service.getSubscription('order-a', 'different-customer'), /Order not found/);
  await assert.rejects(service.subscribe('order-a', customer, 'other-template', 'fresh-login'), /无法订阅/);
  await assert.rejects(service.subscribe('order-a', customer, 'pickup-template', 'fresh-login'), /绑定的微信账号/);
  assert.equal(created.length, 0);
  linked = true;
  assert.deepEqual(await service.subscribe('order-a', customer, 'pickup-template', 'fresh-login'), { template_id: 'pickup-template', subscribed: true });
  assert.deepEqual(created, [{
    orderId: 'order-a', customerUserId: customer, templateId: 'pickup-template', recipientOpenId: 'mini-program-open-id',
    status: 'PENDING', readyAt: fixtureOrder.updatedAt,
  }]);
  await service.subscribe('order-a', customer, 'pickup-template', 'unused-on-duplicate');
  assert.equal(kick.mock.callCount(), 1);
});

test('delivery uses the approved template and rechecks that the order is still ready before sending', async t => {
  const sent: unknown[] = [];
  const result: string[] = [];
  let orderStatus = 'COMPLETED';
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_input: URL, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return Response.json({ errcode: 0 });
  });
  const db = { orderPickupNotification: {
    findMany: async () => [{ orderId: 'order-a', attempts: 0 }],
    findUnique: async () => ({
      templateId: 'pickup-template', recipientOpenId: 'openid', customerUserId: customer, attempts: 1,
      order: { ...fixtureOrder, status: orderStatus, customerUserId: customer, orderNo: 'LD123', store: { name: '测试门店' }, customerUser: { status: 'ACTIVE' } },
    }),
    updateMany: async ({ data }: { data: { status: string } }) => { result.push(data.status); return { count: 1 }; },
  } };
  const service = new OrderPickupNotificationService(db as never, {
    isMiniProgramConfigured: () => true,
    getMiniAccessToken: async () => 'test-token',
  } as never, { mode: 'multi' } as never, config);
  await service.flush();
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(result[result.length - 1], 'SKIPPED');
  orderStatus = 'READY';
  await service.flush();
  assert.deepEqual(sent, [{
    touser: 'openid', template_id: 'pickup-template', miniprogram_state: 'formal', lang: 'zh_CN',
    page: 'pages/order-detail/order-detail?id=order-a',
    data: { character_string1: { value: 'U-0001' }, thing2: { value: '测试门店' } },
  }]);
  assert.equal(result[result.length - 1], 'SENT');
});

test('WeChat rejection ends the delivery and an ambiguous transport failure is never retried', async t => {
  let mode: 'denied' | 'timeout' = 'denied';
  const mockedFetch = t.mock.method(globalThis, 'fetch', async () => {
    if (mode === 'timeout') throw new Error('request outcome unknown');
    return Response.json({ errcode: 43101 });
  });
  const send = () => sendWechatPickup({ getMiniAccessToken: async () => 'test-token' } as never,
    readPickupTemplate(config)!, 'openid', 'order-a',
    { pickupCode: 'U-0001', storeName: '店', orderNo: 'LD123', readyAt: '' });
  assert.deepEqual(await send(), { status: 'SKIPPED', code: 43101 });
  mode = 'timeout';
  assert.deepEqual(await send(), { status: 'UNKNOWN' });
  assert.equal(mockedFetch.mock.callCount(), 2);
});

test('a disabled pickup channel does not use notification storage or WeChat', async () => {
  const disabled = new ConfigService({ WECHAT_PICKUP_NOTIFICATION_TEMPLATE_ID: '', WECHAT_PICKUP_NOTIFICATION_FIELDS: '' });
  const service = new OrderPickupNotificationService({} as never, {} as never, {} as never, disabled);
  assert.equal(await service.getSubscription('order-a', customer), null);
  assert.equal(await service.enqueueReady({} as never, 'order-a'), false);
  await service.flush();
});
