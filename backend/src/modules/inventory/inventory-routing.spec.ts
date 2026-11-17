import { InventoryUsageService } from './inventory-usage.service';
import 'reflect-metadata';
import { test } from 'node:test';
import assert = require('node:assert/strict');
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/auth/access-token.guard';
import { MerchantGuard } from '../../common/auth/merchant.guard';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryLifecycleService } from './inventory-lifecycle.service';
import { InventoryReportService } from './inventory-report.service';
import { InventoryRecipeService } from './inventory-recipe.service';
import { InventoryAlertService } from './inventory-alert.service';
import { PurchasingController } from './purchasing/purchasing.controller';
import { PurchasingService } from './purchasing/purchasing.service';
import { SupplierService } from './purchasing/supplier.service';
import { PurchasingAnalysisService } from './purchasing/purchasing-analysis.service';
test('material detail routes coexist with purchasing and suppliers, and lifecycle HTTP bodies reject coercion and unknown writes', async () => {
  const writes: unknown[] = [];
  const module = await Test.createTestingModule({
    controllers: [InventoryController, PurchasingController],
    providers: [
      { provide: InventoryUsageService, useValue: { usage: () => ({ route: 'usage' }) } }, { provide: InventoryService, useValue: {} }, { provide: InventoryReportService, useValue: {} },
      { provide: InventoryRecipeService, useValue: { detail: () => ({ route: 'recipe' }) } }, { provide: InventoryAlertService, useValue: {} },
      { provide: PurchasingAnalysisService, useValue: {} },
      { provide: PurchasingService, useValue: { list: () => ({ route: 'purchases' }) } },
      { provide: SupplierService, useValue: { list: () => ({ route: 'suppliers' }) } },
      { provide: InventoryLifecycleService, useValue: { detail: (_user: unknown, store: string, id: string) => ({ store, id }), change: (_user: unknown, store: string, id: string, body: unknown) => { writes.push({ ...(body as Record<string, unknown>) }); return { store, id }; } } },
    ],
  }).overrideGuard(AccessTokenGuard).useValue({ canActivate: () => true }).overrideGuard(MerchantGuard).useValue({ canActivate: () => true }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  try {
    const root = await app.getUrl(), base = root + '/merchant/stores/store-a/inventory';
    assert.deepEqual(await (await fetch(base + '/purchases')).json(), { route: 'purchases' });
    assert.deepEqual(await (await fetch(base + '/suppliers')).json(), { route: 'suppliers' });
    assert.deepEqual(await (await fetch(base + '/items/material-a')).json(), { store: 'store-a', id: 'material-a' });
    assert.deepEqual(await (await fetch(base + '/items/material-a/usage?view=PURCHASES&page=2')).json(), { route: 'usage' });
    assert.equal((await fetch(base + '/items/material-a/usage?view=bad')).status, 400);
    assert.deepEqual(await (await fetch(base + '/recipes/sku-a')).json(), { route: 'recipe' });
    const body = { isActive: false, expectedVersion: 2, reason: ' Retired ' };
    const put = (data: unknown) => fetch(base + '/items/material-a/lifecycle', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await put(body)).status, 200);
    assert.deepEqual(writes, [{ isActive: false, expectedVersion: 2, reason: 'Retired' }]);
    for (const patch of [{ isActive: 'false' }, { expectedVersion: '2' }, { quantity: 0 }, { storeId: 'foreign' }]) assert.equal((await put({ ...body, ...patch })).status, 400);
    assert.equal(writes.length, 1);
  } finally { await app.close(); }
});
