/** Opt-in migration replay. Never reads .env or DATABASE_URL; refuses existing tables. */
import 'reflect-metadata';
import assert = require('node:assert/strict');
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createConnection } from 'mariadb';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createMariaDbConnectionConfig, PrismaClient } from '@lingdian/db';
async function main() {
  const raw = process.env.INVENTORY_MATERIAL_MIGRATION_DATABASE_URL;
  if (!raw) throw Error('INVENTORY_MATERIAL_MIGRATION_DATABASE_URL is required.');
  const url = new URL(raw);
  if (url.protocol !== 'mysql:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !/^\/lingdian_inventory_[a-z0-9_]*test$/.test(url.pathname)) throw Error('Refusing non-local or non-test migration target.');
  const config = createMariaDbConnectionConfig(raw), connection = await createConnection({ ...config, multipleStatements: true });
  const db = new PrismaClient({ adapter: new PrismaMariaDb(config) });
  try {
    assert.equal((await connection.query('SHOW TABLES')).length, 0, 'Refusing a database containing existing tables.');
    const root = resolve(__dirname, '../../packages/db/prisma/migrations');
    const names = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    const target = '20261118_zzzzz_inventory_material_changes', index = names.indexOf(target);
    assert.ok(index > 0);
    for (const name of names.slice(0, index)) await connection.query(await readFile(resolve(root, name, 'migration.sql'), 'utf8'));
    for (const id of ['material-migration-a', 'material-migration-b']) await db.store.create({ data: { id, code: id, name: id } });
    const item = await db.inventoryItem.create({ data: { id: 'legacy-material', storeId: 'material-migration-a', code: 'LEGACY', name: 'Legacy material', unit: 'kg', isActive: false } });
    const metadata = { storeId: item.storeId, itemId: item.id, isActive: false, expectedVersion: 3, reason: 'Historical retirement' };
    const at = new Date('2026-11-17T01:02:03.123Z');
    const rows = [
      { id: 'legacy-valid-archive', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata },
      { id: 'legacy-valid-restore', event: 'INVENTORY_MATERIAL_RESTORED', metadata: { ...metadata, isActive: true, expectedVersion: 4, reason: 'Historical restore' } },
      { id: 'legacy-unknown-version', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: { ...metadata, expectedVersion: 'unknown' } },
      { id: 'legacy-wrong-store', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: { ...metadata, storeId: 'material-migration-b' } },
      { id: 'legacy-missing-item', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: { ...metadata, itemId: 'missing' } },
      { id: 'legacy-invalid-state', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: { ...metadata, isActive: 'false' } },
      { id: 'legacy-mismatched-state', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: { ...metadata, isActive: true } },
      { id: 'legacy-invalid-reason', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: { ...metadata, reason: ['invalid'] } },
      { id: 'legacy-long-reason', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: { ...metadata, reason: 'x'.repeat(241) } },
      { id: 'legacy-blank-reason', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: { ...metadata, reason: '  ' } },
      { id: 'legacy-array', event: 'INVENTORY_MATERIAL_ARCHIVED', metadata: [] },
      { id: 'legacy-unrelated', event: 'AUTH_LOGIN', metadata: { ...metadata, privateValue: 'must not enter material history' } },
    ];
    for (const row of rows) await db.authAuditLog.create({ data: { ...row, userId: row.id === 'legacy-valid-restore' ? null : 'historical-actor', createdAt: at } });
    const auditsBefore = await db.authAuditLog.findMany({ orderBy: { id: 'asc' } });
    await connection.query(await readFile(resolve(root, target, 'migration.sql'), 'utf8'));
    const actual = await db.inventoryMaterialChange.findMany({ orderBy: { id: 'asc' } });
    assert.deepEqual(actual.map(row => row.id), ['legacy-unknown-version', 'legacy-valid-archive', 'legacy-valid-restore']);
    const archive = actual.find(row => row.id === 'legacy-valid-archive')!;
    assert.equal(archive.versionBefore, 3); assert.equal(archive.createdAt.toISOString(), at.toISOString());
    assert.equal(archive.actorId, 'historical-actor'); assert.equal(archive.reason, metadata.reason);
    assert.deepEqual([archive.isActiveBefore, archive.isActiveAfter, archive.nameBefore, archive.nameAfter], [true, false, null, null]);
    assert.equal(actual.find(row => row.id === 'legacy-unknown-version')!.versionBefore, null);
    assert.equal(actual.find(row => row.id === 'legacy-valid-restore')!.actorId, null);
    assert.deepEqual(await db.authAuditLog.findMany({ orderBy: { id: 'asc' } }), auditsBefore);
    assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }), item);
    await assert.rejects(db.inventoryMaterialChange.create({ data: { storeId: 'material-migration-b', itemId: item.id, kind: 'NAME', reason: 'foreign' } }), /Foreign key constraint/);
    for (const name of names.slice(index + 1)) await connection.query(await readFile(resolve(root, name, 'migration.sql'), 'utf8'));
    console.log('PASS MySQL material migration: old-schema replay, exact validated lifecycle backfill, preserved actor/time/version/reason and nullable unknowns, malformed/unrelated/cross-store exclusion, unchanged original audits/material and composite tenant foreign key.');
  } finally { await db.$disconnect(); await connection.end(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
