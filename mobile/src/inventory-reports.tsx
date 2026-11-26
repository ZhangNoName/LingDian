import type {
  InventoryDailyTrend, InventoryItemContract, InventoryPeriodReport, PurchaseReceiptReport, ReplenishmentSnapshot, SupplierRecord,
} from '@lingdian/contracts';
import { type ReactNode, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { endpoint, humanError } from './api';
import { useData, useMerchantPaths, useWorkspace } from './context';
import { ExportCsv } from './csv';
import { localTime, money } from './format';
import { DataState, DateFields, dateInChina, Options, period, Picker } from './operations';
import { Button, Empty, ErrorLine, Field, layout, ListRow, Page, Panel, Section, Sheet } from './ui';

type Pick = { id: string; label: string };
type PurchaseFilters = { item?: Pick; supplier?: Pick };
type Range = PurchaseFilters & { from: string; to: string; keyword?: string };
type ReceiptView = 'lines' | 'suppliers' | 'materials';

function ReportList<T>({ header, data, recordKey, render }: {
  header: ReactNode; data: T[]; recordKey: (row: T, index: number) => string; render: (row: T) => ReactNode;
}) {
  return <FlatList data={data} contentContainerStyle={layout.list} keyboardShouldPersistTaps="handled"
    keyExtractor={recordKey} initialNumToRender={8} windowSize={7} ListHeaderComponent={<>{header}</>}
    renderItem={({ item }) => <Panel>{render(item)}</Panel>}
    ListEmptyComponent={<Empty title="当前范围没有记录" />} />;
}

export function InventoryReport({ name, id }: { name: string; id?: string }) {
  return name === 'replenishment' ? <Replenishment /> : <PeriodReport type={name} id={id} />;
}

function PeriodReport({ type, id }: { type: string; id?: string }) {
  const { inventory } = useMerchantPaths();
  const [criteria, apply] = useState<Range>(() => ({ from: dateInChina(-6), to: dateInChina() }));
  const [draft, setDraft] = useState(criteria);
  const [receiptView, setReceiptView] = useState<ReceiptView>('lines');
  const [filtering, setFiltering] = useState(false);
  const dateRange = period(criteria.from, criteria.to, 366)!;
  const draftRange = period(draft.from, draft.to, 366);
  const trend = type === 'trend';
  const receipts = type === 'receiptReport';
  const path = trend
    ? endpoint(`${inventory}/items/${encodeURIComponent(id ?? '')}/trend`, { fromDate: criteria.from, toDate: criteria.to, timeZone: 'Asia/Shanghai' })
    : endpoint(`${inventory}/${receipts ? 'purchases/report' : 'report'}`, {
      ...dateRange, itemId: criteria.item?.id, keyword: criteria.keyword, supplierId: receipts ? criteria.supplier?.id : undefined,
    });
  const query = useData<InventoryPeriodReport | PurchaseReceiptReport | InventoryDailyTrend>(path);
  const header = <View style={layout.stack}>
    <View style={layout.split}><Text style={layout.muted}>{criteria.from} 至 {criteria.to}</Text>
      <Button label={filtering ? '收起筛选' : '筛选日期'} variant="secondary" onPress={() => setFiltering(!filtering)} />
    </View>
    {(criteria.item || criteria.supplier || criteria.keyword) && <Text style={layout.body}>
      {[criteria.item?.label, criteria.supplier?.label, criteria.keyword].filter(Boolean).join(' · ')}
    </Text>}
    {filtering && <>
      <DateFields range={draft} onChange={(dates) => setDraft((previous) => ({ ...previous, ...dates }))} />
      {!draftRange && <ErrorLine message="请选择有效日期，且范围不超过 366 天。" />}
      {!trend && <>
        <Field label="关键词" value={draft.keyword ?? ''} onChangeText={(keyword) => setDraft({ ...draft, keyword })} maxLength={120} />
        <Picker<InventoryItemContract> label="指定原料" path={inventory} filters={{ lifecycle: 'ALL' }}
          selected={draft.item ? [draft.item] : []} onSelect={([item]) => setDraft({ ...draft, item })} map={(item) => ({ id: item.id, label: item.name, detail: item.code })} />
        {draft.item && <Button label="清除原料筛选" variant="plain" onPress={() => setDraft({ ...draft, item: undefined })} />}
      </>}
      {receipts && <>
        <Picker<SupplierRecord> label="指定供应商" path={`${inventory}/suppliers`} selected={draft.supplier ? [draft.supplier] : []}
          onSelect={([supplier]) => setDraft({ ...draft, supplier })}
          map={(item) => ({ id: item.id, label: item.name, detail: item.code })} />
        {draft.supplier && <Button label="清除供应商筛选" variant="plain" onPress={() => setDraft({ ...draft, supplier: undefined })} />}
      </>}
      <Button label="应用筛选" disabled={!draftRange} onPress={() => {
        apply({ ...draft, keyword: draft.keyword?.trim() });
        setFiltering(false);
      }} />
    </>}
    {query.isRefetchError && <ErrorLine message="刷新失败，当前显示上次加载的数据。" />}
  </View>;

  if (!query.data) return <Page>{header}<DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} /></Page>;
  const data = query.data;

  if ('days' in data) return <ReportList header={<View style={layout.stack}>
    {header}<Section title={data.item.name}>
      <Text style={layout.body}>期初 {data.summary.opening ?? '—'} · 期末 {data.summary.closing ?? '—'} {data.item.unit}</Text>
      <Text style={layout.muted}>入库 {data.summary.received} · 出库 {data.summary.issued} · 损耗 {data.summary.lost}</Text>
    </Section>
    <ExportCsv name="lingdian-inventory-trend" rows={() => [['日期', '期初', '入库', '出库', '损耗', '盘盈', '盘亏', '期末', '期末可用'],
      ...data.days.map((row) => [row.date, row.opening, row.received, row.issued, row.lost, row.countGain, row.countLoss, row.closing, row.availableClosing])]} />
  </View>} data={data.days} recordKey={(row) => row.date} render={(row) => <ListRow title={row.date}
    detail={row.state !== 'RECORDED' ? row.state === 'FUTURE' ? '未发生' : '原料尚未建档' : `入库 ${row.received} · 出库 ${row.issued} · 损耗 ${row.lost}`}
    value={row.closing === null ? '—' : String(row.closing)} />} />;

  if ('suppliers' in data) return <ReceiptReport header={header} data={data} view={receiptView} onView={setReceiptView} drill={(filter) => {
    const next = { ...criteria, ...filter };
    apply(next);
    setDraft(next);
    setReceiptView('lines');
    setFiltering(false);
  }} />;

  return <ReportList header={<View style={layout.stack}>
    {header}
    <ExportCsv name="lingdian-inventory-report" rows={() => [['原料', '编码', '单位', '期初', '入库', '出库', '损耗', '盘盈', '盘亏', '期末', '流水数'],
      ...data.rows.map((row) => [row.name, row.code, row.unit, row.opening, row.received, row.issued, row.lost, row.countGain, row.countLoss, row.closing, row.movementCount])]} />
  </View>} data={data.rows} recordKey={(row) => row.itemId}
    render={(row) => <ListRow title={row.name} detail={`入库 ${row.received} · 出库 ${row.issued} · 损耗 ${row.lost} · 盘亏 ${row.countLoss}`}
      value={`${row.closing} ${row.unit}`} />} />;
}

function ReceiptReport({ header, data, view, onView, drill }: {
  header: ReactNode; data: PurchaseReceiptReport; view: ReceiptView; onView: (value: ReceiptView) => void; drill: (filter: PurchaseFilters) => void;
}) {
  const { go } = useWorkspace();
  const summary = <View style={layout.stack}>
    {header}
    <Panel><ListRow title="实际收货金额" detail={`${data.summary.receiptCount} 笔收货 · ${data.summary.orderCount} 张采购单 · ${data.summary.supplierCount} 家供应商 · ${data.summary.materialCount} 种原料`}
      value={money(data.summary.totalCostCents / 100)} /></Panel>
    <Options values={[[ 'lines', '收货明细'], ['suppliers', '按供应商'], ['materials', '按原料']]} value={view} onChange={(value) => onView(value as ReceiptView)} />
  </View>;
  if (view === 'suppliers') return <ReportList key={view} header={<View style={layout.stack}>
    {summary}
    <ExportCsv name="lingdian-receipts-by-supplier" label="导出供应商汇总" rows={() => [['供应商', '编码', '收货笔数', '采购单数', '总额（元）'],
      ...data.suppliers.map((row) => [row.supplierName, row.supplierCode, row.receiptCount, row.orderCount, row.totalCostCents / 100])]} />
  </View>} data={data.suppliers} recordKey={(row) => row.supplierId} render={(row) => <ListRow title={row.supplierName}
    detail={`${row.supplierCode} · ${row.receiptCount} 笔收货 · ${row.orderCount} 张采购单`} value={money(row.totalCostCents / 100)}
    onPress={() => drill({ supplier: { id: row.supplierId, label: row.supplierName } })} />} />;
  if (view === 'materials') return <ReportList key={view} header={<View style={layout.stack}>
    {summary}
    <ExportCsv name="lingdian-receipts-by-material" label="导出原料汇总" rows={() => [['原料', '编码', '数量', '单位', '收货笔数', '总额（元）'],
      ...data.materials.map((row) => [row.itemName, row.itemCode, row.quantity, row.unit, row.receiptCount, row.totalCostCents / 100])]} />
  </View>} data={data.materials} recordKey={(row) => row.itemId} render={(row) => <ListRow title={row.itemName}
    detail={`${row.itemCode} · ${row.quantity} ${row.unit} · ${row.receiptCount} 笔收货`} value={money(row.totalCostCents / 100)}
    onPress={() => drill({ item: { id: row.itemId, label: row.itemName } })} />} />;
  return <ReportList key={view} header={<View style={layout.stack}>
    {summary}
    <ExportCsv name="lingdian-receipt-report" label="导出收货明细" rows={() => [['时间', '采购单号', '供应商', '原料', '数量', '单位', '单价（元）', '总额（元）', '备注'],
      ...data.rows.map((row) => [row.receivedAt, row.orderNo, row.supplierName, row.itemName, row.quantity, row.unit, row.unitPriceCents / 100, row.costCents / 100, row.note])]} />
  </View>} data={data.rows} recordKey={(row, index) => `${row.receiptId}:${row.itemId}:${index}`} render={(row) => <ListRow title={row.itemName}
    detail={[`${row.orderNo} · ${row.supplierName}`, `${row.quantity} ${row.unit} · ${localTime(row.receivedAt)}`, row.note].filter(Boolean).join('\n')}
    value={money(row.costCents / 100)} onPress={() => go({ type: 'record', name: 'purchases', id: row.orderId })} />} />;
}

function Replenishment() {
  const { inventory } = useMerchantPaths();
  const { go } = useWorkspace();
  const [search, setSearch] = useState('');
  const [item, setItem] = useState<Pick>();
  const [applied, apply] = useState<{ keyword?: string; item?: Pick }>({});
  const [filter, setFilter] = useState('');
  const [focusedId, setFocusedId] = useState<string>();
  const query = useData<ReplenishmentSnapshot>(endpoint(`${inventory}/purchases/replenishment`, { keyword: applied.keyword, itemId: applied.item?.id }));
  const rows = useMemo(() => {
    const items = query.data?.rows ?? [];
    if (filter === 'needed') return items.filter((row) => row.recommendedQuantity > 0);
    if (filter === 'covered') return items.filter((row) => row.recommendedQuantity === 0 && (row.availableQuantity ?? row.quantity) < row.reorderPoint);
    return items;
  }, [filter, query.data?.rows]);
  const applySearch = () => {
    const keyword = search.trim();
    if ((applied.keyword ?? '') === keyword && applied.item?.id === item?.id) void query.refetch();
    else apply({ keyword, item });
  };
  const header = <View style={layout.stack}>
    <Field label="原料关键词" maxLength={120} value={search} onChangeText={setSearch} onSubmitEditing={applySearch} />
    <Picker<InventoryItemContract> label="指定原料" path={inventory} selected={item ? [item] : []} onSelect={([option]) => setItem(option)}
      map={(record) => ({ id: record.id, label: record.name, detail: record.code })} />
    {item && <Button label="清除原料筛选" variant="plain" onPress={() => setItem(undefined)} />}
    <Button label="查询" variant="secondary" onPress={applySearch} />
    {(applied.item || applied.keyword) && <Text style={layout.body}>{[applied.item?.label, applied.keyword].filter(Boolean).join(' · ')}</Text>}
    <ErrorLine message={query.isRefetchError ? humanError(query.error) : undefined} />
  </View>;
  if (!query.data) return <Page>{header}<DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} /></Page>;
  const data = query.data;
  const focused = focusedId ? data.rows.find((row) => row.id === focusedId) : undefined;
  const closeSheet = () => setFocusedId(undefined);
  return <>
    <ReportList header={<View style={layout.stack}>{header}
      <Text style={layout.muted}>{data.summary.neededCount} 种建议补货 · {data.summary.coveredCount} 种已由在途采购覆盖</Text>
      <Options values={[[ '', '全部原料'], ['needed', '待补货'], ['covered', '在途已覆盖']]} value={filter} onChange={setFilter} />
      <ExportCsv name="lingdian-replenishment" label="导出完整快照" rows={() => [['原料', '编码', '单位', '可用', '阈值', '在途单数', '待收', '建议补货'],
        ...data.rows.map((row) => [row.name, row.code, row.unit, row.availableQuantity ?? row.quantity, row.reorderPoint,
          row.pendingOrderCount, row.pendingQuantity, row.recommendedQuantity])]} />
    </View>} data={rows} recordKey={(row) => row.id} render={(row) => <ListRow title={row.name}
      detail={`可用 ${row.availableQuantity ?? row.quantity} · 待收 ${row.pendingQuantity} ${row.unit}`}
      value={`建议 ${row.recommendedQuantity}`} onPress={() => setFocusedId(row.id)} />} />
    <Sheet visible={!!focused} title={focused?.name ?? '补货建议'} onClose={closeSheet}>
      {focused && <>
        <Panel>
          <ListRow title="可用库存" value={`${focused.availableQuantity ?? focused.quantity} ${focused.unit}`} />
          <ListRow title="预警阈值" value={`${focused.reorderPoint} ${focused.unit}`} />
          <ListRow title="在途采购" detail={`${focused.pendingOrderCount} 张采购单`} value={`${focused.pendingQuantity} ${focused.unit}`} />
          <ListRow title="建议补货" value={`${focused.recommendedQuantity} ${focused.unit}`} />
        </Panel>
        {focused.recommendedQuantity > 0 && <Button label="按建议创建采购单" disabled={query.isFetching || query.isError} onPress={() => {
          closeSheet();
          go({ type: 'form', name: 'purchases', action: 'create', data: {
            itemId: focused.id, itemName: focused.name, unit: focused.unit, recommendedQuantity: focused.recommendedQuantity,
          } });
        }} />}
        {focused.pendingOrderCount > 0 && <Button label="查看在途采购" variant="secondary" onPress={() => {
          closeSheet();
          go({ type: 'collection', name: 'purchases', pendingItem: { id: focused.id, label: focused.name } });
        }} />}
        <Button label="查看原料库存" variant="plain" onPress={() => { closeSheet(); go({ type: 'record', name: 'inventory', id: focused.id }); }} />
      </>}
    </Sheet>
  </>;
}
