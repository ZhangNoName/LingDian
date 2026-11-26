import type { InboxAnchor, InboxMessage, InboxPage, InboxUnreadStatus } from '@lingdian/contracts';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

export type InboxFeed = InfiniteData<InboxPage, string | undefined>;
export type ReadSelection = { id: string } | { through: InboxAnchor };

function sameAnchor(before: InboxAnchor | null | undefined, after: InboxAnchor | null | undefined) {
  return before === after || (!!before && !!after && before.id === after.id && before.createdAt === after.createdAt);
}

export function compareUnread(previous: InboxUnreadStatus, current: InboxUnreadStatus) {
  const before = previous.newestUnread;
  const after = current.newestUnread;
  const headChanged = !sameAnchor(before, after);
  const headAdvanced = headChanged && after && (
    !before || after.createdAt > before.createdAt || (after.createdAt === before.createdAt && after.id > before.id)
  );
  const sameFeed = sameAnchor(previous.newestEvent, current.newestEvent) && previous.totalEvents === current.totalEvents;
  return {
    changed: headChanged || previous.count !== current.count || !sameFeed,
    newMessages: Math.max(current.count - previous.count, headAdvanced ? 1 : 0),
    readAll: sameFeed && current.totalEvents !== undefined && current.newestEvent !== undefined && current.count === 0,
  };
}

function patchInboxReads(feed: InboxFeed, matches: (item: InboxMessage) => boolean): InboxFeed {
  let changed = false;
  const pages = feed.pages.map((page) => {
    let pageChanged = false;
    const items = page.items.map((item) => {
      if (!matches(item) || item.read) return item;
      pageChanged = true;
      return { ...item, read: true };
    });
    changed ||= pageChanged;
    return pageChanged ? { ...page, items } : page;
  });
  return changed ? { ...feed, pages } : feed;
}

export function applyInboxRead(feed: InboxFeed, selection: ReadSelection): InboxFeed {
  if ('id' in selection) return patchInboxReads(feed, (item) => item.id === selection.id);
  const { through } = selection;
  let reachedAnchor = false;
  return patchInboxReads(feed, (item) => {
    if (item.createdAt !== through.createdAt) return item.createdAt < through.createdAt;
    // The order returned by the API resolves ties, including across page boundaries.
    reachedAnchor ||= item.id === through.id;
    return reachedAnchor;
  });
}

export function retainInboxReads(previous: InboxFeed | undefined, next: InboxFeed): InboxFeed {
  if (!previous) return next;
  const read = new Set(previous.pages.flatMap((page) => page.items.filter((item) => item.read).map((item) => item.id)));
  return read.size ? patchInboxReads(next, (item) => read.has(item.id)) : next;
}

export function updateCachedInboxRead(client: QueryClient, key: string, selection: ReadSelection) {
  const queryKey = [key, '/mobile/inbox'];
  const cached = client.getQueryState<InboxFeed>(queryKey);
  if (!cached?.data) return;
  const updated = applyInboxRead(cached.data, selection);
  if (updated === cached.data) return;
  client.setQueryData(queryKey, updated, { updatedAt: cached.dataUpdatedAt });
  if (cached.isInvalidated) void client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
}
