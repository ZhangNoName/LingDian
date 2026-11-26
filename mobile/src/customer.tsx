import type { ProductRecordContract, PublicMenuStore } from '@lingdian/contracts';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { assetUrl, humanError } from './api';
import { useCart } from './cart';
import { CartCheckoutBar } from './cart-checkout-bar';
import { Quantity } from './cart-quantity';
import { groupsFor } from './cart-review';
import { type CartLine } from './cart-state';
import { useWorkspace } from './context';
import { money } from './format';
import { availableModes, useMenu } from './menu';
import { PagedList } from './operations';
import { productDescription } from './product-description';
import { ProductPhoto } from './product-photo';
import { Badge, Button, Chip, ChipRow, colors, Empty, ErrorLine, Field, Icon, layout, ListRow, Loading, Page, Section } from './ui';

function isOrderable(product: ProductRecordContract) {
  return product.status === 'ACTIVE' && product.skus.some((sku) => sku.is_active);
}

const MenuCard = memo(function MenuCard({ item, onOpen }: { item: ProductRecordContract; onOpen: (id: string) => void }) {
  const description = productDescription(item.description);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}，${money(item.price)}`}
    style={({ pressed }) => [styles.product, pressed && { opacity: 0.76 }]} onPress={() => onOpen(item.id)}>
    <ProductPhoto uri={assetUrl(item.image_url)} style={styles.thumbnail} />
    <View style={[layout.flex, layout.compact]}>
      <Text style={styles.productTitle} numberOfLines={2}>{item.name}</Text>
      {!!description && <Text style={layout.muted} numberOfLines={1}>{description}</Text>}
      <View style={layout.split}><Text style={layout.price}>{money(item.price)}</Text>
        {item.status === 'SOLD_OUT' ? <Badge label="售罄" tone="amber" /> : <View style={styles.add}><Icon name="add" size={20} color={colors.white} /></View>}
      </View>
    </View>
  </Pressable>;
});

export function Menu() {
  const { go, customerStoreId } = useWorkspace();
  const menu = useMenu({ storeId: customerStoreId });
  const storeId = menu.data?.store.id;
  const chooseStore = () => go({ type: 'customer-stores', currentStoreId: storeId ?? customerStoreId });
  const openProduct = useCallback((id: string) => {
    if (storeId) go({ type: 'product', id, storeId, menuStoreId: customerStoreId });
  }, [customerStoreId, go, storeId]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const list = useMemo(() => (menu.data?.categories ?? [])
    .filter(({ id }) => !category || id === category)
    .flatMap((current) => current.products)
    .filter((product) => !search.trim() || `${product.name} ${productDescription(product.description)}`.toLowerCase().includes(search.trim().toLowerCase())),
  [category, menu.data, search]);

  if (menu.isPending) return <Loading label="正在获取菜单…" />;
  if (!menu.data) return <Page>
    <Empty title="菜单暂时无法加载" detail={humanError(menu.error)} action="重试" onAction={() => void menu.refetch()} />
    {customerStoreId && <Button label="选择门店" variant="secondary" onPress={chooseStore} />}
  </Page>;
  const { store } = menu.data;
  const orderModes = availableModes(store);
  const open = store.status.toUpperCase() === 'OPEN';
  return <View style={layout.flex}>
    <FlatList data={list} keyExtractor={(item) => item.id}
      initialNumToRender={8} windowSize={7} contentContainerStyle={layout.list}
      refreshing={menu.isRefetching} onRefresh={() => void menu.refetch()}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={layout.stack}>
        <View style={styles.hero}>
          <View style={styles.heroCircle} />
          <View style={styles.heroRing} />
          <View style={layout.split}>
            <View style={styles.heroIcon}><Icon name="storefront-outline" color={colors.lilac} size={24} /></View>
            <View style={layout.horizontal}>
              <Badge label={open ? '营业中' : '休息中'} tone={open ? 'green' : 'amber'} />
              {menu.data.storeSelectionEnabled && <Button label="选择门店" variant="secondary" onPress={chooseStore} />}
            </View>
          </View>
          <Text style={styles.heroTitle} accessibilityRole="header">{store.name}</Text>
          {!!store.businessHours && <Text style={styles.heroSubtitle}>营业时间 {store.businessHours}</Text>}
          <View style={layout.horizontal}>
            <Icon name="location-outline" size={16} color={colors.lilac} />
            <Text style={styles.heroSubtitle}>{orderModes.map((item) => item.label).join(' · ') || '当前暂停接单'}</Text>
          </View>
        </View>
        <Field label="搜索菜单" placeholder="输入商品名称" value={search} onChangeText={setSearch} maxLength={80} />
        <ChipRow>
          <Chip label="全部" selected={!category} onPress={() => setCategory('')} />
          {menu.data.categories.map((item) => <Chip key={item.id} label={item.name} selected={item.id === category} onPress={() => setCategory(item.id)} />)}
        </ChipRow>
        {(!!category || !!search.trim()) && list.length > 0 && <Text style={layout.muted}>{list.length} 件商品</Text>}
        <ErrorLine message={menu.isRefetchError ? '刷新失败，当前显示上次加载的菜单。' : undefined} />
      </View>}
      renderItem={({ item }) => <MenuCard item={item} onOpen={openProduct} />}
      ListEmptyComponent={<Empty title="没有找到商品" icon="search-outline" />}
    />
    <CartCheckoutBar key={store.id} storeId={store.id} menuStoreId={customerStoreId} />
  </View>;
}

export function CustomerStores({ currentStoreId }: { currentStoreId?: string }) {
  const { customerStoreId, selectCustomerStore, back } = useWorkspace();
  return <PagedList<PublicMenuStore> path="/stores" searchable publicRead recordKey={(store) => store.id}
    controls={customerStoreId && <Button label="返回默认门店" variant="plain" onPress={() => selectCustomerStore()} />}
    render={(store) => {
      const current = store.id === currentStoreId;
      const open = store.status.toUpperCase() === 'OPEN';
      const status = open ? '营业中' : '休息中';
      const detail = [current ? '当前门店' : undefined, store.businessHours].filter(Boolean).join(' · ');
      return <ListRow title={store.name} detail={detail} icon="storefront-outline"
        accessibilityLabel={[store.name, detail, status].filter(Boolean).join('，')}
        trailing={<Badge label={status} tone={open ? 'green' : 'amber'} />}
        onPress={() => current ? back() : selectCustomerStore(store.id)} />;
    }} />;
}

export function Product({ id, storeId, menuStoreId, editLineId }: { id: string; storeId: string; menuStoreId?: string; editLineId?: string }) {
  const { back } = useWorkspace();
  const menu = useMenu({ storeId: menuStoreId });
  const cart = useCart(storeId);
  const product = menu.data?.store.id === storeId ? menu.data.categories.flatMap((category) => category.products).find((item) => item.id === id) : undefined;
  if (menu.isPending) return <Loading />;
  if (!product) return <Empty title="商品已下架或不可用" />;
  if (editLineId && !cart.ready) return cart.loadFailed
    ? <Empty title="暂时无法恢复购物袋" action="重试" onAction={cart.load} />
    : <Loading label="正在恢复购物袋…" />;
  const editing = editLineId ? cart.lines.find((line) => line.id === editLineId && line.storeId === storeId
    && (line.productId ? line.productId === id : product.skus.some((sku) => sku.id === line.skuId))) : undefined;
  if (editLineId && !editing) return <Empty title="购物袋中的商品已变化" action="返回结算" onAction={back} />;
  return <ProductForm product={product} editing={editing} open={menu.data?.store.status.toUpperCase() === 'OPEN'} />;
}

function ProductForm({ product, open, editing }: { product: ProductRecordContract; open: boolean; editing?: CartLine }) {
  const cart = useCart(product.store_id);
  const { back, show } = useWorkspace();
  const variants = product.skus.filter((sku) => sku.is_active);
  const [skuId, setSkuId] = useState(() => variants.find((sku) => sku.id === editing?.skuId)?.id
    ?? variants.find((sku) => sku.is_default)?.id ?? variants[0]?.id ?? '');
  const [newQuantity, setQuantity] = useState(1);
  const quantity = editing?.quantity ?? newQuantity;
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const choices: Record<string, string[]> = {};
    for (const selection of editing?.selections ?? []) (choices[selection.selectionGroupId] ??= []).push(selection.selectionOptionId);
    return choices;
  });
  const [error, setError] = useState<string>();
  const sku = variants.find((variant) => variant.id === skuId) ?? (editing ? undefined : variants[0]);
  const groups = groupsFor(product, sku?.id ?? '');
  const labels: string[] = [];
  const selections: CartLine['selections'] = [];
  let cents = Math.round((sku?.price ?? product.price) * 100);
  let validation: string | undefined;
  const groupChoices = groups.map((group) => {
    const choices = group.options.filter((option) => option.is_active);
    const max = group.selection_mode === 'SINGLE' ? Math.min(1, group.max_select) : group.max_select;
    const min = Math.max(group.min_select, group.is_required ? 1 : 0);
    const defaults = editing ? [] : choices.filter((option) => option.is_default).slice(0, max);
    const active = (selected[group.id] ?? defaults.map((option) => option.id)).filter((optionId) => choices.some((option) => option.id === optionId));
    if (active.length < min) validation ??= `${group.name}至少选择 ${min} 项。`;
    if (active.length > max) validation ??= `${group.name}最多选择 ${max} 项。`;
    for (const option of choices.filter((choice) => active.includes(choice.id))) {
      cents += Math.round(option.price_delta * 100);
      labels.push(option.name);
      selections.push({ selectionGroupId: group.id, selectionOptionId: option.id });
    }
    return { group, choices, active, min, max };
  });
  const description = productDescription(product.description);
  const hasUnavailableChoices = groupChoices.some(({ choices, min }) => choices.length < min);
  const canOrder = open && !!sku && isOrderable(product) && !hasUnavailableChoices;
  return <Page footer={canOrder && <View style={layout.split}>
    {editing ? <Text style={layout.strong}>{quantity} 件</Text> : <Quantity quantity={quantity} min={1} onChange={setQuantity} />}
    <Button label={`${money(cents * quantity / 100)} ${editing ? '保存规格' : '加入购物袋'}`} disabled={!cart.ready} onPress={() => {
      if (validation) return setError(validation);
      if (!sku || !Number.isSafeInteger(cents) || cents < 0 || cents > 9_999_999_999) return setError('当前规格暂时无法购买。');
      try {
        const selection = {
          storeId: product.store_id, productId: product.id, skuId: sku.id, variantName: sku.sku_name,
          productName: product.name, image: assetUrl(product.image_url), cents, selections, options: labels,
        };
        if (editing) cart.replace(editing.id, selection);
        else cart.add({ ...selection, quantity });
        show(editing ? '已更新规格' : '已加入购物袋');
        back();
      } catch (error) { setError(humanError(error)); }
    }} />
  </View>}>
    {!editing && <ProductPhoto uri={assetUrl(product.image_url)} style={styles.productHero} />}
    <View style={layout.split}><Text style={[layout.heading, layout.flex]}>{product.name}</Text><Text style={layout.price}>{money(cents / 100)}</Text></View>
    {!!description && <Text style={layout.body}>{description}</Text>}
    {!canOrder && <Badge label={!open ? '门店休息中' : hasUnavailableChoices ? '必选项暂不可用' : '暂不可购买'} tone="amber" />}
    {(variants.length > 1 || (editing && variants.length > 0)) && <Section title="选择规格"><View style={styles.wrap}>{variants.map((variant) => <Chip
      key={variant.id} label={`${variant.sku_name} ${money(variant.price)}`} selected={variant.id === sku?.id}
      onPress={() => { setSkuId(variant.id); if (!editing) setSelected({}); setError(undefined); }} />)}</View></Section>}
    {groupChoices.map(({ group, choices, active, min, max }) => <Section key={group.id} title={group.name}
      accessory={<Text style={layout.muted}>{min > 0 ? `至少选 ${min} 项 · ` : ''}最多选 {max} 项</Text>}>
      <View style={styles.wrap}>{choices.map((item) => <Chip key={item.id}
        label={item.price_delta ? `${item.name} ${item.price_delta > 0 ? '+' : '−'}${money(Math.abs(item.price_delta))}` : item.name}
        selected={active.includes(item.id)} onPress={() => {
          setError(undefined);
          if (active.includes(item.id)) {
            setSelected({ ...selected, [group.id]: active.filter((optionId) => optionId !== item.id) });
          } else if (max === 1) {
            setSelected({ ...selected, [group.id]: [item.id] });
          } else if (active.length < max) {
            setSelected({ ...selected, [group.id]: [...active, item.id] });
          } else setError(`${group.name}最多选择 ${max} 项。`);
        }} />)}</View>
    </Section>)}
    <ErrorLine message={error ?? (cart.loadFailed ? '暂时无法恢复购物袋。' : undefined)} />
    {cart.loadFailed && <Button label="重新加载购物袋" variant="secondary" onPress={cart.load} />}
  </Page>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.dark, borderRadius: 23, padding: 19, gap: 9, overflow: 'hidden', minHeight: 174 },
  heroCircle: { position: 'absolute', right: -54, top: -72, width: 235, height: 235, borderRadius: 120, backgroundColor: '#3E275E' },
  heroRing: { position: 'absolute', right: -61, top: -83, width: 251, height: 251, borderRadius: 130, borderWidth: 1, borderColor: '#644B86' },
  heroIcon: { padding: 9, backgroundColor: '#553978', borderRadius: 13 },
  heroTitle: { fontSize: 31, fontWeight: '800', color: colors.white, letterSpacing: -0.65 },
  heroSubtitle: { fontSize: 13, color: '#F0E4FF' },
  product: { padding: 10, gap: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 15, borderWidth: 1, borderColor: colors.line },
  productTitle: { fontSize: 16, color: colors.ink, fontWeight: '700' },
  thumbnail: { width: 86, height: 86, borderRadius: 10 },
  add: { backgroundColor: colors.primary, width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  productHero: { width: '100%', height: 233, borderRadius: 18 },
  wrap: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
});
