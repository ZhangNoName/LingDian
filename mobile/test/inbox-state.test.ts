import assert from 'node:assert/strict';
import test from 'node:test';
import type { InboxMessage } from '@lingdian/contracts';
import { QueryClient } from '@tanstack/react-query';
import { applyInboxRead, compareUnread, retainInboxReads, updateCachedInboxRead, type InboxFeed } from '../src/inbox-state';

const first = { id: 'order:one', createdAt: '2026-11-25T11:05:00.000Z' };
const second = { id: 'order:two', createdAt: '2026-11-25T11:06:00.000Z' };

test('refreshes the open inbox when a new arrival replaces a read notification at the same count', () => {
  assert.deepEqual(
    compareUnread({ count: 1, newestUnread: first }, { count: 1, newestUnread: second }),
    { changed: true, newMessages: 1, readAll: false },
  );
});

test('refreshes read state without announcing older unread messages as new', () => {
  assert.deepEqual(
    compareUnread({ count: 2, newestUnread: second }, { count: 1, newestUnread: first }),
    { changed: true, newMessages: 0, readAll: false },
  );
  assert.deepEqual(
    compareUnread({ count: 1, newestUnread: first }, { count: 0, newestUnread: null }),
    { changed: true, newMessages: 0, readAll: false },
  );
  assert.deepEqual(
    compareUnread({ count: 1, newestUnread: first }, { count: 1, newestUnread: first }),
    { changed: false, newMessages: 0, readAll: false },
  );
});

test('all-read sync can keep the current pages while event changes still refresh the list', () => {
  const previous = { count: 2, newestUnread: second, totalEvents: 2, newestEvent: second };
  const allRead = { ...previous, count: 0, newestUnread: null };
  assert.deepEqual(compareUnread(previous, allRead), { changed: true, newMessages: 0, readAll: true });
  assert.deepEqual(compareUnread(previous, { ...allRead, totalEvents: 1 }), { changed: true, newMessages: 0, readAll: false });
  const newer = { ...second, id: 'order:three', createdAt: '2026-11-25T11:08:00.000Z' };
  assert.deepEqual(compareUnread(allRead, { ...allRead, newestEvent: newer }), { changed: true, newMessages: 0, readAll: false });
});

function message(anchor: typeof first): InboxMessage {
  return { ...anchor, kind: 'NEW_ORDER', targetId: anchor.id, subject: anchor.id, state: '', read: false };
}

test('bulk read preserves newer rows and follows server order across timestamp ties', () => {
  const newer = message({ ...second, id: 'order-status:not-included' });
  const anchor = message(second);
  const olderTie = message({ ...second, id: 'order:included' });
  const source: InboxFeed = {
    pageParams: [undefined, 'cursor'],
    pages: [{ items: [newer, anchor], nextCursor: 'cursor' }, { items: [olderTie, message(first)], nextCursor: null }],
  };
  const updated = applyInboxRead(source, { through: anchor });
  assert.deepEqual(updated.pages.flatMap((page) => page.items.map((event) => event.read)), [false, true, true, true]);
  assert.equal(updated.pages[0].items[0], newer);
  assert.equal(updated.pageParams, source.pageParams);
  const unseen = applyInboxRead(source, { through: { ...anchor, id: 'order:missing' } });
  assert.deepEqual(unseen.pages.flatMap((page) => page.items.map((event) => event.read)), [false, false, false, true]);
});

test('a page response started before an acknowledged read cannot revert the receipt', () => {
  const source: InboxFeed = { pageParams: [undefined], pages: [{ items: [message(second), message(first)], nextCursor: null }] };
  const updated = applyInboxRead(source, { id: first.id });
  assert.deepEqual(retainInboxReads(updated, source), updated);
  assert.equal(applyInboxRead(updated, { id: first.id }), updated);
  assert.equal(retainInboxReads(source, source), source);
});

test('a local read keeps the feed stale when an event refresh was already due', async () => {
  const client = new QueryClient();
  const queryKey = ['store-session', '/mobile/inbox'];
  const alternate = ['other-session', '/mobile/inbox'];
  const source: InboxFeed = { pageParams: [undefined], pages: [{ items: [message(first)], nextCursor: null }] };
  const updatedAt = Date.now() - 60_000;
  client.setQueryData(queryKey, source, { updatedAt });
  client.setQueryData(alternate, source, { updatedAt });
  await client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
  updateCachedInboxRead(client, 'store-session', { id: first.id });
  const cached = client.getQueryState<InboxFeed>(queryKey)!;
  assert.equal(cached.data?.pages[0].items[0].read, true);
  assert.equal(cached.dataUpdatedAt, updatedAt);
  assert.equal(cached.isInvalidated, true);
  assert.equal(client.getQueryData<InboxFeed>(alternate)?.pages[0].items[0].read, false);
  client.clear();
});
