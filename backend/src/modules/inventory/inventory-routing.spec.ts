import { InventoryTrendService } from './trend/inventory-trend.service';
import { InventoryMaterialService } from './inventory-material.service';
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
      { provide: InventoryTrendService, useValue: { report: () => ({ route: 'trend' }) } },
      { provide: InventoryMaterialService, useValue: { rename: (_user: unknown, store: string, id: string, body: unknown) => ({ store, id, body }), changes: () => ({ route: 'changes' }) } },
      { provide: InventoryUsageService, useValue: { usage: () => ({ route: 'usage' }) } }, { provide: InventoryService, useValue: {} }, { provide: InventoryReportService, useValue: {} },
      { provide: InventoryRecipeService, useValue: { detail: () => ({ route: 'recipe' }) } }, { provide: InventoryAlertService, useValue: { detail: (_user: unknown, store: string, id: string) => ({ store, id, route: 'alert' }), list: () => ({ route: 'alerts' }) } },
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
    assert.deepEqual(await (await fetch(base + '/alerts')).json(), { route: 'alerts' });
    assert.deepEqual(await (await fetch(base + '/alerts/alert-a')).json(), { store: 'store-a', id: 'alert-a', route: 'alert' });
    assert.deepEqual(await (await fetch(base + '/items/material-a/changes?kind=NAME&page=2')).json(), { route: 'changes' });
    assert.equal((await fetch(base + '/items/material-a/changes?kind=AUTH_LOGIN')).status, 400);
    const rename = (data: unknown) => fetch(base + '/items/material-a/name', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const renamed = await rename({ name: ' New name ', expectedVersion: 0, reason: ' Correction ' });
    assert.equal(renamed.status, 200); assert.deepEqual(await renamed.json(), { store: 'store-a', id: 'material-a', body: { name: 'New name', expectedVersion: 0, reason: 'Correction' } });
    for (const patch of [{ unit: 'new unit' }, { code: 'new code' }, { storeId: 'foreign' }, { quantity: 9 }, { expectedVersion: '0' }, { reason: ' ' }]) assert.equal((await rename({ name: 'New', expectedVersion: 0, reason: 'Correction', ...patch })).status, 400);
    assert.deepEqual(await (await fetch(base + '/items/material-a/trend?startAt=2026-01-01T00:00:00Z&endAt=2026-01-02T00:00:00Z&timeZone=UTC')).json(), { route: 'trend' });
    assert.equal((await fetch(base + '/items/material-a/trend?fromDate=2026-01-01&toDate=2026-01-02&timeZone=UTC&page=1')).status, 400);
    const body = { isActive: false, expectedVersion: 2, reason: ' Retired ' };
    const put = (data: unknown) => fetch(base + '/items/material-a/lifecycle', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await put(body)).status, 200);
    assert.deepEqual(writes, [{ isActive: false, expectedVersion: 2, reason: 'Retired' }]);
    for (const patch of [{ isActive: 'false' }, { expectedVersion: '2' }, { quantity: 0 }, { storeId: 'foreign' }]) assert.equal((await put({ ...body, ...patch })).status, 400);
    assert.equal(writes.length, 1);
  } finally { await app.close(); }
});
