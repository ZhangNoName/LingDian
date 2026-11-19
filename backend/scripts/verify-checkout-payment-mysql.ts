import { strict as assert } from 'node:assert';
import { createHmac, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
import type { PrismaService } from '../src/prisma/prisma.service';
import { AddressesService } from '../src/modules/addresses/addresses.service';
import { OrderStockService } from '../src/modules/inventory/order-stock.service';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { OrdersQueryService } from '../src/modules/orders/orders-query.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { OrderStockExpiryService } from '../src/modules/orders/order-stock-expiry.service';
import { PaymentExpiryService } from '../src/modules/payments/payment-expiry.service';
import { PaymentGatewayFactory, SignedPaymentGateway, type PaymentWebhookPayload } from '../src/modules/payments/payment.gateway';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import type { StoreContextResolver } from '../src/modules/stores/store-context.resolver';

export async function verifyCheckoutPayment(db: PrismaService, stores: StoreContextResolver) {
  const store = await db.store.create({ data: { code: 'CHECKOUT', name: 'Checkout test' } });
  const user = await db.user.create({ data: { identities: { create: {
    provider: 'PHONE', subject: '+8613800009102', phoneE164: '+8613800009102', verifiedAt: new Date(),
  } } } });
  const customer: AuthenticatedUser = { userId: user.id, sessionId: 'customer-session', audience: 'user-api', roles: ['USER'] };
  const merchant: AuthenticatedUser = { userId: 'merchant', sessionId: 'merchant-session', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: [store.id] };
  const category = await db.category.create({ data: { storeId: store.id, name: 'Coffee' } });
  const product = await db.product.create({ data: { storeId: store.id, categoryId: category.id, name: 'Latte', status: 'ACTIVE', price: 6.25 } });
  const sku = await db.productSKU.create({ data: { productId: product.id, skuName: 'Regular', price: 6.25 } });
  const material = await db.inventoryItem.create({ data: { storeId: store.id, code: 'MILK', name: 'Milk', unit: 'l', quantity: 5000, availableQuantity: 5000 } });
  await db.inventoryRecipe.create({ data: { storeId: store.id, skuId: sku.id, itemId: material.id, quantity: 1000 } });

  const scope = new MerchantStoreScope(stores);
  const stock = new OrderStockService();
  const orderService = new OrdersService(db, new AddressesService(db), stores, new OrdersQueryService(db, stores), stock);
  const orders = new OrdersController(orderService, scope);
  const secret = randomBytes(32).toString('hex');
  let onCreate: ((paymentNo: string) => Promise<void>) | undefined;
  const gateways: PaymentGatewayFactory = {
    create: account => new SignedPaymentGateway(account, 'https://test.invalid', secret, async (url, init) => {
      const input = JSON.parse(String(init?.body));
      if (onCreate && !String(url).endsWith('/close')) await onCreate(input.payment_no);
      return new Response(JSON.stringify(String(url).endsWith('/close')
        ? { status: 'CLOSED', paymentNo: input.payment_no, closureId: 'test-close', accountExternalId: account.externalAccountId, providerIntentId: input.provider_intent_id }
        : { status: 'PENDING', providerIntentId: input.payment_no, accountExternalId: account.externalAccountId, amountMinor: input.amount_minor, currency: 'CNY', clientAction: { token: 'synthetic' } }));
    }),
  };
  const expiry = new PaymentExpiryService(db, gateways);
  const payments = new PaymentsController(new PaymentsService(db, gateways, stores, expiry, stock), scope);
  const wx = await db.paymentAccount.create({ data: { storeId: store.id, provider: 'WECHAT_PAY', channel: 'WECHAT', externalAccountId: 'wx-test', connectorConfigKey: 'TEST' } });
  const ali = await db.paymentAccount.create({ data: { storeId: store.id, provider: 'ALIPAY', channel: 'ALIPAY', externalAccountId: 'ali-test', connectorConfigKey: 'TEST' } });

  function notify(account: typeof wx, paymentNo: string, event: string, type: PaymentWebhookPayload['event_type'], transactionId?: string) {
    const rawBody = Buffer.from(JSON.stringify({ event_id: event, event_type: type, payment_no: paymentNo, provider_intent_id: paymentNo,
      provider_transaction_id: transactionId, account_external_id: account.externalAccountId, amount_minor: 625, currency: 'CNY',
      occurred_at: '2026-01-01T12:00:00.000Z' }));
    const time = String(Math.floor(Date.now() / 1000));
    return payments.webhook(account.provider, account.id, { rawBody }, {
      'x-lingdian-timestamp': time, 'x-lingdian-nonce': event,
      'x-lingdian-signature': createHmac('sha256', secret).update(time + '.' + event + '.').update(rawBody).digest('hex'),
    });
  }
  const checkout = (clientRequestId: string, quantity = 1) => orders.createOrder({
    clientRequestId, storeId: store.id, orderType: 'pickup', paymentChannel: 'cash', items: [{ sku_id: sku.id, quantity }],
  }, customer);
  const status = (id: string, value: 'PAID' | 'PREPARING' | 'CANCELLED') => orders.updateMerchantOrderStatus(id, { status: value }, merchant, store.id);
  async function balance(quantity: number, reservedQuantity: number) {
    assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: material.id },
      select: { quantity: true, reservedQuantity: true, availableQuantity: true } }), {
      quantity, reservedQuantity, availableQuantity: quantity - reservedQuantity,
    });
  }

  const [cash, replay] = await Promise.all([checkout('checkout-cash'), checkout('checkout-cash')]);
  assert.equal(replay.id, cash.id);
  await balance(5000, 1000);
  await assert.rejects(checkout('checkout-short', 5), /inventory.orderInsufficient/);
  assert.equal(await db.order.count({ where: { clientRequestId: 'checkout-short' } }), 0);
  await Promise.all([status(cash.id, 'PAID'), status(cash.id, 'PAID')]);
  await Promise.all([status(cash.id, 'PREPARING'), status(cash.id, 'PREPARING')]);
  assert.equal((await orders.getMerchantOrderDetail(cash.id, merchant, store.id)).status, 'PREPARING');
  await balance(4000, 0);

  const online = await checkout('checkout-pay');
  const deadline = new Date(Date.now() + 120_000);
  await db.order.update({ where: { id: online.id }, data: { stockExpiresAt: deadline } });
  const wxRequest = { provider: wx.provider, channel: 'WECHAT' as const, clientRequestId: 'attempt-wx' };
  const first = await payments.createIntent(online.id, customer, wxRequest);
  assert.equal(first.expires_at, deadline.toISOString());
  await assert.rejects(payments.createIntent(online.id, customer, { ...wxRequest, provider: 'ALIPAY', channel: 'ALIPAY' }), /different payment method/);
  await assert.rejects(status(online.id, 'CANCELLED'), /active payment/);
  await balance(4000, 1000);
  await notify(wx, first.payment_no, 'wx-fail', 'PAYMENT_FAILED');
  const second = await payments.createIntent(online.id, customer, { provider: 'ALIPAY', channel: 'ALIPAY', clientRequestId: 'attempt-ali' });

  // Fail after the real inventory writes, before transaction commit. Redelivery must resume the saved event.
  const commit = stock.commit.bind(stock);
  stock.commit = async (...args) => { await commit(...args); throw new Error('simulated interruption'); };
  const success = () => notify(wx, first.payment_no, 'wx-success', 'PAYMENT_SUCCEEDED', 'wx-charge');
  try { await assert.rejects(success(), /simulated interruption/); } finally { stock.commit = commit; }
  await balance(4000, 1000);
  assert.equal((await orders.getMerchantOrderDetail(online.id, merchant, store.id)).status, 'PENDING_PAYMENT');
  await Promise.all([success(), success()]);
  assert.equal((await success()).duplicate, true);
  await status(online.id, 'PREPARING');
  assert.equal((await payments.getIntent(second.payment_no, customer)).client_action, null);
  assert.equal((await payments.createIntent(online.id, customer, { provider: 'ALIPAY', channel: 'ALIPAY', clientRequestId: 'attempt-ali' })).client_action, null);
  assert.equal((await orders.getMerchantOrderDetail(online.id, merchant, store.id)).payment_channel, 'WECHAT');
  await notify(ali, second.payment_no, 'ali-success', 'PAYMENT_SUCCEEDED', 'ali-charge');
  await notify(ali, second.payment_no, 'ali-repeat', 'PAYMENT_SUCCEEDED', 'ali-charge');
  const receipts = await db.paymentIntent.findMany({ where: { orderId: online.id }, orderBy: { channel: 'asc' } });
  assert.equal(receipts.find(p => p.channel === 'WECHAT')?.reconciliationStatus, 'MATCHED');
  assert.equal(receipts.find(p => p.channel === 'ALIPAY')?.failureCode, 'DUPLICATE_PAYMENT');
  assert.equal(await db.paymentTransaction.count({ where: { paymentIntent: { orderId: online.id } } }), 2);
  assert.equal(await db.orderStatusLog.count({ where: { orderId: online.id, toStatus: 'PAID' } }), 1);
  await notify(wx, first.payment_no, 'wx-second-charge', 'PAYMENT_SUCCEEDED', 'another-wx-charge');
  assert.equal((await db.paymentIntent.findUniqueOrThrow({ where: { paymentNo: first.payment_no } })).reconciliationStatus, 'MANUAL_REVIEW');
  await balance(3000, 0);

  const expired = await checkout('checkout-timeout');
  const pending = await payments.createIntent(expired.id, customer, wxRequest);
  const past = new Date(Date.now() - 1000);
  await db.order.update({ where: { id: expired.id }, data: { stockExpiresAt: past } });
  await db.paymentIntent.update({ where: { paymentNo: pending.payment_no }, data: { expiresAt: past } });
  await assert.rejects(payments.createIntent(expired.id, customer, { ...wxRequest, clientRequestId: 'after-expiry' }), /reservation has expired/);
  await new OrderStockExpiryService(db, expiry, orderService, stores).flush();
  assert.equal((await orders.getMerchantOrderDetail(expired.id, merchant, store.id)).status, 'TIMED_OUT');
  await notify(wx, pending.payment_no, 'late-capture', 'PAYMENT_SUCCEEDED', 'late-charge');
  assert.equal((await db.paymentIntent.findUniqueOrThrow({ where: { paymentNo: pending.payment_no } })).reconciliationStatus, 'LATE_PAYMENT');
  await balance(3000, 0);

  const racing = await checkout('checkout-racing');
  const racingIntent = await payments.createIntent(racing.id, customer, wxRequest);
  await notify(wx, racingIntent.payment_no, 'race-failed', 'PAYMENT_FAILED');
  const [cancel, capture] = await Promise.allSettled([
    status(racing.id, 'CANCELLED'),
    notify(wx, racingIntent.payment_no, 'race-succeeded', 'PAYMENT_SUCCEEDED', 'race-charge'),
  ]);
  assert.equal(capture.status, 'fulfilled');
  const final = await orders.getMerchantOrderDetail(racing.id, merchant, store.id);
  const paid = final.status === 'PAID';
  assert.equal(final.status, paid ? 'PAID' : 'CANCELLED');
  assert.equal(cancel.status, paid ? 'rejected' : 'fulfilled');
  const receipt = await db.paymentIntent.findUniqueOrThrow({ where: { paymentNo: racingIntent.payment_no } });
  assert.equal(receipt.reconciliationStatus, paid ? 'MATCHED' : 'LATE_PAYMENT');
  await balance(paid ? 2000 : 3000, 0);
  const lostReply = await checkout('checkout-lost-reply');
  onCreate = async (paymentNo) => {
    await notify(wx, paymentNo, 'success-before-disconnect', 'PAYMENT_SUCCEEDED', 'confirmed-charge');
    throw new Error('simulated lost connector response');
  };
  const confirmed = await payments.createIntent(lostReply.id, customer, wxRequest);
  assert.equal(confirmed.status, 'SUCCEEDED');
  assert.equal(confirmed.client_action, null);
  await balance(paid ? 1000 : 2000, 0);
  console.log('PASS MySQL checkout to merchant: cash and online acceptance, retries, stock rollback, competing payment channels, expiry and late receipts.');
}
