import type { InboxMessage, InboxPage, InboxUnreadStatus, OrderStatus } from '@lingdian/contracts';
import { replaceEqualDeep, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { endpoint, humanError, type RequestOptions } from './api';
import { useApi, useScreenActive, useWorkspace } from './context';
import { localTime } from './format';
import { compareUnread, retainInboxReads, updateCachedInboxRead, type InboxFeed, type ReadSelection } from './inbox-state';
import { ordersPath, statusText } from './order-presentation';
import { Button, colors, Empty, layout, ListRow, Loading, Panel } from './ui';

export function useInboxUnread({ key, enabled, visible, call, show }: {
  key: string; enabled: boolean; visible: boolean;
  call: (path: string, options: RequestOptions) => Promise<InboxUnreadStatus>;
  show: (message: string) => void;
}) {
  const client = useQueryClient();
  const unread = useQuery({
    queryKey: [key, '/mobile/inbox/unread'],
    queryFn: ({ signal }) => call('/mobile/inbox/unread', { signal }),
    enabled,
    refetchInterval: 45_000,
  });
  const lastUnread = useRef<{ key: string; status: InboxUnreadStatus }>(null);
  useEffect(() => {
    const status = unread.data;
    if (!enabled || status === undefined) return;
    const previous = lastUnread.current;
    lastUnread.current = { key, status };
    if (previous?.key !== key) return;
    const { changed, newMessages, readAll } = compareUnread(previous.status, status);
    if (changed && readAll) {
      if (status.newestEvent) updateCachedInboxRead(client, key, { through: status.newestEvent });
    } else if (changed) {
      void client.invalidateQueries({ queryKey: [key, '/mobile/inbox'], exact: true });
    }
    if (newMessages && !visible) {
      show(newMessages === 1 ? '收到新消息' : `收到至少 ${newMessages} 条新消息`);
    }
  }, [client, enabled, key, show, unread.data, visible]);
  return enabled ? unread.data : undefined;
}

function inboxTitle(item: InboxMessage) {
  if (item.kind === 'ORDER_UPDATE') return statusText[item.state as OrderStatus] ?? '订单已更新';
  if (item.kind === 'NEW_ORDER') return '新订单';
  if (item.kind === 'SYSTEM_ALERT') return '系统严重告警';
  return item.state === 'OUT' ? '原料缺货' : '库存预警';
}

export function Inbox({ unread }: { unread?: InboxUnreadStatus }) {
  const api = useApi();
  const active = useScreenActive();
  const { user, workspace, go, signIn, show, isCurrent } = useWorkspace();
  const client = useQueryClient();
  const count = unread?.count ?? 0;
  const newest = unread?.newestUnread;
  const query = useInfiniteQuery({
    queryKey: [api.key, '/mobile/inbox'], enabled: !!user, subscribed: active,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.call<InboxPage>(endpoint('/mobile/inbox', { cursor: pageParam }), { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    structuralSharing: (previous, next) => replaceEqualDeep(previous, retainInboxReads(previous as InboxFeed | undefined, next as InboxFeed)),
  });
  const mark = useMutation({
    mutationFn: (selection: ReadSelection) => api.call(
      'through' in selection
        ? endpoint('/mobile/inbox/read-all', { throughId: selection.through.id, throughCreatedAt: selection.through.createdAt })
        : `/mobile/inbox/${encodeURIComponent(selection.id)}/read`,
      { method: 'PATCH' },
    ),
    onSuccess: (_data, selection) => {
      updateCachedInboxRead(client, api.key, selection);
      void client.invalidateQueries({ queryKey: [api.key, '/mobile/inbox/unread'] });
    },
    onError: (error) => { if (isCurrent()) show(humanError(error)); },
  });
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data?.pages]);
  if (!user) return <Empty title="登录后查看消息" icon="notifications-outline" action="登录" onAction={signIn} />;
  return <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={layout.list}
    initialNumToRender={8} windowSize={7}
    refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => {
      if (!active) return;
      void query.refetch();
      void client.invalidateQueries({ queryKey: [api.key, '/mobile/inbox/unread'] });
    }}
    onEndReachedThreshold={0.4} onEndReached={() => { if (active && query.hasNextPage && !query.isFetching) void query.fetchNextPage(); }}
    ListHeaderComponent={count > 0 ? <View style={layout.split}>
      <Text style={layout.muted}>{count} 条未读</Text>
      {newest && <Button label="全部标为已读" variant="secondary" busy={mark.isPending}
        onPress={() => mark.mutate({ through: newest })} />}
    </View> : null}
    renderItem={({ item }) => <Panel>
      <ListRow title={inboxTitle(item)} detail={`${item.subject} · ${localTime(item.createdAt)}`}
        trailing={!item.read ? <View style={styles.unreadDot} /> : undefined}
        accessibilityLabel={`${inboxTitle(item)}，${item.subject}，${item.read ? '已读' : '未读'}`}
        icon={item.kind === 'INVENTORY_ALERT' || item.kind === 'SYSTEM_ALERT' ? 'alert-circle-outline' : 'receipt-outline'}
        onPress={() => {
          if (!item.read) mark.mutate(item);
          if (item.kind === 'INVENTORY_ALERT') go({ type: 'record', name: 'alerts', id: item.targetId });
          else if (item.kind === 'SYSTEM_ALERT') go({ type: 'record', name: 'logs', id: item.targetId });
          else {
            void client.invalidateQueries({ queryKey: [api.key, `${ordersPath[workspace]}/${encodeURIComponent(item.targetId)}`], exact: true });
            go({ type: 'order', id: item.targetId });
          }
        }} />
    </Panel>}
    ListEmptyComponent={query.isPending ? <Loading /> : query.isError
      ? <Empty title="消息暂时无法加载" detail={humanError(query.error)} action="重试" onAction={() => void query.refetch()} />
      : <Empty title="暂时没有消息" icon="notifications-outline" />}
    ListFooterComponent={query.isFetchingNextPage ? <Loading label="加载更多…" /> : query.isFetchNextPageError
      ? <Button label="重新加载更多" variant="secondary" onPress={() => void query.fetchNextPage()} /> : null} />;
}

const styles = StyleSheet.create({
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
});
