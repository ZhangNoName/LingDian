import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { syncInventoryAlert } from './inventory-alert-state';
import { InventoryAlertService } from './inventory-alert.service';
import { AcknowledgeInventoryAlertDto, InventoryAlertQueryDto } from './dto/inventory-alert.dto';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.type';
const user: AuthenticatedUser = { userId: 'merchant', sessionId: 's', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['store-a'] };
function fixture() {
  const rows: any[] = [], audits: any[] = [], locks: string[] = [];
  const scope = new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never);
  const balance = { id: 'item-a', storeId: 'store-a', availableQuantity: 500, reorderPoint: 1000 };
  const match = (where: any) => rows.find(row => where.activeItemKey ? row.activeItemKey === where.activeItemKey : where.id_storeId ? row.id === where.id_storeId.id && row.storeId === where.id_storeId.storeId : row.id === where.id);
  const included = (row: any) => ({ ...row, item: { name: 'Flour', code: 'RM-001', unit: 'kg' } });
  const tx: any = {
    inventoryAlert: {
      findUnique: async ({ where }: any) => { const row = match(where); return row ? { ...row } : null; },
      findUniqueOrThrow: async ({ where, include }: any) => { const row = match(where); if (!row) throw Error('not found'); return include ? included(row) : { ...row }; },
      create: async ({ data }: any) => { const row = { id: 'alert-'+rows.length, status: 'OPEN', version: 0, detectedAt: new Date(), updatedAt: new Date(), acknowledgedAt: null, acknowledgedBy: null, note: null, resolvedAt: null, ...data }; rows.push(row); return { ...row }; },
      update: async ({ where, data, include }: any) => { locks.push('alert'); const row = match(where); Object.assign(row, { ...data, version: row.version + (data.version?.increment ?? 0), updatedAt: new Date() }); return include ? included(row) : { ...row }; },
    },
    inventoryItem: { updateMany: async ({ where }: any) => { assert.equal(where.storeId, 'store-a'); locks.push('material'); return { count: 1 }; } },
    authAuditLog: { create: async ({ data }: any) => { audits.push(data); return data; } },
  };
  const service = new InventoryAlertService({ ...tx, $transaction: (work: any) => work(tx) } as never, scope);
  return { balance, rows, audits, locks, service, sync: (changes = {}) => syncInventoryAlert(tx, { ...balance, ...changes }, user.userId) };
}
test('shortage creates one episode and repeated stock notifications do not duplicate it', async () => {
  const f = fixture(); await f.sync(); await f.sync();
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].severity, 'LOW'); assert.equal(f.rows[0].version, 0);
  await f.sync({ availableQuantity: 400 });
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].availableAtTrigger, 500); assert.equal(f.rows[0].availableLatest, 400);
});
test('acknowledgement records an actor and note, retries once, and never resolves stock', async () => {
  const f = fixture(); await f.sync();
  const result = await f.service.acknowledge(user, 'store-a', f.rows[0].id, { expectedVersion: 0, note: 'Delivery tomorrow' });
  assert.equal(result.status, 'ACKNOWLEDGED'); assert.equal(result.availableLatest, 0.5);
  assert.deepEqual(f.locks, ['material', 'alert']); assert.equal(result.acknowledgedBy, user.userId);
  await f.service.acknowledge(user, 'store-a', f.rows[0].id, { expectedVersion: 0, note: 'Delivery tomorrow' });
  assert.equal(f.audits.length, 1);
  await assert.rejects(f.service.acknowledge({ ...user, userId: 'other' }, 'store-a', f.rows[0].id, { expectedVersion: 0, note: 'Delivery tomorrow' }), /inventory.alertStale/);
});
test('escalation reopens an acknowledged shortage and keeps the last follow-up', async () => {
  const f = fixture(); await f.sync();
  await f.service.acknowledge(user, 'store-a', f.rows[0].id, { expectedVersion: 0, note: 'Supplier called' });
  await f.sync({ availableQuantity: 0 });
  assert.equal(f.rows[0].status, 'OPEN'); assert.equal(f.rows[0].severity, 'OUT'); assert.equal(f.rows[0].note, 'Supplier called');
  assert.ok(f.audits.some(row => row.event === 'INVENTORY_ALERT_ESCALATED'));
  await assert.rejects(f.service.acknowledge(user, 'store-a', f.rows[0].id, { expectedVersion: 0, note: 'old screen' }), /inventory.alertStale/);
});
test('recovery resolves the episode, preserves evidence and allows a new episode', async () => {
  const f = fixture(); await f.sync(); await f.sync({ availableQuantity: 2000 });
  assert.equal(f.rows[0].status, 'RESOLVED'); assert.equal(f.rows[0].activeItemKey, null); assert.ok(f.rows[0].resolvedAt);
  assert.equal(f.rows[0].availableAtTrigger, 500); assert.equal(f.rows[0].availableLatest, 2000);
  await assert.rejects(f.service.acknowledge(user, 'store-a', f.rows[0].id, { expectedVersion: f.rows[0].version, note: 'too late' }), /inventory.alertStale/);
  await f.sync(); assert.equal(f.rows.length, 2); assert.equal(f.rows[1].activeItemKey, 'item-a');
});
test('zero threshold still alerts on zero, while lowering the threshold can recover a positive balance', async () => {
  const f = fixture(); await f.sync(); await f.sync({ reorderPoint: 0 });
  assert.equal(f.rows[0].status, 'RESOLVED');
  await f.sync({ availableQuantity: 0, reorderPoint: 0 }); assert.equal(f.rows[1].severity, 'OUT');
});
test('alert actions reject foreign stores and objects before acquiring material locks', async () => {
  const f = fixture(); await f.sync();
  await assert.rejects(f.service.list(user, 'store-b', new InventoryAlertQueryDto()), /not authorized/);
  await assert.rejects(f.service.acknowledge(user, 'store-b', f.rows[0].id, { expectedVersion: 0, note: 'x' }), /not authorized/);
  await assert.rejects(f.service.acknowledge(user, 'store-a', 'foreign-alert', { expectedVersion: 0, note: 'x' }), /inventory.alertNotFound/);
  assert.deepEqual(f.locks, []);
  await assert.rejects(f.sync({ storeId: 'store-b' }), /tenant mismatch/);
});
test('alert DTO rejects blank or oversized notes, invalid versions, statuses and pages', () => {
  for (const body of [{ expectedVersion: 0, note: '  ' }, { expectedVersion: -1, note: 'x' }, { expectedVersion: 1.5, note: 'x' }, { expectedVersion: 0, note: 'x'.repeat(241) }]) assert.ok(validateSync(plainToInstance(AcknowledgeInventoryAlertDto, body)).length);
  assert.equal(validateSync(plainToInstance(AcknowledgeInventoryAlertDto, { expectedVersion: 0, note: ' Planned ' })).length, 0);
  assert.equal(plainToInstance(AcknowledgeInventoryAlertDto, { note: ' Planned ' }).note, 'Planned');
  for (const query of [{ status: 'CLOSED' }, { severity: 'HEALTHY' }, { page: '0' }, { pageSize: '101' }]) assert.ok(validateSync(plainToInstance(InventoryAlertQueryDto, query)).length);
});
