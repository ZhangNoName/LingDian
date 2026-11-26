import type { UserAddress } from '@lingdian/contracts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewAddressSelection, selectAddress } from '../src/address-selection';

const original = {
  id: 'home',
  detailInfo: '原地址',
  updatedAt: '2026-11-26T01:00:00.000Z',
} as UserAddress;

test('refreshing a selected delivery address requires confirmation of the new version', () => {
  const selected = selectAddress(original);
  const updated = { ...original, detailInfo: '新地址', updatedAt: '2026-11-26T01:10:00.000Z' };
  assert.deepEqual(reviewAddressSelection(selected, [original]), { currentAddress: original });
  assert.deepEqual(reviewAddressSelection(selected, [updated]), { issue: 'updated' });
  assert.deepEqual(reviewAddressSelection(selectAddress(updated), [updated]), { currentAddress: updated });
});

test('deleted addresses and server conflicts cannot silently fall back to another default', () => {
  const replacement = { ...original, id: 'replacement', isDefault: true };
  assert.deepEqual(reviewAddressSelection(selectAddress(original), [replacement]), { issue: 'removed' });
  assert.deepEqual(reviewAddressSelection(null, [replacement]), { issue: 'updated' });
  assert.deepEqual(reviewAddressSelection(selectAddress(replacement), [replacement]), { currentAddress: replacement });
});
