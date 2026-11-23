import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { IntegrationCatalogService } from './integration-catalog.service';
import { IntegrationsController } from './integrations.controller';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
function fixture(failAudit = false) {
  let enabled = false,
    audits = 0;
  const db = {
    store: { findUnique: async () => ({ id: 'store-a' }) },
    storeIntegration: { findMany: async () => [{ provider: 'CASHIER', enabled }] },
    $transaction: async (work: any) => {
      const before = enabled;
      try {
        return await work({
          storeIntegration: {
            upsert: async ({ update }: any) => {
              enabled = update.enabled;
            },
          },
          authAuditLog: {
            create: async ({ data }: any) => {
              assert.equal(data.metadata.storeId, 'store-a');
              assert.equal(data.userId, 'merchant');
              if (failAudit) throw Error('audit failed');
              audits++;
            },
          },
        });
      } catch (e) {
        enabled = before;
        throw e;
      }
    },
  };
  const service = new IntegrationCatalogService(db as never, { resolveRequestedStoreId: (id: string) => id } as never);
  (service as any).settings = [
    {
      provider: 'CASHIER',
      displayName: 'POS',
      category: 'CASHIER',
      deploymentEnabled: true,
      endpoint: 'https://example.invalid',
      signingSecret: 'synthetic-fixture',
    },
  ];
  return { service, enabled: () => enabled, audits: () => audits };
}
test('integration switches commit with their authenticated audit and roll back on audit failure', async () => {
  const good = fixture();
  assert.equal((await good.service.setEnabled('store-a', 'CASHIER', true, { userId: 'merchant', sessionId:'synthetic-session' })).enabled, true);
  assert.equal(good.audits(), 1);
  const bad = fixture(true);
  await assert.rejects(bad.service.setEnabled('store-a', 'CASHIER', true, { userId: 'merchant', sessionId:'synthetic-session' }), /audit failed/);
  assert.equal(bad.enabled(), false);
});
test('integration controller rejects foreign stores before a write and forwards the authenticated actor', () => {
  let called = false;
  const scope = new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never);
  const user = {
    userId: 'merchant',
    audience: 'merchant-api',
    roles: ['MERCHANT'],
    merchantStoreIds: ['store-a'],
  } as never;
  const controller = new IntegrationsController(
    {
      setEnabled: (id: string, provider: string, enabled: boolean, actor: any) => {
        called = true;
        assert.equal(actor, user);
        assert.equal(id, 'store-a');
      },
    } as never,
    scope,
  );
  assert.throws(() => controller.setEnabled('foreign', 'CASHIER', { enabled: true }, user), /not authorized/);
  assert.equal(called, false);
  controller.setEnabled('store-a', 'CASHIER', { enabled: true }, user);
  assert.equal(called, true);
});
test('integration availability provides stable codes while keeping legacy reason text', async () => {
  const { service } = fixture();
  (service as any).settings = [
    { provider: 'CASHIER', displayName: 'POS', category: 'CASHIER', deploymentEnabled: false },
    { provider: 'RECEIPT_PRINTER', displayName: 'Print', category: 'PRINTING', deploymentEnabled: true },
  ];
  const rows = await service.list('store-a');
  assert.equal(rows[0].reason_code, 'DEPLOYMENT_DISABLED');
  assert.equal(rows[1].reason_code, 'NOT_CONFIGURED');
  assert.ok(rows.every((row) => !row.available && !!row.reason));
});
