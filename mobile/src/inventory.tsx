import type {
  InventoryAlertRecord, InventoryItemContract, InventoryMaterialChangeRecord, InventoryMovementContract, InventoryRecipeRecord,
  InventoryUsageRow, PurchaseReceiptRecord, PurchaseRecord, StocktakeRecord, SupplierRecord,
} from '@lingdian/contracts';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useData, useMerchantPaths, useWorkspace } from './context';
import { formatChinaDate, localTime, money } from './format';
import { InventoryReport } from './inventory-reports';
import { DataState, Options, PagedList, period } from './operations';
import type { InventoryListRoute, InventoryRecordName, MaterialAction, StocktakeAction } from './routes';
import { Badge, Button, Empty, Field, layout, ListRow, Page, Panel, Section, Sheet } from './ui';

const movementNames: Record<string, string> = { RECEIVE: '入库', ISSUE: '出库', LOSS: '损耗', COUNT: '盘点', THRESHOLD: '阈值变更', RESERVE: '占用', RELEASE: '释放' };
const statusNames: Record<string, string> = {
  OPEN: '待跟进', ACKNOWLEDGED: '跟进中', RESOLVED: '已解除', ACTIVE: '使用中', ARCHIVED: '已停用', HEALTHY: '库存正常',
  LOW: '库存偏低', OUT: '已缺货', DRAFT: '草稿', POSTED: '已过账', CANCELLED: '已取消', PARTIAL: '部分到货', RECEIVED: '已收齐',
};

export function InventoryCollection({ route }: { route: InventoryListRoute }) {
  if (route.name === 'report' || route.name === 'replenishment' || route.name === 'receiptReport') return <InventoryReport name={route.name} />;
  return <Collection route={route} />;
}

function Collection({ route }: { route: InventoryListRoute }) {
  const { name } = route;
  const initialPendingItem = route.name === 'purchases' ? route.pendingItem : undefined;
  const { inventory } = useMerchantPaths();
  const { go } = useWorkspace();
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('');
  const [delivery, setDelivery] = useState('');
  const [before, setBefore] = useState('');
  const [appliedBefore, applyBefore] = useState('');
  const [pendingItem, setPendingItem] = useState(initialPendingItem);
  const [movement, setMovement] = useState<InventoryMovementContract>();

  if (name === 'inventory') return <PagedList<InventoryItemContract> path={inventory} title="原料库存" searchable add={() => go({ type: 'form', name, action: 'create' })} recordKey={(item) => item.id}
    filters={{ lifecycle: filter || 'ACTIVE', status }} controls={<>
      <Options values={[[ '', '使用中'], ['ARCHIVED', '已停用'], ['ALL', '全部']]} value={filter} onChange={setFilter} />
      <Options values={[[ '', '全部库存'], ['HEALTHY', '库存正常'], ['LOW', '库存偏低'], ['OUT', '已缺货']]} value={status} onChange={setStatus} />
    </>}
    render={(item) => <ListRow title={item.name} detail={`${item.code} · 可用 ${item.availableQuantity ?? item.quantity} ${item.unit}`}
      trailing={<Badge label={item.isActive === false ? '已停用' : statusNames[item.status]} tone={item.status === 'OUT' ? 'red' : item.status === 'LOW' ? 'amber' : 'green'} />}
      onPress={() => go({ type: 'record', name, id: item.id })} />} />;
  if (name === 'alerts') return <PagedList<InventoryAlertRecord> path={`${inventory}/alerts`} title="库存预警" searchable recordKey={(item) => item.id}
    filters={{ status: filter || 'ACTIVE', severity: status }} controls={<>
      <Options values={[[ '', '待处理'], ['OPEN', '待跟进'], ['ACKNOWLEDGED', '跟进中'], ['RESOLVED', '已解除'], ['ALL', '全部']]} value={filter} onChange={setFilter} />
      <Options values={[[ '', '全部等级'], ['LOW', '库存偏低'], ['OUT', '已缺货']]} value={status} onChange={setStatus} />
    </>}
    render={(item) => <ListRow title={item.name} detail={`${statusNames[item.severity]} · 可用 ${item.availableLatest} ${item.unit}`}
      trailing={<Badge label={statusNames[item.status]} tone={item.status === 'RESOLVED' ? 'green' : 'amber'} />} onPress={() => go({ type: 'record', name, id: item.id })} />} />;
  if (name === 'recipes') return <PagedList<InventoryRecipeRecord> path={`${inventory}/recipes`} title="SKU 配方" searchable recordKey={(item) => item.skuId}
    render={(item) => <ListRow title={item.productName} detail={`${item.skuName} · ${item.entries.length} 种原料`} onPress={() => go({ type: 'record', name, id: item.skuId })} />} />;
  if (name === 'suppliers') return <PagedList<SupplierRecord> path={`${inventory}/suppliers`} title="供应商" searchable add={() => go({ type: 'form', name, action: 'create' })} recordKey={(item) => item.id}
    filters={{ status: filter || 'ALL' }} controls={<Options values={[[ '', '全部'], ['ACTIVE', '合作中']]} value={filter} onChange={setFilter} />}
    render={(item) => <ListRow title={item.name} detail={item.contact || item.code}
      trailing={<Badge label={item.isActive ? '合作中' : '已停用'} tone={item.isActive ? 'green' : 'amber'} />}
      onPress={() => go({ type: 'form', name, action: 'edit', id: item.id, data: { ...item } })} />} />;
  if (name === 'purchases') {
    const selectedDelivery = delivery === 'BEFORE' && !appliedBefore ? '' : delivery;
    const endBefore = period(before, before)?.endAt;
    const statuses: Array<[string, string]> = [[ '', pendingItem ? '全部在途' : '全部'], ['OPEN', '待收货'], ['PARTIAL', '部分到货']];
    if (!pendingItem) statuses.push(['RECEIVED', '已收齐'], ['CANCELLED', '已取消']);
    return <PagedList<PurchaseRecord> path={`${inventory}/purchases`} title="采购单" searchable add={() => go({ type: 'form', name, action: 'create' })} recordKey={(item) => item.id}
      filters={{ status: filter || (pendingItem ? 'ACTIVE' : 'ALL'), pendingItemId: pendingItem?.id, delivery: selectedDelivery,
        expectedBefore: selectedDelivery === 'BEFORE' ? appliedBefore : undefined }}
      controls={<>
        {pendingItem && <Panel><ListRow title={`在途原料：${pendingItem.label}`}
          trailing={<Button label="清除原料筛选" variant="plain" onPress={() => { setPendingItem(undefined); setFilter(''); }} />} /></Panel>}
        <Options values={statuses} value={filter} onChange={setFilter} />
        <Options values={[[ '', '全部到货日期'], ['BEFORE', '截止日前到货'], ['UNDATED', '未定日期']]} value={delivery} onChange={setDelivery} />
        {delivery === 'BEFORE' && <>
          <Field label="截止日期" placeholder="YYYY-MM-DD" value={before} onChangeText={setBefore} maxLength={10} />
          <Button label="应用截止日期" variant="secondary" disabled={!endBefore} onPress={() => { if (endBefore) applyBefore(endBefore); }} />
        </>}
      </>}
      render={(item) => <ListRow title={item.orderNo} detail={`${item.supplierName} · ${money(item.totalCostCents / 100)}\n计划到货 ${formatChinaDate(item.expectedAt) || '未定'}`}
        trailing={<Badge label={item.status === 'OPEN' ? '待收货' : statusNames[item.status]} />} onPress={() => go({ type: 'record', name, id: item.id })} />} />;
  }
  if (name === 'stocktakes') return <PagedList<StocktakeRecord> path={`${inventory}/stocktakes`} title="库存盘点" searchable add={() => go({ type: 'form', name, action: 'create' })} recordKey={(item) => item.id}
    filters={{ status: filter || 'ALL' }} controls={<Options values={[[ '', '全部'], ['DRAFT', '草稿'], ['POSTED', '已过账'], ['CANCELLED', '已取消']]} value={filter} onChange={setFilter} />}
    render={(item) => <ListRow title={item.title} detail={localTime(item.createdAt)} trailing={<Badge label={statusNames[item.status]} />} onPress={() => go({ type: 'record', name, id: item.id })} />} />;
  if (name === 'movements') return <>
    <PagedList<InventoryMovementContract> path={`${inventory}/movements`} title="库存流水" searchable recordKey={(item) => item.id}
      filters={{ kind: filter }} controls={<Options values={[[ '', '全部'], ...Object.entries(movementNames)]} value={filter} onChange={setFilter} />}
      render={(item) => <ListRow title={item.itemName} detail={`${movementNames[item.kind]} · ${localTime(item.createdAt)}`}
        value={`${item.amount} ${item.unit}`} onPress={() => setMovement(item)} />} />
    <Sheet title="流水详情" visible={!!movement} onClose={() => setMovement(undefined)}>
      {movement && <>
        <Text style={layout.strong}>{movement.itemName} · {movementNames[movement.kind]}</Text>
        <ListRow title="库存前后" detail={`${movement.quantityBefore} → ${movement.quantityAfter} ${movement.unit}`} />
        <ListRow title="操作原因" detail={movement.reason} />
        <ListRow title="操作时间" detail={localTime(movement.createdAt)} />
        {movement.purchaseOrderId && <Button label="查看采购单" variant="secondary" onPress={() => { setMovement(undefined); go({ type: 'record', name: 'purchases', id: movement.purchaseOrderId! }); }} />}
        {movement.stocktakeId && <Button label="查看盘点单" variant="secondary" onPress={() => { setMovement(undefined); go({ type: 'record', name: 'stocktakes', id: movement.stocktakeId! }); }} />}
      </>}
    </Sheet>
  </>;
  return <Empty title="未找到业务入口" />;
}

export function InventoryRecord({ name, id }: { name: InventoryRecordName; id: string }) {
  if (name === 'trend') return <InventoryReport name={name} id={id} />;
  if (name === 'usage' || name === 'changes' || name === 'receipts') return <Related name={name} id={id} />;
  if (name === 'inventory') return <MaterialRecord id={id} />;
  if (name === 'alerts') return <AlertRecord id={id} />;
  if (name === 'recipes') return <RecipeRecord id={id} />;
  if (name === 'purchases') return <PurchaseDetail id={id} />;
  if (name === 'stocktakes') return <StocktakeDetail id={id} />;
  return <Empty title="未找到业务记录" />;
}

function MaterialRecord({ id }: { id: string }) {
  const { inventory } = useMerchantPaths();
  const { go } = useWorkspace();
  const query = useData<InventoryItemContract>(`${inventory}/items/${encodeURIComponent(id)}`);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  const item = query.data;
  const edit = (action: MaterialAction) => go({ type: 'form', name: 'inventory', action, id });
  return <Page>
    <View style={layout.split}><Text style={[layout.heading, layout.flex]}>{item.name}</Text><Badge label={item.isActive === false ? '已停用' : statusNames[item.status]} /></View>
    <Panel>
      <ListRow title="原料编号" detail={item.code} />
      <ListRow title="账面库存" value={`${item.quantity} ${item.unit}`} />
      <ListRow title="可用库存" value={`${item.availableQuantity ?? item.quantity} ${item.unit}`} />
      <ListRow title="已占用" value={`${item.reservedQuantity ?? 0} ${item.unit}`} />
      <ListRow title="预警阈值" value={`${item.reorderPoint} ${item.unit}`} />
      {item.lifecycleReason && <ListRow title="最近启停原因" detail={item.lifecycleReason} />}
    </Panel>
    <Section title="原料记录"><Panel>
      <ListRow title="库存趋势" icon="trending-up-outline" onPress={() => go({ type: 'record', name: 'trend', id })} />
      <ListRow title="关联业务" icon="git-network-outline" onPress={() => go({ type: 'record', name: 'usage', id })} />
      <ListRow title="变更历史" icon="time-outline" onPress={() => go({ type: 'record', name: 'changes', id })} />
    </Panel></Section>
    <Section title="库存操作">
      {item.isActive !== false && <>
        <Button label="登记库存变动" onPress={() => edit('adjust')} />
        <Button label="更改名称" variant="secondary" onPress={() => edit('rename')} />
      </>}
      <Button label={item.isActive === false ? '恢复原料' : '停用原料'} variant={item.isActive === false ? 'secondary' : 'danger'} onPress={() => edit('lifecycle')} />
    </Section>
  </Page>;
}

function AlertRecord({ id }: { id: string }) {
  const { inventory } = useMerchantPaths();
  const { go } = useWorkspace();
  const query = useData<InventoryAlertRecord>(`${inventory}/alerts/${encodeURIComponent(id)}`);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  const item = query.data;
  return <Page>
    <View style={layout.split}><Text style={[layout.heading, layout.flex]}>{item.name}</Text><Badge label={statusNames[item.status]} tone={item.status === 'RESOLVED' ? 'green' : 'amber'} /></View>
    <Panel>
      <ListRow title="预警类型" detail={statusNames[item.severity]} />
      <ListRow title="当前可用量" value={`${item.availableLatest} ${item.unit}`} />
      <ListRow title="预警阈值" value={`${item.thresholdLatest} ${item.unit}`} />
      <ListRow title="触发时间" detail={localTime(item.detectedAt)} />
      {!!item.note && <ListRow title="跟进记录" detail={item.note} />}
      {!!item.resolvedAt && <ListRow title="解除时间" detail={localTime(item.resolvedAt)} />}
      <ListRow title="查看原料" onPress={() => go({ type: 'record', name: 'inventory', id: item.itemId })} />
    </Panel>
    {item.status === 'OPEN' && <Button label="确认跟进" onPress={() => go({ type: 'form', name: 'alerts', action: 'acknowledge', id })} />}
  </Page>;
}

function RecipeRecord({ id }: { id: string }) {
  const { inventory } = useMerchantPaths();
  const { go } = useWorkspace();
  const query = useData<InventoryRecipeRecord>(`${inventory}/recipes/${encodeURIComponent(id)}`);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  const item = query.data;
  return <Page>
    <Section title={item.productName}>
      <Text style={layout.muted}>{item.skuName}</Text>
      {item.entries.length ? <Panel>{item.entries.map((entry) => <ListRow key={entry.itemId} title={entry.name} detail={entry.code}
        value={`${entry.quantity} ${entry.unit}`} onPress={() => go({ type: 'record', name: 'inventory', id: entry.itemId })} />)}</Panel>
        : <Empty title="该规格尚未设置配方" />}
      <Button label="编辑配方" onPress={() => go({ type: 'form', name: 'recipes', action: 'edit', id })} />
    </Section>
  </Page>;
}

function PurchaseDetail({ id }: { id: string }) {
  const { inventory } = useMerchantPaths();
  const { go } = useWorkspace();
  const query = useData<PurchaseRecord>(`${inventory}/purchases/${encodeURIComponent(id)}`);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  const record = query.data;
  const open = record.status === 'OPEN' || record.status === 'PARTIAL';
  return <Page>
    <View style={layout.split}><Text style={[layout.heading, layout.flex]}>{record.orderNo}</Text><Badge label={record.status === 'OPEN' ? '待收货' : statusNames[record.status]} /></View>
    <Panel>
      <ListRow title="供应商" detail={record.supplierName} />
      <ListRow title="计划到货日期" detail={formatChinaDate(record.expectedAt) || '未定'} />
      <ListRow title="计划金额" value={money(record.totalCostCents / 100)} />
      <ListRow title="已收金额" value={money(record.receivedCostCents / 100)} />
      {!!record.note && <ListRow title="采购备注" detail={record.note} />}
      {!!record.cancelReason && <ListRow title="取消原因" detail={record.cancelReason} />}
    </Panel>
    <Section title="采购明细"><Panel>
      {record.lines.map((line) => <ListRow key={line.id} title={line.itemName}
        detail={`已收 ${line.receivedQuantity} / ${line.quantity} ${line.unit}`} value={money(line.unitPriceCents / 100)} />)}
    </Panel></Section>
    <Button label="查看收货记录" variant="secondary" onPress={() => go({ type: 'record', name: 'receipts', id })} />
    {open && <>
      <Button label="登记到货" onPress={() => go({ type: 'form', name: 'purchases', action: 'receive', id })} />
      <Button label="取消采购单" variant="danger" onPress={() => go({ type: 'form', name: 'purchases', action: 'cancel', id })} />
    </>}
  </Page>;
}

function StocktakeDetail({ id }: { id: string }) {
  const { inventory } = useMerchantPaths();
  const { go } = useWorkspace();
  const query = useData<StocktakeRecord>(`${inventory}/stocktakes/${encodeURIComponent(id)}`);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  const record = query.data;
  const action = (value: StocktakeAction) => go({ type: 'form', name: 'stocktakes', action: value, id });
  return <Page>
    <View style={layout.split}><Text style={[layout.heading, layout.flex]}>{record.title}</Text><Badge label={statusNames[record.status]} /></View>
    <Text style={layout.muted}>{record.note} · {localTime(record.createdAt)}</Text>
    <Section title="盘点原料"><Panel>{record.lines.map((line) => <ListRow key={line.id} title={line.itemName}
      detail={`快照 ${line.expectedQuantity} · 当前 ${line.currentQuantity} ${line.unit}`}
      value={line.countedQuantity === null ? '未盘点' : `实盘 ${line.countedQuantity}`} />)}</Panel></Section>
    {record.status === 'DRAFT' && <Section title="盘点操作">
      <Button label="录入盘点结果" onPress={() => action('counts')} />
      <Button label="更新库存快照" variant="secondary" onPress={() => action('recount')} />
      <Button label="盘点过账" variant="secondary" disabled={record.lines.some((line) => line.countedQuantity === null)} onPress={() => action('post')} />
      <Button label="取消盘点" variant="danger" onPress={() => action('cancel')} />
    </Section>}
  </Page>;
}

function Related({ name, id }: { name: string; id: string }) {
  const { inventory } = useMerchantPaths();
  const { go } = useWorkspace();
  const [view, setView] = useState('RECIPES');
  const [receipt, selectReceipt] = useState<PurchaseReceiptRecord>();
  const item = `${inventory}/items/${encodeURIComponent(id)}`;
  if (name === 'changes') return <PagedList<InventoryMaterialChangeRecord> title="原料变更记录" path={`${item}/changes`} recordKey={(row) => row.id}
    render={(row) => <ListRow title={row.kind === 'NAME' ? `更名为 ${row.nameAfter}` : row.kind === 'ARCHIVE' ? '停用原料' : '恢复原料'}
      detail={`${row.reason} · ${localTime(row.createdAt)}`} />} />;
  if (name === 'usage') {
    const usageId = (row: InventoryUsageRow) => row.kind === 'RECIPES' ? row.skuId : row.kind === 'PURCHASES' ? row.orderId : row.stocktakeId;
    return <PagedList<InventoryUsageRow> title="关联业务" path={`${item}/usage`} filters={{ view }} recordKey={usageId}
      controls={<Options values={[[ 'RECIPES', '配方'], ['PURCHASES', '采购'], ['STOCKTAKES', '盘点']]} value={view} onChange={setView} />}
      render={(row) => <ListRow title={row.kind === 'RECIPES' ? row.productName : row.kind === 'PURCHASES' ? row.orderNo : row.title}
        detail={row.kind === 'RECIPES' ? row.skuName : row.kind === 'PURCHASES' ? row.supplierName : localTime(row.createdAt)}
        onPress={() => go({ type: 'record', name: row.kind === 'RECIPES' ? 'recipes' : row.kind === 'PURCHASES' ? 'purchases' : 'stocktakes', id: usageId(row) })} />} />;
  }
  return <>
    <PagedList<PurchaseReceiptRecord> title="收货记录" path={`${inventory}/purchases/${encodeURIComponent(id)}/receipts`}
      recordKey={(row) => row.id} render={(row) => <ListRow title={localTime(row.createdAt)} detail={row.note}
        value={money(row.totalCostCents / 100)} onPress={() => selectReceipt(row)} />} />
    <Sheet visible={!!receipt} title="收货明细" onClose={() => selectReceipt(undefined)}>
      {receipt?.lines.map((line) => <Panel key={line.lineId}><ListRow title={line.itemName} detail={`${line.quantity} ${line.unit}`} value={money(line.costCents / 100)} /></Panel>)}
    </Sheet>
  </>;
}
