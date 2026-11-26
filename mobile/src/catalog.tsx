import type {
  MerchantCategoryRecord, ProductConfigContract, ProductConfigSelectionBindingContract, ProductConfigSelectionGroupContract,
  ProductConfigSelectionOptionContract, ProductConfigVariantContract, ProductListItemContract, ProductRecordContract, ProductSkuOptionContract,
  ProductSkuContract, ProductStatus, ProductType,
} from '@lingdian/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { selectPhoto } from './photo-picker';
import { productDescription } from './product-description';
import { assetUrl, humanError } from './api';
import { useApi, useData, useMerchantPaths, useWorkspace } from './context';
import { money } from './format';
import { DataState, Options, PagedList, Picker, Save, Toggle } from './operations';
import type { CatalogFormRoute, SkuAction } from './routes';
import { Badge, Button, Empty, ErrorLine, Field, layout, ListRow, Page, Panel, Section, Sheet } from './ui';

const publicCatalogKey = ['public'] as const;

const products = '/merchant/products';
const states: Record<ProductStatus, string> = { DRAFT: '草稿', ACTIVE: '已上架', SOLD_OUT: '已售罄', ARCHIVED: '已归档' };
const editStates: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'], ACTIVE: ['SOLD_OUT', 'DRAFT', 'ARCHIVED'],
  SOLD_OUT: ['ACTIVE', 'DRAFT', 'ARCHIVED'], ARCHIVED: ['DRAFT'],
};

export function CatalogCollection({ name }: { name: 'products' | 'categories' }) {
  const { root } = useMerchantPaths();
  const { go } = useWorkspace();
  const [type, setType] = useState('');
  const stats = useData<{ total_count: number; active_count: number; sku_count: number }>(`${products}/stats`, name === 'products');
  if (name === 'categories') return <PagedList<MerchantCategoryRecord>
    path={`${root}/categories`} title="菜单分类" searchable recordKey={(item) => item.id}
    add={() => go({ type: 'form', name, action: 'create' })}
    render={(item) => <ListRow title={item.name} detail={`排序 ${item.sort_order} · ${item.product_count} 件商品`}
      trailing={<Badge label={item.is_visible ? '显示' : '隐藏'} tone={item.is_visible ? 'green' : 'amber'} />}
      onPress={() => go({ type: 'form', name, action: 'edit', id: item.id, data: { ...item } })} />} />;
  return <PagedList<ProductListItemContract> path={products} title="商品管理" searchable filters={{ type }}
    recordKey={(item) => item.id} add={() => go({ type: 'form', name, action: 'create' })}
    controls={<>
      {stats.data && <Text style={layout.muted}>{stats.data.total_count} 件商品 · {stats.data.active_count} 件已上架 · {stats.data.sku_count} 个规格</Text>}
      <Options values={[[ '', '全部类型'], ['SINGLE', '单品'], ['PACKAGE', '套餐']]} value={type} onChange={setType} />
    </>}
    render={(item) => <ListRow title={item.name} detail={`${item.category} · ${money(item.price)}`}
      trailing={<Badge label={states[item.status]} tone={item.status === 'ACTIVE' ? 'green' : 'purple'} />}
      onPress={() => go({ type: 'record', name, id: item.id })} />} />;
}

export function CatalogRecord({ id }: { id: string }) {
  const { go } = useWorkspace();
  const query = useData<ProductRecordContract>(`${products}/${encodeURIComponent(id)}`);
  const [selectedId, setSelectedId] = useState<string>();
  const item = query.data;
  if (!item) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  const image = assetUrl(item.image_url);
  const description = productDescription(item.description);
  const selected = item.skus.find((sku) => sku.id === selectedId);
  const openSkuEdit = (action: SkuAction) => {
    if (!selected) return;
    setSelectedId(undefined);
    go({ type: 'form', name: 'products', id, action, skuId: selected.id });
  };
  return <>
    <Page>
      <View style={layout.split}><Text style={[layout.heading, layout.flex]}>{item.name}</Text><Badge label={states[item.status]} /></View>
      {image && <Image source={image} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" />}
      <Panel>
        <ListRow title="分类" detail={item.category} />
        <ListRow title="商品类型" detail={item.type === 'PACKAGE' ? '套餐' : '单品'} value={money(item.price)} />
        {!!description && <ListRow title="商品说明" detail={description} />}
        <ListRow title="规格与选择组" detail={`${item.skus.length} 个规格 · ${item.selection_groups.length} 个选择组`} />
      </Panel>
      {!!item.skus.length && <Section title="商品规格"><Panel>
        {item.skus.map((sku, index) => <View key={sku.id}>
          {index > 0 && <View style={layout.separator} />}
          <ListRow title={sku.sku_name} detail={`参考库存 ${sku.stock_count}${sku.is_active ? '' : ' · 已停用'}`}
            value={money(sku.price)} onPress={() => setSelectedId(sku.id)} />
        </View>)}
      </Panel></Section>}
      <Section title="商品操作">
        <Button label="编辑商品资料" onPress={() => go({ type: 'form', name: 'products', id, action: 'edit' })} />
        <Button label="编辑规格与选择组" variant="secondary" onPress={() => go({ type: 'form', name: 'products', id, action: 'config' })} />
        <Button label="维护商品图片" variant="secondary" onPress={() => go({ type: 'form', name: 'products', id, action: 'image' })} />
        {editStates[item.status]?.length > 0 && <Button label="更新商品状态" variant="secondary" onPress={() => go({ type: 'form', name: 'products', id, action: 'status' })} />}
      </Section>
    </Page>
    {selected && <Sheet visible title={selected.sku_name} onClose={() => setSelectedId(undefined)}>
      <Button label="调整售价" onPress={() => openSkuEdit('sku-price')} />
      <Button label="调整参考库存" variant="secondary" onPress={() => openSkuEdit('sku-stock')} />
    </Sheet>}
  </>;
}

export function CatalogForm({ route }: { route: CatalogFormRoute }) {
  if (route.action === 'create') return route.name === 'categories' ? <CategoryForm /> : <ProductFields />;
  if (route.name === 'categories') return <CategoryForm id={route.id} initial={route.data} />;
  return <ExistingProductForm route={route} />;
}

type ExistingProductRoute = Extract<CatalogFormRoute, { name: 'products'; id: string }>;

function ExistingProductForm({ route }: { route: ExistingProductRoute }) {
  const query = useData<ProductRecordContract>(`${products}/${encodeURIComponent(route.id)}`);
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  if ('skuId' in route) {
    if (route.action !== 'sku-price' && route.action !== 'sku-stock') return <Empty title="未找到规格编辑入口" />;
    const sku = query.data.skus.find((entry) => entry.id === route.skuId);
    return sku
      ? <SkuValueForm product={query.data} sku={sku} action={route.action} />
      : <Empty title="规格已不可用" />;
  }
  return <ProductEditor action={route.action} initial={query.data} />;
}

function SkuValueForm({ product, sku, action }: { product: ProductRecordContract; sku: ProductSkuContract; action: SkuAction }) {
  const isPrice = action === 'sku-price';
  const [initial] = useState(() => ({
    version: product.configuration_version,
    value: isPrice ? sku.price : sku.stock_count,
  }));
  const [draft, setDraft] = useState(String(initial.value));
  const normalized = draft.trim().replace(',', '.');
  const valid = (isPrice ? /^\d{1,8}(?:\.\d{1,2})?$/ : /^\d{1,6}$/).test(normalized);
  const value = Number(normalized);
  const rangeMessage = isPrice ? '请输入 0 至 99999999.99 元，最多两位小数。' : '请输入 0 至 999999 的整数。';
  return <Save title={isPrice ? '调整售价' : '调整参考库存'}
    path={isPrice ? '/merchant/sku/update-price' : '/merchant/sku/update-stock'} method="POST"
    disabled={initial.version === undefined || !valid || value === initial.value} invalidateAlso={publicCatalogKey}
    build={() => ({ sku_id: sku.id, expected_version: initial.version, ...(isPrice ? { price: value } : { stock_count: value }) })}>
    <Panel><ListRow title={product.name} detail={sku.sku_name} value={isPrice ? money(initial.value) : String(initial.value)} /></Panel>
    <Field label={isPrice ? '新售价（元）' : '新参考库存'} value={draft} onChangeText={setDraft}
      keyboardType={isPrice ? 'decimal-pad' : 'number-pad'} maxLength={24} />
    <ErrorLine message={initial.version === undefined ? '商品版本暂不可用，请返回并刷新。' : normalized && !valid ? rangeMessage : undefined} />
  </Save>;
}

function ProductEditor({ action, initial }: { action: Exclude<ExistingProductRoute, { skuId: string }>['action']; initial: ProductRecordContract }) {
  const [product] = useState(initial);
  if (action === 'image') return <ProductImage product={product} />;
  if (action === 'status') return <ProductState product={product} />;
  if (action === 'config') return <ProductConfiguration product={product} />;
  if (action === 'edit') return <ProductFields product={product} />;
  return <Empty title="未找到商品编辑入口" />;
}

function CategoryForm({ id, initial }: { id?: string; initial?: Partial<MerchantCategoryRecord> }) {
  const { root } = useMerchantPaths();
  const [name, setName] = useState(initial?.name ?? '');
  const [sort, setSort] = useState(String(initial?.sort_order ?? 0));
  const [visible, setVisible] = useState(initial?.is_visible ?? true);
  return <Save title={id ? '编辑菜单分类' : '新增菜单分类'}
    path={id ? `${root}/categories/${encodeURIComponent(id)}` : `${root}/categories`}
    method={id ? 'PATCH' : 'POST'} disabled={!name.trim() || !/^\d+$/.test(sort)} invalidateAlso={publicCatalogKey}
    build={() => ({ name: name.trim(), ...(id ? { sort_order: Number(sort), is_visible: visible, expected_version: initial?.configuration_version } : {}) })}>
    <Field label="分类名称" value={name} onChangeText={setName} maxLength={120} />
    {id && <>
      <Field label="排序" value={sort} onChangeText={setSort} maxLength={7} keyboardType="number-pad" />
      <Toggle label="显示在菜单中" value={visible} onChange={setVisible} />
    </>}
  </Save>;
}

function ProductFields({ product }: { product?: ProductRecordContract }) {
  const { root } = useMerchantPaths();
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product ? [{ id: product.category_id, label: product.category }] : []);
  const initialDescription = productDescription(product?.description);
  const [description, setDescription] = useState(initialDescription);
  const [price, setPrice] = useState('');
  const [skuName, setSkuName] = useState('标准');
  const [featured, setFeatured] = useState(product?.is_featured ?? false);
  const attempt = useRef<{ encoded: string; id: string }>(null);
  function build() {
    const submittedDescription = product && description === initialDescription
      ? product.description ?? ''
      : productDescription(description);
    const detail = { name: name.trim(), category_id: category[0]?.id, description: submittedDescription, is_featured: featured };
    if (product) return { ...detail, expected_version: product.configuration_version };
    const draft = { ...detail, price: Number(price), sku_name: skuName.trim() };
    const encoded = JSON.stringify(draft);
    if (attempt.current?.encoded !== encoded) attempt.current = { encoded, id: randomUUID() };
    return { ...draft, requestId: attempt.current.id };
  }
  return <Save title={product ? '商品资料' : '新增商品'} path={product ? `${root}/products/${encodeURIComponent(product.id)}/details` : `${root}/products`}
    invalidateAlso={publicCatalogKey}
    method={product ? 'PATCH' : 'POST'} disabled={!name.trim() || !category.length || (!product && (!price.trim() || !skuName.trim() || !/^\d+(?:\.\d{1,2})?$/.test(price)))} build={build}>
    <Field label="商品名称" value={name} onChangeText={setName} maxLength={191} />
    <Picker<MerchantCategoryRecord> label="菜单分类" path={`${root}/categories`} selected={category} onSelect={setCategory}
      map={(item) => ({ id: item.id, label: item.name, detail: item.is_visible ? undefined : '当前隐藏' })} />
    <Field label="商品说明" value={description} onChangeText={setDescription} maxLength={2000} multiline />
    <Toggle label="推荐商品" value={featured} onChange={setFeatured} />
    {!product && <>
      <Field label="默认规格名称" value={skuName} onChangeText={setSkuName} maxLength={191} />
      <Field label="售价（元）" value={price} onChangeText={setPrice} keyboardType="decimal-pad" maxLength={11} />
    </>}
  </Save>;
}

function ProductState({ product }: { product: ProductRecordContract }) {
  const { root } = useMerchantPaths();
  const [next, setNext] = useState('');
  const labels: Record<ProductStatus, string> = { DRAFT: '移至草稿', ACTIVE: '上架', SOLD_OUT: '标为售罄', ARCHIVED: '归档' };
  return <Save title="更新商品状态" label="确认更新" path={`${root}/products/${encodeURIComponent(product.id)}/status`}
    method="PATCH" disabled={!next} invalidateAlso={publicCatalogKey} build={() => ({ expected_version: product.configuration_version, status: next })}>
    <ListRow title={product.name} detail={states[product.status]} />
    <Options values={editStates[product.status].map((status) => [status, labels[status]])} value={next} onChange={setNext} />
  </Save>;
}

function ProductImage({ product }: { product: ProductRecordContract }) {
  const { root } = useMerchantPaths();
  const api = useApi();
  const { show, back, isCurrent } = useWorkspace();
  const query = useQueryClient();
  const path = `${root}/products/${encodeURIComponent(product.id)}/image`;
  const [confirm, setConfirm] = useState(false);
  const version = product.configuration_version;
  const requestId = useRef(randomUUID());
  const upload = useMutation({
    mutationFn: async (remove: boolean) => {
      if (version === undefined) throw new Error('商品版本暂不可用，请刷新。');
      if (remove) return api.call(`${path}/remove`, { method: 'POST', body: { expected_version: version, requestId: requestId.current } });
      const form = await selectPhoto('file', 3 * 1024 * 1024);
      if (!form) return;
      form.append('requestId', requestId.current);
      form.append('expected_version', String(version));
      return api.call(path, { method: 'POST', body: form });
    },
    onSuccess: (data) => {
      if (!data) return;
      void query.invalidateQueries({ queryKey: [api.key] });
      void query.invalidateQueries({ queryKey: publicCatalogKey });
      if (!isCurrent()) return;
      show('商品图片已更新');
      back();
    },
  });
  const photo = assetUrl(product.image_url);
  return <Page>
    {photo ? <Image source={photo} style={styles.photo} contentFit="cover" /> : <Empty title="暂无商品图片" icon="image-outline" />}
    <Button label={photo ? '更换图片' : '添加图片'} onPress={() => upload.mutate(false)} busy={upload.isPending} />
    {photo && <Button label={confirm ? '确认移除图片' : '移除图片'} variant="danger" disabled={upload.isPending}
      onPress={() => confirm ? upload.mutate(true) : setConfirm(true)} />}
    {confirm && <Button label="取消" variant="plain" onPress={() => setConfirm(false)} />}
    <ErrorLine message={upload.error ? humanError(upload.error) : undefined} />
  </Page>;
}

type DraftVariant = Omit<ProductConfigVariantContract, 'price' | 'stock_count'> & { key: string; price: string; stock_count: string };
type DraftOption = Omit<ProductConfigSelectionOptionContract, 'price_delta' | 'stock_delta' | 'sort_order'> & { key: string; price_delta: string; stock_delta: string };
type DraftGroup = Omit<ProductConfigSelectionGroupContract, 'min_select' | 'max_select' | 'options'> & { min_select: string; max_select: string; options: DraftOption[] };
type DraftBinding = Omit<ProductConfigSelectionBindingContract, 'group'> & { key: string; group: DraftGroup };

const newVariant = (): DraftVariant => ({ key: randomUUID(), sku_name: '', price: '0', stock_count: '0', is_default: false, is_active: true });
const newOption = (): DraftOption => ({ key: randomUUID(), name: '', option_type: 'VALUE', price_delta: '0', stock_delta: '0', is_default: false, is_active: true });
const newGroup = (index: number): DraftBinding => ({
  key: randomUUID(), scope: 'PRODUCT', sort_order: index, is_enabled: true,
  group: { name: '', group_type: 'MODIFIER', selection_mode: 'SINGLE', min_select: '0', max_select: '1', is_required: false,
    is_active: true, sort_order: index, description: '', options: [newOption()] },
});

function ProductConfiguration({ product }: { product: ProductRecordContract }) {
  const [type, setType] = useState(product.type);
  const [variants, setVariants] = useState<DraftVariant[]>(() => product.skus.map((sku) => ({
    id: sku.id, key: sku.id, sku_name: sku.sku_name, price: String(sku.price), stock_count: String(sku.stock_count),
    is_default: sku.is_default, is_active: sku.is_active,
  })));
  const [bindings, setBindings] = useState<DraftBinding[]>(() => product.selection_groups.map((binding) => ({
    id: binding.binding_id, key: binding.binding_id, scope: binding.scope, target_variant_id: binding.target_variant_id ?? undefined,
    sort_order: binding.sort_order, is_enabled: binding.is_enabled,
    group: { ...binding.group, min_select: String(binding.group.min_select), max_select: String(binding.group.max_select),
      description: binding.group.description ?? '', options: binding.group.options.map((item) => ({
        id: item.id, key: item.id, name: item.name, option_type: item.option_type,
        price_delta: String(item.price_delta), stock_delta: String(item.stock_delta),
        is_active: item.is_active, is_default: item.is_default, referenced_sku_id: item.referenced_sku_id ?? undefined,
      })),
    },
  })));
  const skuOptions = useData<ProductSkuOptionContract[]>(`${products}/sku-options`, bindings.some(({ group }) => group.options.some((item) => item.option_type === 'VARIANT')));
  const [expandedVariant, setExpandedVariant] = useState('');
  const [expandedGroup, setExpandedGroup] = useState('');
  const [expandedOption, setExpandedOption] = useState('');
  const updateVariant = (old: DraftVariant, changes: Partial<DraftVariant>) => setVariants(variants.map((sku) => sku.key === old.key ? { ...sku, ...changes }
    : changes.is_default ? { ...sku, is_default: false } : sku));
  const updateBinding = (entry: DraftBinding, changes: Partial<DraftBinding>) => setBindings(bindings.map((item) => item.key === entry.key ? { ...item, ...changes } : item));
  const updateGroup = (entry: DraftBinding, changes: Partial<DraftGroup>) => updateBinding(entry, { group: { ...entry.group, ...changes } });
  const updateOption = (entry: DraftBinding, option: DraftOption, changes: Partial<DraftOption>) => updateGroup(entry, {
    options: entry.group.options.map((item) => item.key === option.key ? { ...item, ...changes } : item),
  });

  function build(): ProductConfigContract {
    if (product.configuration_version === undefined) throw new Error('商品版本暂不可用，请刷新。');
    if (!variants.length || variants.some((item) => !item.sku_name.trim() || !/^\d+(?:\.\d{1,2})?$/.test(item.price) || !/^\d+$/.test(item.stock_count))) {
      throw new Error('请检查规格名称、售价和参考库存。');
    }
    const groups = bindings.map(({ key, group, ...binding }, idx) => {
      const { options, min_select, max_select, ...base } = group;
      const min = Number(min_select), max = Number(max_select);
      if (!base.name.trim() || !options.length || !/^\d+$/.test(min_select) || !/^\d+$/.test(max_select) || min > max || (base.selection_mode === 'SINGLE' && max > 1)) {
        throw new Error('请检查选择组名称、最少和最多选择数，并添加至少一个选项。');
      }
      if (binding.scope === 'VARIANT' && !binding.target_variant_id) throw new Error('请选择绑定的现有规格。');
      return {
        ...binding, sort_order: idx,
        ...(binding.scope === 'PRODUCT' ? { target_variant_id: undefined } : {}),
        group: { ...base, min_select: min, max_select: max, options: options.map(({ key: optionKey, price_delta, stock_delta, ...option }, index) => {
          if (!option.name.trim() || !/^\d+(?:\.\d{1,2})?$/.test(price_delta) || !/^-?\d+$/.test(stock_delta)
            || (option.option_type === 'VARIANT' && !option.referenced_sku_id)) throw new Error('请检查选项名称、加价、库存增量及引用规格。');
          return { ...option, price_delta: Number(price_delta), stock_delta: Number(stock_delta), sort_order: index };
        }) },
      };
    });
    return {
      expected_version: product.configuration_version, type,
      variants: variants.map(({ key, price, stock_count, ...sku }) => ({ ...sku, price: Number(price), stock_count: Number(stock_count) })),
      selection_groups: groups,
    };
  }

  return <Save title="规格与选择组" path={`${products}/${encodeURIComponent(product.id)}/config`} method="PUT" invalidateAlso={publicCatalogKey} build={build}>
    <Options values={[[ 'SINGLE', '单品'], ['PACKAGE', '套餐']]} value={type} onChange={(value) => setType(value as ProductType)} />
    <Section title="规格" accessory={<Button label="添加规格" variant="plain" onPress={() => {
      const item = newVariant(); setVariants([...variants, item]); setExpandedVariant(item.key);
    }} />}>
      {variants.map((item) => <Panel key={item.key}>
        <ListRow title={item.sku_name || '新规格'} detail={`${item.is_default ? '默认 · ' : ''}${item.is_active ? '已启用' : '已停用'}`}
          onPress={() => setExpandedVariant(expandedVariant === item.key ? '' : item.key)} />
        {expandedVariant === item.key && <View style={[layout.pad, layout.stack]}>
          <Field label="规格名称" value={item.sku_name} onChangeText={(sku_name) => updateVariant(item, { sku_name })} maxLength={191} />
          <Field label="售价" value={item.price} onChangeText={(price) => updateVariant(item, { price })} keyboardType="decimal-pad" />
          <Field label="参考库存" value={item.stock_count} onChangeText={(stock_count) => updateVariant(item, { stock_count })} keyboardType="number-pad" />
          <Toggle label="启用规格" value={item.is_active} onChange={(is_active) => updateVariant(item, { is_active, ...(is_active ? {} : { is_default: false }) })} />
          <Toggle label="设为默认规格" value={item.is_default} onChange={(is_default) => updateVariant(item, { is_default })} disabled={!item.is_active} />
          {!item.id && <Button label="移除此规格" variant="danger" onPress={() => setVariants(variants.filter((sku) => sku.key !== item.key))} />}
        </View>}
      </Panel>)}
    </Section>
    <Section title="选择组" accessory={<Button label="添加选择组" variant="plain" onPress={() => {
      const item = newGroup(bindings.length); setBindings([...bindings, item]); setExpandedGroup(item.key);
    }} />}>
      {bindings.map((entry) => {
        const group = entry.group;
        return <Panel key={entry.key}>
          <ListRow title={group.name || '新选择组'} detail={`${group.options.length} 个选项`} onPress={() => setExpandedGroup(expandedGroup === entry.key ? '' : entry.key)} />
          {expandedGroup === entry.key && <View style={[layout.pad, layout.stack]}>
            <Field label="选择组名称" value={group.name} onChangeText={(name) => updateGroup(entry, { name })} maxLength={191} />
            <Field label="说明（选填）" value={group.description} onChangeText={(description) => updateGroup(entry, { description })} maxLength={191} />
            <Options values={[[ 'PRODUCT', '商品级'], ['VARIANT', '指定规格']]} value={entry.scope}
              onChange={(scope) => updateBinding(entry, { scope: scope as DraftBinding['scope'] })} />
            {entry.scope === 'VARIANT' && <Options values={variants.filter((item) => item.id).map((item) => [item.id!, item.sku_name])}
              value={entry.target_variant_id ?? ''} onChange={(target_variant_id) => updateBinding(entry, { target_variant_id })} />}
            <Options values={[[ 'MODIFIER', '加料或口味'], ['COMPONENT', '套餐组成']]} value={group.group_type}
              onChange={(value) => updateGroup(entry, { group_type: value as DraftGroup['group_type'] })} />
            <Options values={[[ 'SINGLE', '单选'], ['MULTIPLE', '多选']]} value={group.selection_mode}
              onChange={(value) => updateGroup(entry, { selection_mode: value as DraftGroup['selection_mode'], ...(value === 'SINGLE' ? { max_select: '1', min_select: '0' } : {}) })} />
            <Field label="最少选择数" value={group.min_select} onChangeText={(min_select) => updateGroup(entry, { min_select })} keyboardType="number-pad" maxLength={2} />
            <Field label="最多选择数" value={group.max_select} onChangeText={(max_select) => updateGroup(entry, { max_select })} keyboardType="number-pad" maxLength={2} />
            <Toggle label="顾客必须选择" value={group.is_required} onChange={(is_required) => updateGroup(entry, { is_required })} />
            <Toggle label="选择组启用" value={group.is_active} onChange={(is_active) => updateGroup(entry, { is_active })} />
            <Toggle label="在当前范围使用" value={entry.is_enabled} onChange={(is_enabled) => updateBinding(entry, { is_enabled })} />
            {group.options.map((option) => <Panel key={option.key}>
              <ListRow title={option.name || '新选项'} onPress={() => setExpandedOption(expandedOption === option.key ? '' : option.key)} />
              {expandedOption === option.key && <View style={[layout.pad, layout.stack]}>
                <Field label="选项名称" value={option.name} onChangeText={(name) => updateOption(entry, option, { name })} maxLength={191} />
                <Field label="加价（元）" value={option.price_delta} onChangeText={(price_delta) => updateOption(entry, option, { price_delta })} keyboardType="decimal-pad" />
                <Field label="库存增量" value={option.stock_delta} onChangeText={(stock_delta) => updateOption(entry, option, { stock_delta })} keyboardType="numbers-and-punctuation" />
                <Options values={[[ 'VALUE', '文本选项'], ['VARIANT', '引用规格']]} value={option.option_type}
                  onChange={(value) => updateOption(entry, option, { option_type: value as DraftOption['option_type'], referenced_sku_id: undefined })} />
                {option.option_type === 'VARIANT' && <SkuChoice options={skuOptions.data ?? []} value={option.referenced_sku_id}
                  onChange={(referenced_sku_id) => updateOption(entry, option, { referenced_sku_id })} />}
                <Toggle label="启用选项" value={option.is_active} onChange={(is_active) => updateOption(entry, option, { is_active })} />
                <Toggle label="默认选择" value={option.is_default} onChange={(is_default) => updateOption(entry, option, { is_default })} />
                {group.options.length > 1 && <Button label="移除选项" variant="danger" onPress={() =>
                  updateGroup(entry, { options: group.options.filter((item) => item.key !== option.key) })} />}
              </View>}
            </Panel>)}
            <Button label="添加选项" variant="secondary" onPress={() => {
              const option = newOption(); updateGroup(entry, { options: [...group.options, option] }); setExpandedOption(option.key);
            }} />
            <Button label="移除选择组" variant="danger" onPress={() => setBindings(bindings.filter((binding) => binding.key !== entry.key))} />
          </View>}
        </Panel>;
      })}
    </Section>
  </Save>;
}

function SkuChoice({ options, value, onChange }: { options: ProductSkuOptionContract[]; value?: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const matches = options.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 15);
  return <View style={layout.stack}>
    <Field label="搜索引用规格" value={search} onChangeText={setSearch} maxLength={80} />
    {value && <Text style={layout.muted}>已选 {options.find((item) => item.value === value)?.label ?? '历史规格'}</Text>}
    <Options values={matches.map((item) => [item.value, item.label])} value={value ?? ''} onChange={onChange} />
  </View>;
}

const styles = StyleSheet.create({ photo: { height: 210, width: '100%', borderRadius: 17 } });
