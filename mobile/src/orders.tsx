import { isDirectCustomerOrder, type MerchantWechatNativePayment, type OrderDetailContract, type OrderPageContract, type OrderSource, type OrderStatus, type OrderSummaryContract, type OrderSummaryStatsContract } from '@lingdian/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create as createQr } from 'qrcode';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ApiError, endpoint, humanError } from './api';
import { useApi, useData, useScreenActive, useWorkspace } from './context';
import { localTime, money, type DateRange } from './format';
import { ordersPath, orderTypeText, statusText } from './order-presentation';
import type { OrderListSelection } from './routes';
import { DateFields, dateInChina, Options, period } from './operations';
import { Badge, Button, Chip, ChipRow, colors, Empty, ErrorLine, Field, Icon, layout, ListRow, Loading, Page, Panel, Section, Sheet } from './ui';

const actionText: Partial<Record<OrderStatus, string>> = {
  PAID: '确认已线下收款', PREPARING: '开始制作', READY: '确认已备餐', COMPLETED: '完成订单',
  CANCELLED: '取消订单', TIMED_OUT: '标记超时', REFUNDING: '标记退款中', REFUNDED: '确认线下已退款', FAILED: '标记订单失败',
};
const merchantNextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING_PAYMENT: 'PAID', PAID: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED',
};
const pickupStatuses: ReadonlySet<OrderStatus> = new Set(['PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED']);
const deletable = new Set(['CANCELLED', 'TIMED_OUT', 'FAILED', 'REFUNDED', 'COMPLETED']);
const orderSources: Record<OrderSource, string> = { APP: '零点 App', MINIAPP: '小程序', MEITUAN_WAIMAI: '美团外卖', JD_DAOJIA: '京东到家', POS: '收银台', MANUAL: '人工录单' };
const paymentOptions: Array<[string, string]> = [
  ['', '全部收款'], ['CASH', '线下收款'], ['WECHAT', '微信支付'], ['ALIPAY', '支付宝'], ['UNIONPAY', '银联'],
  ['STRIPE', 'Stripe'], ['PAYPAL', 'PayPal'], ['CUSTOMER_SCAN', '顾客扫码'], ['OTHER', '其他'],
];

function statusTone(state: OrderStatus): 'green' | 'amber' | 'red' | 'purple' {
  if (state === 'COMPLETED' || state === 'READY') return 'green';
  if (state === 'PENDING_PAYMENT' || state === 'REFUNDING') return 'amber';
  if (state === 'FAILED' || state === 'CANCELLED' || state === 'TIMED_OUT') return 'red';
  return 'purple';
}

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 280);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

type StoreOption = { id: string; name: string };
type OrderForAction = Pick<OrderSummaryContract, 'id' | 'order_no' | 'order_type' | 'pickup_code' | 'status' | 'payment_channel' | 'payable_amount'>;
type OrderAction = { order: OrderForAction; target: OrderStatus | 'delete' };

export function Orders({ initial }: { initial?: OrderListSelection }) {
  const api = useApi();
  const active = useScreenActive();
  const { user, workspace, go, signIn } = useWorkspace();
  const customer = workspace === 'user';
  const [status, setStatus] = useState(initial?.status);
  const [search, setSearch] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [draft, setDraft] = useState<DateRange>(() => initial?.dates ?? { from: dateInChina(-6), to: dateInChina() });
  const [dates, setDates] = useState(initial?.dates);
  const [orderType, setOrderType] = useState<string>(initial?.orderType ?? '');
  const [orderSource, setOrderSource] = useState('');
  const [storeFilter, setStoreFilter] = useState<StoreOption>();
  const [paymentChannel, setPaymentChannel] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderAction>();
  const keyword = useDebounced(search.trim());
  const path = ordersPath[workspace];
  const range = dates ? period(dates.from, dates.to, 366) : undefined;
  const draftRange = period(draft.from, draft.to, 366);
  const filters = { status, keyword, orderType, orderSource, paymentChannel, storeId: storeFilter?.id, startDate: range?.startAt, endBefore: range?.endAt };
  const query = useInfiniteQuery({
    queryKey: [api.key, path, filters],
    enabled: !!user,
    subscribed: active,
    queryFn: ({ pageParam, signal }) => api.call<OrderPageContract>(endpoint(path, {
      ...filters, page: pageParam, pageSize: 25,
    }), { signal }),
    initialPageParam: 1,
    getNextPageParam: (page) => page.page * page.page_size < page.total ? page.page + 1 : undefined,
  });
  const summaryVisible = Boolean(user && !customer && showSummary);
  const summary = useData<OrderSummaryStatsContract>(endpoint(`${path}/summary`, filters), summaryVisible);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data?.pages]);
  const statuses: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'TIMED_OUT', 'REFUNDING', 'REFUNDED', 'FAILED'];
  if (!customer) statuses.push('CREATING', 'DELETED');
  const filterLabel = [storeFilter?.name, status && statusText[status], orderSources[orderSource as OrderSource],
    orderTypeText[orderType as keyof typeof orderTypeText], paymentChannel && paymentOptions.find(([key]) => key === paymentChannel)?.[1],
    dates ? `${dates.from} 至 ${dates.to}` : undefined].filter(Boolean).join(' · ');
  if (!user) return <Empty title="登录后查看订单" icon="receipt-outline" action="登录" onAction={signIn} />;
  return <><FlatList data={items}
    keyExtractor={(item) => item.id} initialNumToRender={8} windowSize={7}
    keyboardShouldPersistTaps="handled"
    onEndReached={() => { if (active && query.hasNextPage && !query.isFetching) void query.fetchNextPage(); }}
    onEndReachedThreshold={0.35}
    refreshing={(query.isRefetching && !query.isFetchingNextPage) || (summaryVisible && summary.isRefetching)}
    onRefresh={() => {
      if (!active) return;
      void query.refetch();
      if (summaryVisible) void summary.refetch();
    }}
    contentContainerStyle={layout.list}
    ListHeaderComponent={<View style={layout.stack}>
      <Text style={layout.heading}>{customer ? '我的订单' : '订单管理'}</Text>
      {!customer && <Field label="搜索订单" placeholder="订单号、取餐码、姓名或手机号" value={search} onChangeText={setSearch} maxLength={120} />}
      {!customer && <Button label={advanced ? '收起筛选' : '筛选订单'} icon="options-outline" variant="secondary" onPress={() => setAdvanced(!advanced)} />}
      {!!filterLabel && <Text style={layout.muted}>{filterLabel}</Text>}
      {advanced && <>
        {workspace === 'admin' && <OrderStoreFilter value={storeFilter} onChange={setStoreFilter} />}
        <Options values={[[ '', '全部来源'], ...Object.entries(orderSources)]} value={orderSource} onChange={setOrderSource} />
        <Options values={[[ '', '全部服务'], ...Object.entries(orderTypeText)]} value={orderType} onChange={setOrderType} />
        <Options values={paymentOptions} value={paymentChannel} onChange={setPaymentChannel} />
        <DateFields range={draft} onChange={setDraft} />
        {!draftRange && <ErrorLine message="请选择有效日期，且范围不超过 366 天。" />}
        <View style={layout.split}>
          <Button label="应用日期" variant="secondary" disabled={!draftRange} onPress={() => setDates(draft)} />
          <Button label="清除日期" variant="plain" disabled={!dates} onPress={() => setDates(undefined)} />
        </View>
      </>}
      <ChipRow>
        <Chip label="全部" selected={!status} onPress={() => setStatus(undefined)} />
        {statuses.map((filter) => <Chip key={filter} label={statusText[filter]} selected={status === filter} onPress={() => setStatus(filter)} />)}
      </ChipRow>
      {!customer && <Button label={summaryVisible ? '收起订单汇总' : '查看订单汇总'} icon="stats-chart-outline" variant="plain"
        onPress={() => setShowSummary(!showSummary)} />}
      {summaryVisible && <View style={layout.compact}>
        {summary.data ? <OrdersSummary totals={summary.data} /> : summary.isPending && <Loading label="正在汇总订单…" />}
        {summary.isError && <>
          <ErrorLine message={summary.data ? '订单汇总刷新失败，正在显示上次的数据。' : '订单汇总暂时无法加载。'} />
          <Button label="重试订单汇总" variant="secondary" busy={summary.isFetching} onPress={() => void summary.refetch()} />
        </>}
      </View>}
      <ErrorLine message={query.isRefetchError ? '刷新失败，正在显示上次加载的订单。' : undefined} />
    </View>}
    renderItem={({ item }) => {
      const next = workspace === 'merchant' ? merchantNextStatus[item.status] : undefined;
      const action = next && item.allowed_statuses?.includes(next)
        && (next !== 'PAID' || (item.payment_channel === 'CASH' && item.payment_required !== false)) ? next : undefined;
      const code = workspace === 'merchant' && pickupStatuses.has(item.status) ? item.pickup_code : null;
      return <Panel>
        <ListRow title={customer ? item.store_name : item.order_no}
          detail={[workspace === 'admin' && item.store_name, !customer && orderSources[item.order_source], orderTypeText[item.order_type], localTime(item.created_at), `${item.item_count} 件`].filter(Boolean).join(' · ')}
          icon="receipt-outline" onPress={() => go({ type: 'order', id: item.id })}
          trailing={<Badge label={statusText[item.status] ?? '状态更新中'} tone={statusTone(item.status)} />} />
        <View style={styles.orderSummary}><Text style={[layout.muted, layout.flex]} numberOfLines={1}>
          {customer ? item.item_summary.map((product) => product.name).join('、') : item.customer_nickname || item.customer_name}
        </Text><Text style={layout.price}>{money(item.payable_amount)}</Text></View>
        {(code || action) && <View style={styles.orderQuickActions}>
          {code && <View style={styles.orderCode}>
            <Text style={layout.muted}>{item.order_type === 'TAKEOUT' ? '订单码' : '取餐码'}</Text>
            <Text style={layout.strong} selectable>{code}</Text>
          </View>}
          {action && <Button label={actionText[action] ?? statusText[action]}
            accessibilityLabel={`${actionText[action] ?? statusText[action]}，订单 ${item.order_no}`}
            variant="secondary" disabled={query.isRefetching && !query.isFetchingNextPage}
            style={styles.quickActionButton} onPress={() => setConfirmation({ order: item, target: action })} />}
        </View>}
      </Panel>;
    }}
    ListEmptyComponent={query.isPending ? <Loading /> : query.isError
      ? <Empty title="无法加载订单" detail={humanError(query.error)} action="重试" onAction={() => void query.refetch()} />
      : <Empty title={status || keyword || orderType || orderSource || paymentChannel || storeFilter || dates ? '没有符合条件的订单' : '还没有订单'} icon="receipt-outline" />}
    ListFooterComponent={query.isFetchingNextPage ? <Loading label="加载更多…" /> : query.isFetchNextPageError
      ? <Button label="重新加载更多" variant="secondary" onPress={() => void query.fetchNextPage()} /> : null}
  />
  {workspace === 'merchant' && <OrderActionSheet action={confirmation} close={() => setConfirmation(undefined)} />}
  </>;
}

function OrderStoreFilter({ value, onChange }: { value?: StoreOption; onChange: (value: StoreOption | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const { height } = useWindowDimensions();
  const stores = useData<StoreOption[]>('/admin/users/options/stores', open);
  const options = useMemo(() => {
    const search = keyword.trim().toLocaleLowerCase();
    return stores.data?.filter((item) => item.name.toLocaleLowerCase().includes(search)) ?? [];
  }, [keyword, stores.data]);
  const choose = (item?: StoreOption) => {
    onChange(item);
    setOpen(false);
  };
  return <>
    <Panel><ListRow title="筛选门店" detail={value?.name ?? '全部门店'} icon="storefront-outline" onPress={() => { setKeyword(''); setOpen(true); }} /></Panel>
    <Sheet title="选择门店" visible={open} onClose={() => setOpen(false)} scroll={false}>
      <Field label="搜索门店" value={keyword} onChangeText={setKeyword} maxLength={120} />
      <Button label="全部门店" variant="secondary" onPress={() => choose()} />
      <FlatList style={{ height: Math.min(270, Math.max(96, height * 0.85 - 210)) }} data={options} keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled" initialNumToRender={8}
        renderItem={({ item }) => <ListRow title={item.name} icon={value?.id === item.id ? 'checkmark-circle' : 'storefront-outline'}
          onPress={() => choose(item)} />}
        ListEmptyComponent={stores.isPending ? <Loading label="正在加载门店…" /> : stores.isError
          ? <Empty title="门店暂时无法加载" action="重试" onAction={() => void stores.refetch()} />
          : <Empty title="没有符合条件的门店" />} />
    </Sheet>
  </>;
}

function OrdersSummary({ totals }: { totals: OrderSummaryStatsContract }) {
  const metrics = [
    ['订单总数', totals.total_count], ['收款额（含退款）', money(totals.total_amount)],
    ['待付款', totals.pending_payment_count], ['已付款', totals.paid_count],
    ['退款中', totals.refunding_count], ['已退款', totals.refunded_count],
  ];
  return <View style={styles.summaryGrid}>
    {metrics.map(([label, value]) => <Panel key={label} style={styles.summaryMetric}>
      <Text style={layout.muted}>{label}</Text>
      <Text style={layout.price}>{value}</Text>
    </Panel>)}
  </View>;
}

export function Order({ id }: { id: string }) {
  const { workspace, back } = useWorkspace();
  const path = `${ordersPath[workspace]}/${encodeURIComponent(id)}`;
  const query = useData<OrderDetailContract>(path);
  const [confirmation, setConfirmation] = useState<OrderAction>();
  const record = query.data;
  if (query.isPending) return <Loading />;
  if (!record) return <Empty title="订单暂时无法查看" detail={humanError(query.error)} action="重试" onAction={() => void query.refetch()} />;
  const customer = workspace === 'user';
  const pickup = record.pickup_code && pickupStatuses.has(record.status);
  return <>
    <Page>
      <View style={styles.orderHero}>
        <Badge label={statusText[record.status] ?? record.status} tone={statusTone(record.status)} />
        <Text style={styles.orderTitle}>{record.store_name}</Text>
        <Text style={styles.orderMeta}>{orderTypeText[record.order_type]} · {localTime(record.created_at)}</Text>
        {pickup && <View style={layout.horizontal}>
          <Text style={styles.orderMeta}>{record.order_type === 'TAKEOUT' ? '订单码' : '取餐码'}</Text><Text selectable style={styles.pickup}>{record.pickup_code}</Text>
        </View>}
      </View>
      <Section title="订单信息"><Panel>
        <ListRow title="订单号" detail={record.order_no} />
        {!customer && <ListRow title="订单来源" detail={orderSources[record.order_source]} />}
        {record.delivery_address && <ListRow title="配送地址" detail={record.delivery_address} />}
        {!customer && <ListRow title="顾客" detail={`${record.customer_name} · ${record.customer_mobile}`} />}
        {!!record.remark && <ListRow title="订单备注" detail={record.remark} />}
        {record.payment_channel === 'CASH' && record.status === 'PENDING_PAYMENT' && <ListRow title={customer ? '付款方式' : '收款方式'} value="线下支付" />}
      </Panel></Section>
      <Section title="商品明细"><Panel>
        {record.items.map((item) => <ListRow key={item.id} title={`${item.product_name} × ${item.quantity}`}
          detail={[item.sku_name, ...item.selections.map((selection) => selection.option_name), item.remark].filter(Boolean).join(' · ')}
          value={money(item.subtotal)} />)}
        <View style={layout.separator} />
        <ListRow title="应付金额" value={money(record.payable_amount)} />
      </Panel></Section>
      {!customer && workspace === 'merchant' && record.status === 'PENDING_PAYMENT' && record.payment_required !== false && record.payable_amount > 0 && !(isDirectCustomerOrder(record.order_source) && record.payment_channel === 'CASH')
        && <MerchantPayment orderId={id} orderPath={path} />}
      {!customer && (!!record.allowed_statuses?.length || (!record.is_deleted && deletable.has(record.status))) && <Section title="订单操作">
        <View style={styles.actions}>
          {record.allowed_statuses?.map((status) => <Button key={status} label={actionText[status] ?? statusText[status]}
            variant={status === 'CANCELLED' || status === 'FAILED' ? 'danger' : 'secondary'}
            onPress={() => setConfirmation({ order: record, target: status })} />)}
          {!record.is_deleted && deletable.has(record.status) && <Button label="删除订单" variant="danger" onPress={() => setConfirmation({ order: record, target: 'delete' })} />}
        </View>
      </Section>}
      {!!record.status_logs.length && <Section title="订单进度"><Panel>
        {[...record.status_logs].reverse().map((item) => <ListRow key={item.id} title={statusText[item.to_status] ?? '状态更新'}
          detail={!customer && item.note ? `${localTime(item.created_at)} · ${item.note}` : localTime(item.created_at)} icon="time-outline" />)}
      </Panel></Section>}
    </Page>
    {!customer && <OrderActionSheet action={confirmation} close={() => setConfirmation(undefined)} onDeleted={back} />}
  </>;
}

function OrderActionSheet({ action, close, onDeleted }: { action?: OrderAction; close: () => void; onDeleted?: () => void }) {
  const api = useApi();
  const active = useScreenActive();
  const { workspace, show, isCurrent } = useWorkspace();
  const client = useQueryClient();
  const [note, setNote] = useState('');
  const submitting = useRef(false);
  const refresh = () => void client.invalidateQueries({ queryKey: [api.key] });
  const clear = () => { setNote(''); close(); };
  const update = useMutation({
    mutationFn: ({ order, target, note: remark }: OrderAction & { note: string }) => {
      const path = `${ordersPath[workspace]}/${encodeURIComponent(order.id)}`;
      if (target === 'delete') return api.call(path, { method: 'DELETE' });
      return api.call(`${path}/status`, { method: 'PATCH', body: {
        status: target, expectedStatus: order.status, expectedPaymentChannel: order.payment_channel ?? undefined, note: remark || undefined,
      } });
    },
    onSuccess: (_result, { target }) => {
      refresh();
      clear();
      if (!isCurrent()) return;
      show(target === 'delete' ? '订单已删除' : '订单状态已更新');
      if (target === 'delete') onDeleted?.();
    },
    onSettled: () => { submitting.current = false; },
  });
  const dismiss = () => {
    if (!submitting.current) {
      update.reset();
      clear();
    }
  };
  const stale = update.error instanceof ApiError && (update.error.status === 409 || update.error.status === 404);
  const target = action?.target;
  const order = action?.order;
  return <Sheet visible={active && !!action} title={target === 'delete' ? '删除订单' : '确认更新订单'} onClose={dismiss}>
    {order && target && <>
      <Text style={layout.body}>{target === 'delete' ? '确认删除这条订单？' : `确认执行「${actionText[target] ?? statusText[target]}」？`}</Text>
      <Panel>
        <ListRow title={order.order_no} detail={statusText[order.status]} />
        {!!order.pickup_code && <ListRow title={order.order_type === 'TAKEOUT' ? '订单码' : '取餐码'} value={order.pickup_code} />}
        {target === 'PAID' && <ListRow title="待收金额" value={money(order.payable_amount)} />}
      </Panel>
      {target !== 'delete' && <Field label="操作备注（选填）" value={note} editable={!update.isPending && !stale} onChangeText={setNote} maxLength={191} />}
      <ErrorLine message={update.error ? humanError(update.error) : undefined} />
      {stale ? <Button label="刷新订单" variant="secondary" onPress={() => { refresh(); dismiss(); }} />
        : <Button label="确认" busy={update.isPending} variant={target === 'delete' ? 'danger' : 'primary'} onPress={() => {
          if (action && !submitting.current) {
            submitting.current = true;
            update.mutate({ ...action, note: note.trim() });
          }
        }} />}
    </>}
  </Sheet>;
}

function MerchantPayment({ orderId, orderPath }: { orderId: string; orderPath: string }) {
  const api = useApi();
  const active = useScreenActive();
  const path = `/merchant/orders/${encodeURIComponent(orderId)}/wechat-native-payment`;
  const [attempted, setAttempted] = useState(false);
  const payment = useQuery({
    queryKey: [api.key, path], queryFn: ({ signal }) => api.call<MerchantWechatNativePayment>(path, { signal }),
    subscribed: active,
    refetchInterval: (query) => query.state.data?.state === 'WAITING' ? 5000 : false,
  });
  const client = useQueryClient();
  const refreshOrder = useCallback(() => {
    void client.invalidateQueries({ queryKey: [api.key, orderPath], exact: true }, { cancelRefetch: false });
  }, [api.key, client, orderPath]);
  const create = useMutation({
    mutationFn: () => api.call<MerchantWechatNativePayment>(path, { method: 'POST' }),
    onSuccess: (data) => {
      setAttempted(true);
      client.setQueryData([api.key, path], data);
      if (data.state === 'ORDER_UPDATED') refreshOrder();
    },
  });
  useEffect(() => {
    if (active && payment.data?.state === 'ORDER_UPDATED') refreshOrder();
  }, [active, payment.data?.state, refreshOrder]);
  if (payment.data?.state === 'UNAVAILABLE' || payment.data?.state === 'ORDER_UPDATED') return null;
  return <Section title="微信扫码收款">
    {payment.data?.state === 'WAITING' && payment.data.code_url
      ? <PaymentCode value={payment.data.code_url} />
      : payment.data?.state === 'AVAILABLE' || payment.data?.state === 'EXPIRED'
        ? <Button label={attempted || payment.data.state === 'EXPIRED' ? '重新生成收款码' : '生成收款码'} busy={create.isPending} onPress={() => create.mutate()} />
        : payment.isPending ? <Loading /> : <Text style={layout.muted}>当前收款单正在核验。</Text>}
    <ErrorLine message={create.error ? humanError(create.error) : payment.error ? humanError(payment.error) : undefined} />
  </Section>;
}

function PaymentCode({ value }: { value: string }) {
  const matrix = useMemo(() => makeQrMatrix(value), [value]);
  return <View style={styles.qr} accessibilityLabel="微信收款二维码" accessibilityRole="image">
    {matrix.map((line, index) => <View key={index} style={styles.qrLine}>
      {line.map((run, index) => <View key={index} style={{ flex: run.length, backgroundColor: run.dark ? '#111111' : '#FFFFFF' }} />)}
    </View>)}
  </View>;
}

function makeQrMatrix(text: string) {
  const qr = createQr(text, { errorCorrectionLevel: 'M' }).modules;
  return Array.from({ length: qr.size }, (_, y) => {
    const runs: Array<{ dark: boolean; length: number }> = [];
    for (let x = 0; x < qr.size; x++) {
      const dark = !!qr.get(y, x);
      const previous = runs.at(-1);
      if (previous?.dark === dark) previous.length++;
      else runs.push({ dark, length: 1 });
    }
    return runs;
  });
}

const styles = StyleSheet.create({
  orderSummary: { ...layout.split, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  orderQuickActions: { ...layout.split, gap: 8, flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 11 },
  orderCode: { flexShrink: 1, minWidth: 0 },
  quickActionButton: { marginLeft: 'auto' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryMetric: { flexBasis: '45%', flexGrow: 1, gap: 5, padding: 10 },
  orderHero: { backgroundColor: colors.dark, borderRadius: 20, padding: 19, gap: 9 },
  orderTitle: { color: colors.white, fontWeight: '800', fontSize: 25 },
  orderMeta: { color: '#E8DDF9', fontSize: 13 },
  pickup: { color: colors.white, fontWeight: '800', fontSize: 25, letterSpacing: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qr: { alignSelf: 'center', width: 238, height: 238, padding: 20, backgroundColor: colors.white },
  qrLine: { flex: 1, flexDirection: 'row' },
});
