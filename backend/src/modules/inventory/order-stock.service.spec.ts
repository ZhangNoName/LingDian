import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { OrderStockService } from './order-stock.service';
import { InventoryService } from './inventory.service';
import { MerchantStoreScope } from '../merchant/merchant-store-scope';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE skus(id TEXT PRIMARY KEY, storeId TEXT, isActive INTEGER, recipeVersion INTEGER DEFAULT 0);
    CREATE TABLE recipes(skuId TEXT, storeId TEXT, itemId TEXT, quantity INTEGER);
    CREATE TABLE items(id TEXT PRIMARY KEY, storeId TEXT, name TEXT DEFAULT 'Flour', code TEXT DEFAULT 'FLOUR', unit TEXT DEFAULT 'kg', quantity INTEGER, reservedQuantity INTEGER DEFAULT 0, availableQuantity INTEGER, reorderPoint INTEGER DEFAULT 500, version INTEGER DEFAULT 0,
      CHECK(reservedQuantity >= 0 AND quantity >= reservedQuantity AND availableQuantity = quantity-reservedQuantity));
    CREATE TABLE orders(id TEXT PRIMARY KEY, storeId TEXT, status TEXT);
    CREATE TABLE holds(id TEXT PRIMARY KEY, storeId TEXT, orderId TEXT, itemId TEXT, quantity INTEGER, status TEXT DEFAULT 'RESERVED', UNIQUE(orderId,itemId));
    CREATE TABLE ledger(id TEXT PRIMARY KEY, storeId TEXT, requestId TEXT, json TEXT, UNIQUE(storeId,requestId));
    INSERT INTO skus(id,storeId,isActive) VALUES ('base','store-a',1),('addon','store-a',1),('foreign','store-b',1);
    INSERT INTO items(id,storeId,quantity,availableQuantity) VALUES ('flour','store-a',2000,2000),('milk','store-a',1000,1000),('foreign','store-b',9000,9000);
    INSERT INTO recipes VALUES ('base','store-a','flour',500),('addon','store-a','flour',250),('base','store-a','milk',100);
  `);
  const stock = new OrderStockService();
  let index = 0, tail = Promise.resolve<unknown>(undefined), failLedger = false;
  const item = (id = 'flour') => db.prepare('SELECT * FROM items WHERE id=?').get(id) as any;
  const tx: any = {
    productSKU: { updateMany: async ({ where }: any) => ({ count: db.prepare('UPDATE skus SET recipeVersion=recipeVersion WHERE id=? AND storeId=? AND isActive=1').run(where.id, where.product.storeId).changes }) },
    inventoryRecipe: { findMany: async ({ where }: any) => db.prepare(`SELECT * FROM recipes WHERE storeId=? AND skuId IN (${where.skuId.in.map(() => '?').join(',')})`).all(where.storeId, ...where.skuId.in) },
    inventoryItem: {
      findUnique: async ({ where }: any) => db.prepare('SELECT * FROM items WHERE id=? AND storeId=?').get(where.id_storeId.id, where.id_storeId.storeId) ?? null,
      updateMany: async ({ where, data }: any) => {
        const sets: string[] = [], values: any[] = [];
        for (const field of ['quantity', 'reservedQuantity', 'availableQuantity', 'reorderPoint']) if (data[field] !== undefined) { sets.push(`${field}=?`); values.push(data[field]); }
        if (data.version) { sets.push('version=version+?'); values.push(data.version.increment); }
        return { count: db.prepare(`UPDATE items SET ${sets.join(',')} WHERE id=? AND storeId=?${where.version === undefined ? '' : ' AND version=?'}`).run(...values, where.id, where.storeId, ...(where.version === undefined ? [] : [where.version])).changes };
      },
    },
    inventoryReservation: {
      create: async ({ data }: any) => { db.prepare('INSERT INTO holds(id,storeId,orderId,itemId,quantity) VALUES(?,?,?,?,?)').run('h'+index++, data.storeId, data.orderId, data.itemId, data.quantity); },
      findMany: async ({ where }: any) => db.prepare('SELECT * FROM holds WHERE orderId=? AND storeId=? AND status=? ORDER BY itemId').all(where.orderId, where.storeId, where.status),
      updateMany: async ({ where, data }: any) => ({ count: db.prepare('UPDATE holds SET status=? WHERE id=? AND storeId=? AND status=?').run(data.status, where.id, where.storeId, where.status).changes }),
    },
    inventoryMovement: {
      create: async ({ data }: any) => {
        if (failLedger) throw new Error('ledger unavailable');
        const row = { ...data, id: 'm'+index++, createdAt: new Date().toISOString() };
        db.prepare('INSERT INTO ledger VALUES(?,?,?,?)').run(row.id, row.storeId, row.requestId, JSON.stringify(row));
        return { ...row, createdAt: new Date(row.createdAt), item: item(row.itemId) };
      },
      findUnique: async ({ where }: any) => {
        const record = db.prepare('SELECT json FROM ledger WHERE storeId=? AND requestId=?').get(where.storeId_requestId.storeId, where.storeId_requestId.requestId) as any;
        if (!record) return null;
        const row = JSON.parse(record.json); return { ...row, createdAt: new Date(row.createdAt), item: item(row.itemId) };
      },
    },
  };
  function transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    const operation = tail.then(async () => { db.exec('BEGIN'); try { const result = await work(tx); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } });
    tail = operation.catch(() => undefined); return operation;
  }
  const order = (id: string) => ({ id, storeId: 'store-a', orderNo: id.toUpperCase() });
  const reserve = (id: string, lines = [{ skuId: 'base', quantity: 2 }]) => transaction(async (client) => {
    db.prepare("INSERT INTO orders VALUES(?, 'store-a', 'PENDING_PAYMENT')").run(id);
    return stock.reserve(client, order(id), lines, 'customer');
  });
  const commit = (id: string) => transaction(async (client) => { db.prepare("UPDATE orders SET status='PAID' WHERE id=?").run(id); await stock.commit(client, order(id), 'merchant'); });
  const release = (id: string) => transaction(async (client) => { db.prepare("UPDATE orders SET status='CANCELLED' WHERE id=?").run(id); await stock.release(client, order(id), 'merchant'); });
  const inventory = new InventoryService({ $transaction: transaction, inventoryMovement: tx.inventoryMovement } as never, new MerchantStoreScope({ resolveStoreIds: (ids: string[]) => ids } as never));
  return { db, reserve, commit, release, item, inventory, failLedger: () => { failLedger = true; } };
}

test('checkout groups base and referenced variants, reserves available ingredients, then commits once', async () => {
  const f = fixture(); try {
    const expires = await f.reserve('order-a', [{ skuId: 'base', quantity: 1 }, { skuId: 'base', quantity: 1 }, { skuId: 'addon', quantity: 2 }]);
    assert.ok(expires && expires > new Date());
    assert.deepEqual([f.item().quantity, f.item().reservedQuantity, f.item().availableQuantity], [2000, 1500, 500]);
    await f.commit('order-a'); await f.commit('order-a');
    assert.deepEqual([f.item().quantity, f.item().reservedQuantity, f.item().availableQuantity], [500, 0, 500]);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE json LIKE '%ISSUE%'").get()!.n, 2);
  } finally { f.db.close(); }
});

test('release preserves physical stock, restores availability and keeps the original recipe snapshot', async () => {
  const f = fixture(); try {
    await f.reserve('order-a'); f.db.exec('DELETE FROM recipes');
    await f.release('order-a'); await f.release('order-a');
    assert.deepEqual([f.item().quantity, f.item().reservedQuantity, f.item().availableQuantity], [2000, 0, 2000]);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM holds WHERE status='RELEASED'").get()!.n, 2);
  } finally { f.db.close(); }
});

test('competing checkout requests cannot reserve more than available stock; failed orders roll back', async () => {
  const f = fixture(); try {
    const results = await Promise.allSettled([f.reserve('first', [{ skuId: 'base', quantity: 3 }]), f.reserve('second', [{ skuId: 'base', quantity: 3 }])]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.deepEqual([f.item().quantity, f.item().reservedQuantity, f.item().availableQuantity], [2000, 1500, 500]);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM orders').get()!.n, 1);
  } finally { f.db.close(); }
});

test('a ledger write failure rolls back payment status, physical stock and reservation settlement', async () => {
  const f = fixture(); try {
    await f.reserve('order-a'); f.failLedger();
    await assert.rejects(f.commit('order-a'), /ledger unavailable/);
    assert.equal(f.db.prepare('SELECT status FROM orders').get()!.status, 'PENDING_PAYMENT');
    assert.deepEqual([f.item().quantity, f.item().reservedQuantity, f.item().availableQuantity], [2000, 1000, 1000]);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM holds WHERE status='RESERVED'").get()!.n, 2);
  } finally { f.db.close(); }
});

test('manual counts cannot spend reserved ingredients and cross-store variants are rejected', async () => {
  const f = fixture(); try {
    await f.reserve('order-a');
    await assert.rejects(f.inventory.adjust({ userId: 'm', sessionId: 's', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: ['store-a'] }, 'store-a', 'flour', { requestId: 'count-001', kind: 'COUNT', amount: 0.5, expectedVersion: f.item().version, reason: 'count' }), /inventory.reserved/);
    await assert.rejects(f.reserve('foreign-order', [{ skuId: 'foreign', quantity: 1 }]), /inventory.skuUnavailable/);
    assert.equal(f.item('foreign').quantity, 9000);
  } finally { f.db.close(); }
});
