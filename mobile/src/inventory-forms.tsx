import type { InventoryAlertRecord, InventoryItemContract, InventoryRecipeRecord, PurchaseRecord, StocktakeRecord, SupplierRecord } from '@lingdian/contracts';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useData, useMerchantPaths } from './context';
import { DataState, Options, Picker, Save, startDate, Toggle } from './operations';
import type { InventoryFormRoute, MaterialAction, PurchaseAction, StocktakeAction } from './routes';
import { Button, Empty, Field, layout, ListRow, Panel } from './ui';

type Pick = { id: string; label: string; detail?: string };
const quantity = /^\d+(?:\.\d{1,3})?$/;
const cents = /^\d+(?:\.\d{1,2})?$/;
const reasonLength = 240;

function useRequestId() {
  const latest = useRef<{ body: string; id: string }>(null);
  return (body: object) => {
    const signature = JSON.stringify(body);
    if (latest.current?.body !== signature) latest.current = { body: signature, id: randomUUID() };
    return latest.current.id;
  };
}

export function InventoryEditor({ route }: { route: InventoryFormRoute }) {
  switch (route.name) {
    case 'inventory':
      if (route.action === 'create') return <NewMaterial />;
      if (route.action === 'adjust' || route.action === 'rename' || route.action === 'lifecycle') {
        return <ExistingMaterialForm id={route.id} action={route.action} />;
      }
      break;
    case 'suppliers':
      if (route.action === 'create') return <SupplierForm />;
      if (route.action === 'edit') return <SupplierForm id={route.id} item={route.data} />;
      break;
    case 'purchases': {
      if (route.action === 'receive' || route.action === 'cancel') return <ExistingPurchase id={route.id} action={route.action} />;
      if (route.action !== 'create') break;
      const suggestion = route.data;
      return <NewPurchase suggestion={suggestion && { id: suggestion.itemId, label: suggestion.itemName, detail: suggestion.unit, quantity: suggestion.recommendedQuantity }} />;
    }
    case 'stocktakes':
      return route.action === 'create' ? <NewStocktake /> : <ExistingStocktake id={route.id} action={route.action} />;
    case 'alerts':
      if (route.action === 'acknowledge') return <ExistingAlert id={route.id} />;
      break;
    case 'recipes':
      if (route.action === 'edit') return <ExistingRecipe id={route.id} />;
      break;
  }
  return <Empty title="未找到编辑入口" />;
}

function MaterialPicker({ label, selected, onSelect, multiple }: { label: string; selected: Pick[]; onSelect: (items: Pick[]) => void; multiple?: boolean }) {
  const { inventory } = useMerchantPaths();
  return <Picker<InventoryItemContract> label={label} path={inventory} selected={selected} onSelect={onSelect} multiple={multiple}
    map={(item) => ({ id: item.id, label: item.name, detail: `${item.code} · ${item.unit}`, disabled: item.isActive === false })} />;
}

function NewMaterial() {
  const { inventory } = useMerchantPaths();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [point, setPoint] = useState('0');
  return <Save title="新增原料" path={inventory} method="POST"
    disabled={!/^[A-Za-z0-9_-]{1,64}$/.test(code.trim()) || !name.trim() || !unit.trim() || !quantity.test(point)}
    build={() => ({ code: code.trim(), name: name.trim(), unit: unit.trim(), reorderPoint: Number(point) })}>
    <Field label="原料编码" value={code} onChangeText={setCode} maxLength={64} placeholder="字母、数字、下划线或连字符" />
    <Field label="原料名称" value={name} onChangeText={setName} maxLength={120} />
    <Field label="单位" value={unit} onChangeText={setUnit} maxLength={16} placeholder="例如 千克" />
    <Field label="预警阈值" value={point} onChangeText={setPoint} keyboardType="decimal-pad" />
  </Save>;
}

function ExistingMaterialForm({ id, action }: { id: string; action: MaterialAction }) {
  const { inventory } = useMerchantPaths();
  const query = useData<InventoryItemContract>(`${inventory}/items/${encodeURIComponent(id)}`);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  return <MaterialFields item={query.data} action={action} />;
}

function MaterialFields({ item: initial, action }: { item: InventoryItemContract; action: MaterialAction }) {
  const [item] = useState(initial);
  const { inventory } = useMerchantPaths();
  const id = encodeURIComponent(item.id);
  const [name, setName] = useState(item.name);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('RECEIVE');
  const requestId = useRequestId();
  const isActive = item.isActive === false;
  const title = action === 'adjust' ? '登记库存变动' : action === 'rename' ? '更改原料名称' : isActive ? '恢复原料' : '停用原料';
  const path = action === 'adjust' ? `${inventory}/${id}/movements` : `${inventory}/items/${id}/${action === 'rename' ? 'name' : 'lifecycle'}`;

  return <Save title={title} path={path} method={action === 'adjust' ? 'POST' : 'PUT'}
    disabled={!reason.trim() || (action === 'rename' && !name.trim()) || (action === 'adjust' && !quantity.test(amount))}
    build={() => {
      const common = { expectedVersion: item.version, reason: reason.trim() };
      if (action === 'rename') return { ...common, name: name.trim() };
      if (action === 'lifecycle') return { ...common, isActive };
      const draft = { ...common, kind, amount: Number(amount) };
      return { ...draft, requestId: requestId(draft) };
    }}>
    <ListRow title={item.name} detail={`当前库存 ${item.quantity} ${item.unit}`} />
    {action === 'rename' && <Field label="新名称" value={name} onChangeText={setName} maxLength={120} />}
    {action === 'adjust' && <>
      <Options values={[[ 'RECEIVE', '入库'], ['ISSUE', '出库'], ['LOSS', '损耗'], ['COUNT', '录入库存量'], ['THRESHOLD', '调整预警阈值']]}
        value={kind} onChange={setKind} />
      <Field label={`数量（${item.unit}）`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
    </>}
    <Field label="操作原因" value={reason} onChangeText={setReason} maxLength={reasonLength} multiline />
  </Save>;
}

function ExistingAlert({ id }: { id: string }) {
  const { inventory } = useMerchantPaths();
  const path = `${inventory}/alerts/${encodeURIComponent(id)}`;
  const query = useData<InventoryAlertRecord>(path);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  return <AlertFields path={path} initial={query.data} />;
}

function AlertFields({ path, initial }: { path: string; initial: InventoryAlertRecord }) {
  const [item] = useState(initial);
  const [note, setNote] = useState('');
  if (item.status !== 'OPEN') return <Empty title="该预警已处理" />;
  return <Save title="确认跟进库存预警" label="确认跟进" path={`${path}/acknowledge`} method="POST" disabled={!note.trim()}
    build={() => ({ note: note.trim(), expectedVersion: item.version })}>
    <ListRow title={item.name} detail={`可用 ${item.availableLatest} ${item.unit}`} />
    <Field label="跟进记录" value={note} onChangeText={setNote} maxLength={reasonLength} multiline />
  </Save>;
}

function ExistingRecipe({ id }: { id: string }) {
  const { inventory } = useMerchantPaths();
  const path = `${inventory}/recipes/${encodeURIComponent(id)}`;
  const query = useData<InventoryRecipeRecord>(path);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  return <RecipeFields record={query.data} path={path} />;
}

function RecipeFields({ record: initial, path }: { record: InventoryRecipeRecord; path: string }) {
  const [record] = useState(initial);
  const [selected, setSelected] = useState<Pick[]>(record.entries.map((item) => ({ id: item.itemId, label: item.name, detail: item.unit })));
  const [amounts, setAmounts] = useState<Record<string, string>>(Object.fromEntries(record.entries.map((item) => [item.itemId, String(item.quantity)])));
  return <Save title="编辑 SKU 配方" path={path} method="PUT"
    disabled={selected.length > 20 || selected.some(({ id }) => !quantity.test(amounts[id] ?? '') || Number(amounts[id]) <= 0)}
    build={() => ({ expectedVersion: record.version, entries: selected.map(({ id }) => ({ itemId: id, quantity: Number(amounts[id]) })) })}>
    <ListRow title={record.productName} detail={record.skuName} />
    <MaterialPicker label="配方原料（最多 20 种）" selected={selected} onSelect={setSelected} multiple />
    {selected.map((item) => <Field key={item.id} label={`${item.label}用量`} value={amounts[item.id] ?? ''}
      onChangeText={(value) => setAmounts({ ...amounts, [item.id]: value })} keyboardType="decimal-pad" />)}
    {!selected.length && record.entries.length > 0 && <Text style={layout.muted}>保存后将清空此规格的配方。</Text>}
  </Save>;
}

function SupplierForm({ id, item }: { id?: string; item?: Partial<SupplierRecord> }) {
  const { inventory } = useMerchantPaths();
  const path = `${inventory}/suppliers`;
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [contact, setContact] = useState(item?.contact ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [active, setActive] = useState(item?.isActive ?? true);
  return <Save title={id ? '编辑供应商' : '新增供应商'} path={id ? `${path}/${encodeURIComponent(id)}` : path}
    method={id ? 'PUT' : 'POST'} disabled={!/^[A-Za-z0-9_-]{1,64}$/.test(code.trim()) || !name.trim()}
    build={() => ({ code: code.trim(), name: name.trim(), contact: contact.trim(), note: note.trim(), isActive: active, ...(id ? { expectedVersion: item?.version } : {}) })}>
    <Field label="供应商编码" value={code} onChangeText={setCode} maxLength={64} />
    <Field label="供应商名称" value={name} onChangeText={setName} maxLength={120} />
    <Field label="联系方式" value={contact} onChangeText={setContact} maxLength={191} />
    <Field label="备注" value={note} onChangeText={setNote} maxLength={reasonLength} multiline />
    <Toggle label="启用供应商" value={active} onChange={setActive} />
  </Save>;
}

function NewPurchase({ suggestion }: { suggestion?: Pick & { quantity: number } }) {
  const { inventory } = useMerchantPaths();
  const [supplier, setSupplier] = useState<Pick[]>([]);
  const [material, setMaterials] = useState<Pick[]>(suggestion ? [suggestion] : []);
  const [expected, setExpected] = useState('');
  const [note, setNote] = useState('');
  const [line, setLine] = useState<Record<string, { quantity: string; price: string }>>(() => suggestion
    ? { [suggestion.id]: { quantity: suggestion.quantity <= 999999 ? String(suggestion.quantity) : '', price: '' } }
    : {});
  const requestId = useRequestId();
  const clear = (id: string) => setMaterials(material.filter((item) => item.id !== id));
  const set = (id: string, key: 'quantity' | 'price', value: string) => setLine({ ...line,
    [id]: { ...(line[id] ?? { quantity: '', price: '' }), [key]: value } });
  const valid = supplier.length > 0 && material.length > 0 && material.length <= 50
    && material.every(({ id }) => quantity.test(line[id]?.quantity ?? '') && Number(line[id].quantity) > 0
      && Number(line[id].quantity) <= 999999 && cents.test(line[id]?.price ?? '') && Number(line[id].price) <= 999999.99)
    && (!expected || !!startDate(expected));
  return <Save title="新建采购单" path={`${inventory}/purchases`} method="POST" disabled={!valid}
    build={() => {
      const draft = { supplierId: supplier[0]?.id, note: note.trim(), expectedAt: startDate(expected)?.toISOString(),
        lines: material.map(({ id }) => ({ itemId: id, quantity: Number(line[id].quantity), unitPrice: Number(line[id].price) })) };
      return { ...draft, requestId: requestId(draft) };
    }}>
    <Picker<SupplierRecord> label="供应商" path={`${inventory}/suppliers`} selected={supplier} onSelect={setSupplier} filters={{ status: 'ACTIVE' }}
      map={(item) => ({ id: item.id, label: item.name, detail: item.contact })} />
    <Field label="计划到货日期（选填）" value={expected} onChangeText={setExpected} maxLength={10} placeholder="YYYY-MM-DD" />
    <Field label="备注" value={note} onChangeText={setNote} maxLength={reasonLength} multiline />
    <MaterialPicker label="采购原料（最多 50 种）" selected={material} onSelect={setMaterials} multiple />
    {material.map((item) => <Panel key={item.id} style={[layout.pad, layout.stack]}>
      <View style={layout.split}><Text style={[layout.strong, layout.flex]}>{item.label}</Text><Button label="移除" variant="plain" onPress={() => clear(item.id)} /></View>
      {suggestion?.id === item.id && <Text style={layout.muted}>建议补货 {suggestion.quantity} {suggestion.detail}</Text>}
      <Field label="采购数量" value={line[item.id]?.quantity ?? ''} onChangeText={(value) => set(item.id, 'quantity', value)} keyboardType="decimal-pad" maxLength={10} />
      <Field label="含税单价（元）" value={line[item.id]?.price ?? ''} onChangeText={(value) => set(item.id, 'price', value)} keyboardType="decimal-pad" maxLength={9} />
    </Panel>)}
  </Save>;
}

function ExistingPurchase({ id, action }: { id: string; action: PurchaseAction }) {
  const { inventory } = useMerchantPaths();
  const path = `${inventory}/purchases/${encodeURIComponent(id)}`;
  const query = useData<PurchaseRecord>(path);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  return <PurchaseFields path={path} item={query.data} action={action} />;
}

function PurchaseFields({ path, item: initial, action }: { path: string; item: PurchaseRecord; action: PurchaseAction }) {
  const [item] = useState(initial);
  const [note, setNote] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const requestId = useRequestId();
  const cancel = action === 'cancel';
  const pending = item.lines.filter((line) => line.quantity > line.receivedQuantity);
  const chosen = pending.filter(({ id }) => !!amounts[id]?.trim());
  const valid = !!note.trim() && (cancel || !!chosen.length && chosen.every((row) => quantity.test(amounts[row.id]) && Number(amounts[row.id]) > 0
    && Math.round(Number(amounts[row.id]) * 1000) <= Math.round((row.quantity - row.receivedQuantity) * 1000)));
  if (item.status !== 'OPEN' && item.status !== 'PARTIAL') return <Empty title="该采购单已结束" />;
  return <Save title={cancel ? '取消采购单' : '登记到货'} label={cancel ? '确认取消' : '确认收货'}
    path={`${path}/${cancel ? 'cancel' : 'receipts'}`} method="POST" disabled={!valid}
    build={() => {
      const base = { expectedVersion: item.version, note: note.trim() };
      if (cancel) return base;
      const draft = { ...base, lines: chosen.map((row) => ({ lineId: row.id, quantity: Number(amounts[row.id]) })) };
      return { ...draft, requestId: requestId(draft) };
    }}>
    <ListRow title={item.orderNo} detail={item.supplierName} />
    {cancel ? <Text style={layout.muted}>取消后停止后续收货，已收货记录保留。</Text> : pending.map((row) => <Field key={row.id}
      label={`${row.itemName} · 待收 ${Math.round((row.quantity - row.receivedQuantity) * 1000) / 1000} ${row.unit}`}
      value={amounts[row.id] ?? ''} onChangeText={(value) => setAmounts({ ...amounts, [row.id]: value })} keyboardType="decimal-pad" />)}
    <Field label={cancel ? '取消原因' : '收货说明'} value={note} onChangeText={setNote} maxLength={reasonLength} multiline />
  </Save>;
}

function NewStocktake() {
  const { inventory } = useMerchantPaths();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<Pick[]>([]);
  const requestId = useRequestId();
  return <Save title="新建盘点单" path={`${inventory}/stocktakes`} method="POST"
    disabled={!title.trim() || !note.trim() || !items.length || items.length > 50} build={() => {
      const draft = { title: title.trim(), note: note.trim(), itemIds: items.map(({ id }) => id) };
      return { ...draft, requestId: requestId(draft) };
    }}>
    <Field label="盘点标题" value={title} onChangeText={setTitle} maxLength={120} />
    <Field label="盘点说明" value={note} onChangeText={setNote} maxLength={reasonLength} multiline />
    <MaterialPicker label="盘点原料（最多 50 种）" selected={items} onSelect={setItems} multiple />
  </Save>;
}

function ExistingStocktake({ id, action }: { id: string; action: StocktakeAction }) {
  const { inventory } = useMerchantPaths();
  const path = `${inventory}/stocktakes/${encodeURIComponent(id)}`;
  const query = useData<StocktakeRecord>(path);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  return <StocktakeFields path={path} item={query.data} action={action} />;
}

function StocktakeFields({ path, item: initial, action }: { path: string; item: StocktakeRecord; action: StocktakeAction }) {
  const [item] = useState(initial);
  const counting = action === 'counts';
  const [values, setValues] = useState(() => Object.fromEntries(item.lines.map((line) => [line.id, line.countedQuantity === null ? '' : String(line.countedQuantity)])));
  const titles: Record<string, string> = { counts: '录入盘点数量', recount: '更新库存快照', post: '确认盘点过账', cancel: '确认取消盘点' };
  const hasCounts = item.lines.some((line) => line.countedQuantity !== null);
  const confirmation = {
    counts: undefined,
    recount: hasCounts ? '更新快照会清空已录入的盘点数量。' : undefined,
    post: '过账会按实盘数量更新库存。',
    cancel: '取消后保留已录入的盘点记录。',
  }[action];
  if (!titles[action] || item.status !== 'DRAFT') return <Empty title="当前盘点状态无法进行此操作" />;
  return <Save title={titles[action]} path={`${path}/${action}`} method={counting ? 'PUT' : 'POST'} label={counting ? '保存数量' : '确认'}
    disabled={counting && Object.values(values).some((value) => value !== '' && !quantity.test(value))}
    build={() => ({ expectedVersion: item.version, ...(counting ? { lines: item.lines.map((line) => ({
      lineId: line.id, countedQuantity: values[line.id] === '' ? null : Number(values[line.id]),
    })) } : {}) })}>
    <ListRow title={item.title} detail={item.note} />
    {counting ? item.lines.map((line) => <Field key={line.id} label={`${line.itemName}（${line.unit}）`}
      placeholder={`快照 ${line.expectedQuantity}`} value={values[line.id]} onChangeText={(value) => setValues({ ...values, [line.id]: value })}
      keyboardType="decimal-pad" />) : confirmation && <Text style={layout.muted}>{confirmation}</Text>}
  </Save>;
}
