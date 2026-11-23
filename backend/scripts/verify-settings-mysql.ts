import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { IntegrationCatalogService } from '../src/modules/integrations/integration-catalog.service';
import { IntegrationsController } from '../src/modules/integrations/integrations.controller';
import { ProfileService } from '../src/modules/auth/profile.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
function catalog(db: PrismaService, stores: MultiStoreContextResolver) {
  const service = new IntegrationCatalogService(db, stores);
  (service as any).settings = [
    {
      provider: 'CASHIER',
      displayName: 'POS',
      category: 'CASHIER',
      deploymentEnabled: true,
      endpoint: 'https://example.invalid',
      signingSecret: 'synthetic-fixture',
    },
    { provider: 'RECEIPT_PRINTER', displayName: 'Print', category: 'PRINTING', deploymentEnabled: false },
  ];
  return service;
}
export async function verifySettings(db: PrismaService) {
  const storeId = 'settings-store-a',
    foreign = 'settings-store-b';
  for (const id of [storeId, foreign]) await db.store.create({ data: { id, code: id, name: id } });
  const stores = new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } })),
    scope = new MerchantStoreScope(stores),
    service = catalog(db, stores),
    controller = new IntegrationsController(service, scope),
    user: AuthenticatedUser = {
      userId: 'settings-merchant',
      sessionId: 'synthetic-settings-session',
      audience: 'merchant-api',
      roles: ['MERCHANT'],
      merchantStoreIds: [storeId],
    };
  assert.throws(() => controller.setEnabled(foreign, 'CASHIER', { enabled: true }, user), /not authorized/);
  assert.throws(() => controller.list(foreign, user), /not authorized/);
  const enabled = await controller.setEnabled(storeId, 'CASHIER', { enabled: true }, user);
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.reason_code, null);
  let audits = await db.authAuditLog.findMany({ where: { event: 'INTEGRATION_SETTING_UPDATED', userId: user.userId } });
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0].metadata, { storeId, provider: 'CASHIER', enabled: true });
  const failing = new Proxy(db, {
    get(target, key) {
      if (key === '$transaction')
        return (work: any, opts: any) =>
          target.$transaction(
            (tx) =>
              work(
                new Proxy(tx, {
                  get(inner, name) {
                    if (name === 'authAuditLog')
                      return {
                        create: async () => {
                          throw Error('synthetic audit failure');
                        },
                      };
                    return Reflect.get(inner, name);
                  },
                }),
              ),
            opts,
          );
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  await assert.rejects(catalog(failing, stores).setEnabled(storeId, 'CASHIER', false, user), /synthetic audit failure/);
  assert.equal(
    (await db.storeIntegration.findUniqueOrThrow({ where: { storeId_provider: { storeId, provider: 'CASHIER' } } }))
      .enabled,
    true,
  );
  assert.equal(
    await db.authAuditLog.count({ where: { event: 'INTEGRATION_SETTING_UPDATED', userId: user.userId } }),
    1,
  );
  await assert.rejects(controller.setEnabled(storeId, 'RECEIPT_PRINTER', { enabled: true }, user));
  assert.equal(await db.storeIntegration.count({ where: { storeId: foreign } }), 0);
  await controller.setEnabled(storeId, 'CASHIER', { enabled: false }, user);
  assert.equal((await controller.list(storeId, user))[0].enabled, false);
  assert.equal((await controller.list(storeId, user))[1].reason_code, 'DEPLOYMENT_DISABLED');
  for (const id of ['settings-user-a', 'settings-user-b']) await db.user.create({ data: { id, nickname: id } });
  const profiles = new ProfileService(db);
  assert.deepEqual(await profiles.getNickname('settings-user-a'), { nickname: 'settings-user-a' });
  await profiles.setNickname('settings-user-a', 'New display name');
  assert.equal((await profiles.getNickname('settings-user-a')).nickname, 'New display name');
  assert.equal((await profiles.getNickname('settings-user-b')).nickname, 'settings-user-b');
  console.log(
    'PASS MySQL settings: authenticated store/actor, switch audit, audit failure rollback, unavailable provider and foreign store denial, stable availability codes and scoped nickname reads/writes.',
  );
}
