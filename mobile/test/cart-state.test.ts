import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPurchase, cartOwnerForWorkspace, cartSelectionKey, clearCartLines, guestCart, replaceCartLine, restoreCartRecords, storeCart, storeCartKey,
  transferGuestCart, type CartLine, type CartRecords,
} from '../src/cart-state';

const owner = 'account:customer';
const line = (id: string, selectionKey: string, quantity: number, storeId = 'store-a'): CartLine => ({
  id, selectionKey, storeId, quantity, productName: '招牌汉堡', variantName: '标准', image: undefined,
  skuId: selectionKey, cents: 900, options: [], selections: [],
});

test('legacy snapshots preserve cart items, order mode, and checkout replay protection', () => {
  const cart = { lines: [line('prior', 'shared', 3)], mode: 'pickup', lastAppliedOrder: 'prior-request' } as const;
  const snapshot = { [owner]: { ...cart, lines: [...cart.lines] }, 'account:empty': { lines: [], mode: 'dine_in' } } satisfies CartRecords;
  const restored = restoreCartRecords(snapshot);
  assert.equal(restored[owner], undefined);
  assert.deepEqual(storeCart(restored, owner, 'store-a'), cart);
  assert.deepEqual(storeCart(restored, owner, 'store-b').lines, []);
  assert.equal(storeCart(restored, 'account:empty', 'store-b').mode, 'dine_in');
  const reopened = JSON.parse(JSON.stringify(restored)) as CartRecords;
  assert.equal(restoreCartRecords(reopened), reopened);
  assert.equal(storeCart(reopened, owner, 'store-a').lastAppliedOrder, 'prior-request');
});

test('guest transfer keeps existing account line identifiers and merges every compatible store', () => {
  const other = { lines: [line('other', 'different', 8)] };
  const records: CartRecords = {
    [storeCartKey(guestCart, 'store-a')]: { lines: [line('guest-1', 'shared', 2), line('guest-2', 'new', 1)] },
    [storeCartKey(guestCart, 'store-b')]: { lines: [line('guest-b', 'shared', 1, 'store-b')], mode: 'takeout' },
    [storeCartKey(owner, 'store-a')]: { lines: [line('account-1', 'shared', 3)], mode: 'pickup' },
    [storeCartKey('account:other', 'store-a')]: other,
  };
  const transferred = transferGuestCart(records, owner);
  assert.equal(transferred[storeCartKey(guestCart, 'store-a')], undefined);
  assert.equal(transferred[storeCartKey(guestCart, 'store-b')], undefined);
  assert.equal(storeCart(transferred, 'account:other', 'store-a'), other);
  assert.deepEqual(storeCart(transferred, owner, 'store-a').lines.map(({ id, quantity }) => [id, quantity]), [['account-1', 5], ['guest-2', 1]]);
  assert.equal(storeCart(transferred, owner, 'store-a').mode, 'pickup');
  assert.deepEqual(storeCart(transferred, owner, 'store-b').lines.map(({ id, quantity }) => [id, quantity]), [['guest-b', 1]]);
  assert.equal(storeCart(transferred, owner, 'store-b').mode, 'takeout');
});

test('signing in as a merchant keeps guest ownership until entering the customer workspace', () => {
  const records: CartRecords = {
    [storeCartKey(guestCart, 'store-a')]: { lines: [line('guest-1', 'sku-1', 1)] },
  };
  assert.equal(cartOwnerForWorkspace('user'), guestCart);
  assert.equal(cartOwnerForWorkspace('merchant', 'customer'), guestCart);
  assert.equal(cartOwnerForWorkspace('admin', 'customer'), guestCart);
  const customer = cartOwnerForWorkspace('user', 'customer');
  assert.equal(customer, owner);
  const merged = transferGuestCart(records, customer);
  assert.deepEqual(storeCart(merged, customer, 'store-a').lines, [line('guest-1', 'sku-1', 1)]);
  assert.deepEqual(storeCart(merged, guestCart, 'store-a').lines, []);
});

test('an incompatible guest transfer retains both carts for that store while other stores still merge', () => {
  const guestA = storeCartKey(guestCart, 'store-a');
  const accountA = storeCartKey(owner, 'store-a');
  const records: CartRecords = {
    [guestA]: { lines: [line('guest', 'shared', 2)] },
    [accountA]: { lines: [line('account', 'shared', 98)] },
  };
  assert.equal(transferGuestCart(records, owner), records);
  const guestB = storeCartKey(guestCart, 'store-b');
  const secondary = { lines: [line('other', 'shared', 1, 'store-b')] };
  const transferred = transferGuestCart({ ...records, [guestB]: secondary }, owner);
  assert.equal(transferred[guestA], records[guestA]);
  assert.equal(transferred[accountA], records[accountA]);
  assert.equal(transferred[guestB], undefined);
  assert.deepEqual(storeCart(transferred, owner, 'store-b').lines, secondary.lines);
});

test('reopening a saved cart and replaying the last order preserves later additions', () => {
  const cart = { lines: [line('earlier', 'shared', 5), line('new', 'different', 3), line('new-id', 're-added', 1)] };
  const ordered = [{ id: 'earlier', quantity: 2 }, { id: 'old-id', quantity: 1 }];
  const completed = applyPurchase(cart, 'request-1', ordered);
  const restored = JSON.parse(JSON.stringify(completed)) as typeof completed;
  assert.equal(applyPurchase(restored, 'request-1', ordered), restored);
  assert.deepEqual(restored.lines.map(({ id, quantity }) => [id, quantity]), [['earlier', 3], ['new', 3], ['new-id', 1]]);
  const next = applyPurchase(restored, 'request-2', [{ id: 'earlier', quantity: 3 }]);
  assert.deepEqual(next.lines.map(({ id }) => id), ['new', 'new-id']);
});

test('replacing a selection retains its quantity and an older order cannot consume the new selection', () => {
  const original = { ...line('old', 'standard', 3), productId: 'product' };
  original.selectionKey = cartSelectionKey(original);
  const other = line('other', 'different', 1);
  const cart = { lines: [original, other] };
  const unchanged = replaceCartLine(cart, 'old', { ...original, cents: 1200 }, 'ignored');
  assert.deepEqual(unchanged.lines.map(({ id, quantity }) => [id, quantity]), [['old', 3], ['other', 1]]);
  const reselected = replaceCartLine(cart, 'old', { ...original, skuId: 'large', cents: 1200 }, 'new');
  assert.deepEqual(reselected.lines.map(({ id, quantity }) => [id, quantity]), [['new', 3], ['other', 1]]);
  assert.deepEqual(applyPurchase(reselected, 'old-request', [{ id: 'old', quantity: 2 }]).lines, reselected.lines);
  assert.throws(() => replaceCartLine(cart, 'old', { ...original, productId: 'other-product' }, 'new'), /已变化/);
});

test('reselecting a duplicate merges the lines while enforcing the quantity limit', () => {
  const source = { ...line('old', 'standard', 2), productId: 'product' };
  const target = { ...line('existing', 'large', 3), productId: 'product' };
  source.selectionKey = cartSelectionKey(source);
  target.selectionKey = cartSelectionKey(target);
  const merged = replaceCartLine({ lines: [source, target] }, 'old', target, 'unused');
  assert.deepEqual(merged.lines.map(({ id, quantity }) => [id, quantity]), [['existing', 5]]);
  const tooMany = { lines: [source, { ...target, quantity: 98 }] };
  assert.throws(() => replaceCartLine(tooMany, 'old', target, 'unused'), /最多购买 99 份/);
  assert.deepEqual(tooMany.lines.map(({ id, quantity }) => [id, quantity]), [['old', 2], ['existing', 98]]);
});


test('clearing cart lines preserves its service mode and order recovery marker', () => {
  const cart = { lines: [line('selected', 'sku', 2)], mode: 'takeout', lastAppliedOrder: 'earlier-request' } as const;
  const current = { ...cart, lines: [...cart.lines] };
  const cleared = clearCartLines(current);
  assert.deepEqual(cleared, { lines: [], mode: 'takeout', lastAppliedOrder: 'earlier-request' });
  assert.equal(current.lines.length, 1);
  assert.equal(clearCartLines(cleared), cleared);
});
