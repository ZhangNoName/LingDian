import type { IntegrationCapabilityContract, MerchantDashboardSnapshot, StockHoldDetail, StockHoldRecord, StockHoldRecheckResult } from '@lingdian/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { endpoint, humanError } from './api';
import { useApi, useData, useWorkspace, useMerchantPaths } from './context';
import { ExportCsv } from './csv';
import { localTime, money } from './format';
import { DataState, DateFields, dateInChina, period, PagedList, Toggle } from './operations';
import { orderTypeText, statusText } from './order-presentation';
import { collectionTitle, type CollectionRoute, type OrderListSelection } from './routes';
import { Badge, Button, colors, Empty, ErrorLine, layout, ListRow, Page, Panel, Section, type IconName } from './ui';

const goods: Array<[CollectionRoute['name'], IconName]> = [['products', 'fast-food-outline'], ['categories', 'list-outline'], ['recipes', 'layers-outline']];
const materials: Array<[CollectionRoute['name'], IconName]> = [['inventory', 'cube-outline'], ['alerts', 'warning-outline'], ['holds', 'lock-closed-outline'], ['movements', 'swap-vertical-outline'], ['report', 'stats-chart-outline'], ['stocktakes', 'clipboard-outline']];
const buying: Array<[CollectionRoute['name'], IconName]> = [['purchases', 'cart-outline'], ['suppliers', 'people-outline'], ['replenishment', 'trending-up-outline'], ['receiptReport', 'document-text-outline']];

export function MerchantHome() {
  const { store, go } = useWorkspace();
  const [dates, setDates] = useState(() => ({ from: dateInChina(-6), to: dateInChina() }));
  const [draft, setDraft] = useState(dates);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);
  const range = period(dates.from, dates.to, 366)!;
  const draftRange = period(draft.from, draft.to, 366);
  const dashboard = useData<MerchantDashboardSnapshot>(endpoint('/merchant/dashboard', { ...range }));
  const metrics = dashboard.data;
  const viewOrders = (selection: Omit<OrderListSelection, 'dates'>) => go({
    type: 'collection', name: 'orders', orders: { dates, ...selection },
  });
  return <Page>
    <View style={styles.hero}>
      <View style={layout.split}>
        <Text style={[styles.heroTitle, layout.flex]}>{store?.name}</Text>
        {store?.status && <Badge label={store.status.toUpperCase() === 'OPEN' ? '营业中' : '休息中'} tone={store.status.toUpperCase() === 'OPEN' ? 'green' : 'amber'} />}
      </View>
    </View>
    <Section title="经营概览" accessory={<Button label={editing ? '收起日期' : '选择日期'} variant="plain" icon="calendar-outline" onPress={() => setEditing(!editing)} />}>
      <Text style={layout.muted}>{dates.from} 至 {dates.to}</Text>
      {editing && <>
        <DateFields range={draft} onChange={setDraft} />
        {!draftRange && <ErrorLine message="请选择有效日期，且范围不超过 366 天。" />}
        <Button label="应用日期" disabled={!draftRange} onPress={() => { if (draftRange) setDates(draft); setEditing(false); }} />
      </>}
      {metrics ? <>
        <View style={styles.grid}>
          <Metric label="有效成交额" value={money(metrics.orders.paidAmount)} />
          <Metric label="订单数" value={String(metrics.orders.total)} />
          <Metric label="待履约" value={String(metrics.operations.pendingFulfillmentOrders)} />
          <Metric label="待跟进预警" value={String(metrics.operations.openAlerts)} />
        </View>
        <Panel>
          <ListRow title="订单管理" icon="receipt-outline" onPress={() => go({ type: 'collection', name: 'orders' })} />
          <View style={layout.separator} />
          <ListRow title="库存预警" icon="warning-outline" onPress={() => go({ type: 'collection', name: 'alerts' })} />
          <View style={layout.separator} />
          <ListRow title="到期占用" detail={`${metrics.operations.expiredStockHoldOrders} 单`} icon="lock-closed-outline" onPress={() => go({ type: 'collection', name: 'holds' })} />
        </Panel>
        <Button label={details ? '收起经营明细' : '查看经营明细'} icon="stats-chart-outline" variant="plain" onPress={() => setDetails(!details)} />
        {details && <DashboardDetails metrics={metrics} viewOrders={viewOrders} />}
        <ExportCsv name="lingdian-dashboard" label="导出概览快照" rows={() => dashboardRows(metrics)} />
        {!!metrics.topItems.length && <Section title="热销规格"><Panel>{metrics.topItems.map((item) => <ListRow
          key={JSON.stringify([item.productId, item.skuId, item.productName, item.skuName])} title={item.productName}
          detail={[item.skuName, `${item.orderCount} 单`].filter(Boolean).join(' · ')}
          value={`${item.quantity} 份`} />)}</Panel></Section>}
      </> : <DataState pending={dashboard.isPending} error={dashboard.error} reload={() => void dashboard.refetch()} />}
    </Section>
    <OperationGroup title="商品与菜单" items={goods} />
    <OperationGroup title="库存管理" items={materials} />
    <OperationGroup title="采购管理" items={buying} />
    <OperationGroup title="系统设置" items={[[ 'integrations', 'git-network-outline' ]]} />
  </Page>;
}

function DashboardDetails({ metrics, viewOrders }: {
  metrics: MerchantDashboardSnapshot; viewOrders: (selection: Omit<OrderListSelection, 'dates'>) => void;
}) {
  const statuses = (metrics.statuses ?? []).filter((row) => row.count > 0);
  const { operations } = metrics;
  return <>
    <Section title="按订单状态">
      {statuses.length ? <Panel>{statuses.map((row) => <ListRow key={row.status} title={statusText[row.status]}
        value={`${row.count} 单`} onPress={() => viewOrders({ status: row.status })} />)}</Panel>
        : <Text style={layout.muted}>当前日期范围没有订单</Text>}
    </Section>
    <Section title="按服务方式"><Panel>
      {(metrics.orderTypes ?? []).map((row) => <ListRow key={row.type} title={orderTypeText[row.type]}
        detail={`${row.orders} 单 · ${row.paidOrders} 单已收款`} value={money(row.paidAmount)}
        onPress={row.orders > 0 ? () => viewOrders({ orderType: row.type }) : undefined} />)}
    </Panel></Section>
    <Section title="库存与履约"><Panel>
      <ListRow title="跟进中的预警" value={String(operations.acknowledgedAlerts ?? 0)} />
      <ListRow title="缺货原料" value={String(operations.outOfStockMaterials ?? 0)} />
      <ListRow title="库存偏低原料" value={String(operations.lowStockMaterials ?? 0)} />
    </Panel></Section>
  </>;
}

function dashboardRows(metrics: MerchantDashboardSnapshot) {
  const { orders, operations } = metrics;
  return [
    ['开始时间', '结束时间（不含）', '生成时间', '有效成交额', '订单数', '有效付款单数'],
    [metrics.startAt, metrics.endAt, metrics.generatedAt, orders.paidAmount, orders.total, orders.paid],
    [],
    ['订单状态', '订单数'],
    ...(metrics.statuses ?? []).map((row) => [statusText[row.status], row.count]),
    [],
    ['服务方式', '订单数', '有效付款单数', '有效成交额'],
    ...(metrics.orderTypes ?? []).map((row) => [orderTypeText[row.type], row.orders, row.paidOrders, row.paidAmount]),
    [],
    ['待履约', '待跟进预警', '跟进中的预警', '缺货原料', '库存偏低原料', '到期占用'],
    [operations.pendingFulfillmentOrders, operations.openAlerts, operations.acknowledgedAlerts,
      operations.outOfStockMaterials, operations.lowStockMaterials, operations.expiredStockHoldOrders],
    [],
    ['商品', '规格', '售出数量', '订单数'],
    ...metrics.topItems.map((item) => [item.productName, item.skuName, item.quantity, item.orderCount]),
  ];
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Panel style={styles.metric}><Text style={layout.muted}>{label}</Text><Text style={styles.metricValue}>{value}</Text></Panel>;
}

function OperationGroup({ title, items }: { title: string; items: Array<[CollectionRoute['name'], IconName]> }) {
  const { go } = useWorkspace();
  return <Section title={title}><Panel>
    {items.map(([key, icon], index) => <View key={key}>
      {index > 0 && <View style={layout.separator} />}
      <ListRow title={collectionTitle(key)} icon={icon} onPress={() => go({ type: 'collection', name: key })} />
    </View>)}
  </Panel></Section>;
}

export function StoreSettings() {
  const { store, go } = useWorkspace();
  const query = useData<{
    name: string; status: string; businessHours: string | null; dineInEnabled: boolean; takeoutEnabled: boolean; pickupEnabled: boolean;
  }>(endpoint('/stores/current', { storeId: store?.id }), !!store?.id);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  const detail = query.data;
  return <Page>
    <Text style={layout.heading}>{detail.name}</Text>
    <Panel>
      <ListRow title="门店编号" detail={store?.code} />
      <ListRow title="营业状态" detail={detail.status === 'open' ? '营业中' : '休息中'} />
      <ListRow title="营业时间" detail={detail.businessHours || '暂未设置'} />
      <ListRow title="服务方式" detail={[detail.dineInEnabled && '堂食', detail.pickupEnabled && '自取', detail.takeoutEnabled && '配送'].filter(Boolean).join(' · ') || '暂停服务'} />
    </Panel>
    <Button label="查看收款账户" variant="secondary" onPress={() => go({ type: 'collection', name: 'payments' })} />
    <Button label="管理外部集成"  variant="secondary" onPress={() => go({ type: 'collection', name: 'integrations' })} />
  </Page>;
}

export function Integrations() {
  const api = useApi();
  const client = useQueryClient();
  const { root } = useMerchantPaths();
  const path = `${root}/integrations`;
  const query = useData<IntegrationCapabilityContract[]>(path);
  const switcher = useMutation({
    mutationFn: ({ item, enabled }: { item: IntegrationCapabilityContract; enabled: boolean }) => api.call(
      `${path}/${item.provider}`, { method: 'PATCH', body: { enabled } },
    ),
    onSuccess: () => { void client.invalidateQueries({ queryKey: [api.key, path] }); },
  });
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  return <Page><Section title="外部集成">
    {query.data.map((item) => <Panel key={item.provider} style={[layout.pad, layout.compact]}>
      <Toggle label={item.display_name} value={item.enabled} disabled={!item.available || switcher.isPending}
        onChange={(enabled) => switcher.mutate({ item, enabled })} />
      {!item.available && <Text style={layout.muted}>{item.reason_code === 'NOT_CONFIGURED' ? '连接器尚未配置' : '部署环境暂未启用'}</Text>}
    </Panel>)}
    {!query.data.length && <Empty title="当前没有外部集成" />}
    <ErrorLine message={switcher.error ? humanError(switcher.error) : undefined} />
  </Section></Page>;
}

export function Holds() {
  const { go } = useWorkspace();
  return <PagedList<StockHoldRecord> title="库存占用" path="/merchant/stock-holds" recordKey={(order) => order.orderId}
    render={(order) => <ListRow title={order.orderNo} detail={`占用 ${order.heldMaterialCount} 种原料 · ${localTime(order.expiresAt) || '暂无到期时间'}`}
      icon="lock-closed-outline" onPress={() => go({ type: 'record', name: 'holds', id: order.orderId })} />} />;
}

export function Hold({ id }: { id: string }) {
  const api = useApi();
  const { go, show } = useWorkspace();
  const path = `/merchant/stock-holds/${encodeURIComponent(id)}`;
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const detail = useData<StockHoldDetail>(endpoint(path, { page, pageSize: 20 }));
  const check = useMutation({
    mutationFn: () => api.call<StockHoldRecheckResult>(`${path}/recheck`, { method: 'POST' }),
    onSuccess: ({ outcome }) => {
      show(outcome === 'RESOLVED' ? '已完成核验' : outcome === 'PAYMENT_BLOCKED' ? '等待支付核验' : '暂不可释放，请稍后重试');
      void client.invalidateQueries({ queryKey: [api.key] });
    },
  });
  if (!detail.data) return <DataState pending={detail.isPending} error={detail.error} reload={() => void detail.refetch()} />;
  const { order, materials, total, pageSize } = detail.data;
  return <Page>
    <Section title="库存占用"><Panel>
      <ListRow title={order.orderNo} detail={`到期 ${localTime(order.expiresAt) || '暂无'}`} onPress={() => go({ type: 'order', id })} />
      {materials.map((item) => <ListRow key={item.itemId} title={item.name} detail={item.code} value={`${item.quantity} ${item.unit}`} />)}
    </Panel>
    <View style={layout.split}>
      <Button label="上一页" variant="secondary" disabled={page <= 1} onPress={() => setPage(page - 1)} />
      <Button label="下一页" variant="secondary" disabled={page * pageSize >= total} onPress={() => setPage(page + 1)} />
    </View>
    <Button label="重新核验占用" disabled={!order.expiresAt || new Date(order.expiresAt).getTime() > Date.now()} busy={check.isPending} onPress={() => check.mutate()} />
    <ErrorLine message={check.error ? humanError(check.error) : undefined} />
    </Section>
  </Page>;
}

const styles = StyleSheet.create({
  hero: { padding: 20, gap: 8, borderRadius: 22, backgroundColor: colors.dark },
  heroTitle: { fontSize: 29, fontWeight: '800', color: colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  metric: { width: '48.6%', paddingVertical: 13, paddingHorizontal: 14, gap: 4 },
  metricValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], color: colors.ink },
});
