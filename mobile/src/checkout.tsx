import type { UserAddress } from '@lingdian/contracts';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { addressesPath, formatAddress, reviewAddressSelection, selectAddress, type AddressSelection } from './address-selection';
import { humanError } from './api';
import { useCart } from './cart';
import { reviewCart, type AvailableLine } from './cart-review';
import { conflictReason, useCheckoutAttempt, useCheckoutSubmission } from './checkout-submission';
import { useData, useWorkspace } from './context';
import { localTime, money } from './format';
import { availableModes, useMenu } from './menu';
import { Button, Chip, ChipRow, Empty, ErrorLine, Field, layout, ListRow, Loading, Page, Panel, Section } from './ui';

export function Checkout({ storeId, menuStoreId, recovery, onOrdered }: {
  storeId?: string; menuStoreId?: string; recovery?: true; onOrdered: (id: string) => void;
}) {
  const { user, go, signIn } = useWorkspace();
  const pending = useCheckoutAttempt();
  const cart = useCart(storeId ?? pending.data?.body.storeId);
  const reviewing = Boolean(!recovery && user && cart.ready && cart.lines.length && pending.data === null);
  const menu = useMenu({ storeId: menuStoreId, checkout: true, enabled: reviewing });
  const review = useMemo(() => reviewing && menu.data ? reviewCart(cart.lines, menu.data) : [], [reviewing, menu.data, cart.lines]);
  const [remark, setRemark] = useState('');
  const [contact, setContact] = useState('');
  const [addressSelection, setAddressSelection] = useState<AddressSelection | null>();
  const store = menu.data?.store;
  const supported = store ? availableModes(store) : [];
  const mode = supported.find((item) => item.id === cart.mode)?.id ?? supported[0]?.id;
  const delivery = mode === 'takeout';
  const addresses = useData<UserAddress[]>(addressesPath, delivery && !pending.data);
  const { currentAddress, issue: addressIssue } = reviewAddressSelection(addressSelection, addresses.data);
  useEffect(() => {
    if (!delivery || pending.data || !addresses.isSuccess || addresses.fetchStatus !== 'idle' || addressSelection !== undefined) return;
    const initialAddress = addresses.data.find((item) => item.isDefault) ?? addresses.data[0];
    if (initialAddress) {
      setAddressSelection((current) => current === undefined ? selectAddress(initialAddress) : current);
    }
  }, [addressSelection, addresses.data, addresses.fetchStatus, addresses.isSuccess, delivery, pending.data]);

  const submit = useCheckoutSubmission({ cart, onAddressConflict: () => setAddressSelection(null), onOrdered });

  if (!user) return <Empty title="请登录后继续下单" action="登录" onAction={signIn} />;
  if (pending.isPending) return <Loading label="正在检查待确认订单…" />;
  if (pending.isError) return <Empty title="暂时无法读取待确认订单" action="重试" onAction={() => void pending.refetch()} />;
  if (recovery && !pending.data) return <Empty title="暂无待确认订单" detail={submit.error ? humanError(submit.error) : undefined} />;
  if (!cart.ready) return cart.loadFailed
    ? <Empty title="暂时无法恢复购物袋" action="重试" onAction={cart.load} />
    : <Loading label="正在恢复购物袋…" />;
  if (pending.data) {
    const { createdAt, body, storeName } = pending.data;
    return <Page footer={<Button label="确认提交结果" busy={submit.isPending} onPress={() => submit.mutate(undefined)} />}>
      <Section title="订单提交结果待确认">
        <Panel><ListRow title={`${body.items.reduce((sum, item) => sum + item.quantity, 0)} 件商品`}
          detail={[storeName, localTime(createdAt)].filter(Boolean).join(' · ')} icon="receipt-outline" /></Panel>
      </Section>
      <ErrorLine message={submit.error ? humanError(submit.error) : undefined} />
    </Page>;
  }
  const reason = conflictReason(submit.error);
  const error = submit.error && reason !== 'APP_CHECKOUT_ADDRESS_CHANGED' ? humanError(submit.error) : undefined;
  if (!cart.lines.length) return <Empty title="购物袋里还没有商品" detail={error} />;
  if (menu.isError) return <Empty title="暂时无法核对商品与价格" detail={humanError(menu.error)} action="重试" onAction={() => void menu.refetch()} />;
  if (menu.isPending) return <Loading label="正在核对商品与价格…" />;
  if (!store || store.id !== storeId || !mode || store.status.toUpperCase() !== 'OPEN') return <Empty title="当前门店暂时无法接单" detail={error} />;
  const available = review.filter((item): item is AvailableLine => 'cents' in item);
  const unavailable = available.length !== review.length;
  const priceConflict = reason === 'APP_CHECKOUT_PRICE_CHANGED';
  const changed = priceConflict || available.some(({ line, cents }) => cents !== line.cents);
  const subtotal = available.reduce((sum, { line, cents }) => sum + cents * line.quantity, 0);
  const payable = menu.data?.paymentRequired === false ? 0 : subtotal;
  const amountTooLarge = !Number.isSafeInteger(subtotal) || subtotal > 9_999_999_999;
  const checkingMenu = menu.fetchStatus !== 'idle';
  const checkingAddress = addresses.fetchStatus !== 'idle' || addresses.isError;
  return <Page footer={<View style={layout.split}>
    <Text style={[layout.price, layout.flex]}>{unavailable ? '部分商品不可结算' : `应付 ${money(payable / 100)}`}</Text>
    <Button label={changed ? '确认新价格并提交' : '提交订单'} busy={submit.isPending}
      disabled={checkingMenu || unavailable || amountTooLarge || (delivery && (!currentAddress || checkingAddress))} onPress={() => submit.mutate({
        storeName: store.name,
        cartLines: available.map(({ line }) => ({ id: line.id, quantity: line.quantity })),
        body: {
          storeId: store.id, orderType: mode, ...(delivery && currentAddress
            ? { addressId: currentAddress.id, expectedAddressUpdatedAt: currentAddress.updatedAt } : {}),
          ...(remark.trim() ? { remark: remark.trim() } : {}), ...(contact.trim() && !delivery ? { customerName: contact.trim() } : {}),
          paymentChannel: 'cash', expectedPayableCents: payable,
          items: available.map(({ line, cents }) => ({
            sku_id: line.skuId, quantity: line.quantity, selections: line.selections, expectedUnitCents: cents,
          })),
        },
      })} />
  </View>}>
    <Section title={store.name}>
      <ChipRow>{supported.map((item) => <Chip key={item.id} label={item.label} selected={item.id === mode} onPress={() => cart.setMode(item.id)} />)}</ChipRow>
    </Section>
    {delivery ? <Section title="配送地址" accessory={<Button label="管理地址" variant="plain" onPress={() => go({ type: 'addresses' })} />}>
      <ErrorLine message={addressIssue === 'removed' ? '原收货地址已删除，请重新选择。'
        : addressIssue === 'updated' || reason === 'APP_CHECKOUT_ADDRESS_CHANGED' ? '收货地址已更新，请核对并重新选择。' : undefined} />
      {addresses.isPending ? <Loading label="正在加载地址…" /> : <>
        <ErrorLine message={addresses.error ? humanError(addresses.error) : undefined} />
        {addresses.isError && <Button label="刷新地址" variant="secondary" onPress={() => void addresses.refetch()} />}
        {addresses.data?.map((item) => <Panel key={item.id}><ListRow title={`${item.recipientName} · ${item.phoneNumber}`}
          detail={formatAddress(item)} icon={currentAddress?.id === item.id ? 'radio-button-on-outline' : 'radio-button-off-outline'}
          accessibilityLabel={`${item.recipientName}，${item.phoneNumber}，${formatAddress(item)}，${currentAddress?.id === item.id ? '已选' : '未选'}`}
          onPress={checkingAddress ? undefined : () => {
            setAddressSelection(selectAddress(item));
            if (reason === 'APP_CHECKOUT_ADDRESS_CHANGED') submit.reset();
          }} /></Panel>)}
        {!addresses.data?.length && !addresses.isError && <Empty title="请先添加收货地址" icon="location-outline" />}
      </>}
    </Section> : <Field label="称呼（选填）" value={contact} onChangeText={setContact} maxLength={64} />}
    <Section title="订单明细">
      {checkingMenu && <Text style={layout.muted}>{menu.isPaused ? '联网后核对商品与价格。' : '正在核对商品与价格…'}</Text>}
      {review.map((item) => <Panel key={item.line.id}>
        {'issue' in item ? <>
          <ListRow title={`${item.line.productName} × ${item.line.quantity}`} detail={item.issue} />
          <View style={styles.wrap}>
            {item.editableProductId && <Button label="重新选择规格" variant="secondary" disabled={checkingMenu || submit.isPending} onPress={() => {
              submit.reset();
              go({ type: 'product', id: item.editableProductId!, storeId: item.line.storeId, menuStoreId, editLineId: item.line.id });
            }} />}
            <Button label="移除这件商品" variant="plain" disabled={submit.isPending} onPress={() => {
              submit.reset();
              cart.change(item.line.id, 0);
            }} />
          </View>
        </> : <ListRow title={`${item.productName} × ${item.line.quantity}`}
          detail={[item.variantName, ...item.options, item.cents !== item.line.cents && `原价 ${money(item.line.cents / 100)} / 件`].filter(Boolean).join(' · ')}
          value={money(item.cents * item.line.quantity / 100)} />}
      </Panel>)}
    </Section>
    <Field label="订单备注（选填）" value={remark} onChangeText={setRemark} maxLength={191} multiline />
    <ListRow title={menu.data?.paymentRequired === false ? '门店暂免收款' : '线下支付'} icon="wallet-outline" />
    <ErrorLine message={amountTooLarge ? '订单金额超过限额，请减少商品数量。' : error} />
  </Page>;
}

export function CheckoutRecovery({ visible }: { visible: boolean }) {
  const { go } = useWorkspace();
  const pending = useCheckoutAttempt();
  if (!visible || (!pending.data && !pending.isError)) return null;
  return <View style={styles.checkoutRecovery}><Panel>
    <ListRow title={pending.isError ? '检查待确认订单' : '继续确认订单'}
      detail={pending.isError ? '暂时无法读取本机订单记录' : pending.data?.storeName}
      icon="receipt-outline" onPress={() => go({ type: 'checkout', storeId: pending.data?.body.storeId, recovery: true })} />
  </Panel></View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  checkoutRecovery: { width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 8 },
});
