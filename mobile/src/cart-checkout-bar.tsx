import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCart } from './cart';
import { Quantity } from './cart-quantity';
import { useScreenActive, useWorkspace } from './context';
import { money } from './format';
import { ProductPhoto } from './product-photo';
import type { CartCheckoutRoute } from './routes';
import { Button, colors, ErrorLine, Icon, layout, Panel, Sheet } from './ui';

export function CartCheckoutBar({ storeId, menuStoreId }: { storeId: string; menuStoreId?: string }) {
  const cart = useCart(storeId);
  const { user, go } = useWorkspace();
  const active = useScreenActive();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const count = cart.lines.reduce((sum, item) => sum + item.quantity, 0);
  const total = money(cart.lines.reduce((sum, item) => sum + item.cents * item.quantity, 0) / 100);

  useEffect(() => {
    if (!count || !active) setDrawerOpen(false);
  }, [active, count]);

  function checkout() {
    if (!cart.ready || !count) return;
    setDrawerOpen(false);
    const route: CartCheckoutRoute = { type: 'checkout', storeId, menuStoreId };
    go(user ? route : { type: 'login', checkout: route });
  }

  const retrySave = cart.writeFailed && <View style={layout.compact}>
    <ErrorLine message="购物袋暂未保存到本机。" />
    <Button label="重试保存购物袋" variant="secondary" onPress={() => { void cart.flush().catch(() => undefined); }} />
  </View>;
  if (!count) return retrySave ? <View style={styles.bar}>{retrySave}</View> : null;

  return <>
    <View style={styles.bar}>
      <Pressable style={({ pressed }) => [styles.summary, pressed && styles.pressed]} accessibilityRole="button"
        accessibilityLabel={`查看购物袋，已选 ${count} 件，预估 ${total}`}
        accessibilityState={{ expanded: active && drawerOpen }} onPress={() => setDrawerOpen(true)}>
        <View style={styles.bag}>
          <Icon name="bag-handle-outline" size={23} color={colors.primary} />
          <View style={styles.count}><Text style={styles.countText}>{count}</Text></View>
        </View>
        <Text style={[layout.price, styles.amount]} numberOfLines={1}>{total}</Text>
        <Icon name="chevron-up" size={15} color={colors.muted} />
      </Pressable>
      <Button label="结算" style={styles.checkout} onPress={checkout} />
    </View>
    <Sheet visible={active && drawerOpen} title="购物袋" onClose={() => setDrawerOpen(false)}
      accessory={<Button label="清空购物袋" variant="plain" onPress={cart.clear} />}
      footer={<View style={layout.split}>
        <View style={[layout.horizontal, styles.total]}>
          <Text style={layout.muted}>合计</Text><Text style={layout.price}>{total}</Text>
        </View>
        <Button label="结算" style={styles.checkout} onPress={checkout} />
      </View>}>
      {retrySave}
      {cart.lines.map((item) => {
        const detail = [item.variantName, ...item.options].filter(Boolean).join(' · ');
        return <Panel key={item.id} style={styles.item}>
          <View style={layout.horizontal}>
            <ProductPhoto uri={item.image} style={styles.photo} />
            <View style={[layout.flex, layout.compact]}>
              <Text style={layout.strong}>{item.productName}</Text>
              {!!detail && <Text style={layout.muted}>{detail}</Text>}
            </View>
          </View>
          <View style={layout.split}>
            <Text style={layout.price}>{money(item.cents * item.quantity / 100)}</Text>
            <Quantity quantity={item.quantity} name={item.productName} onChange={(quantity) => cart.change(item.id, quantity)} />
          </View>
        </Panel>;
      })}
    </Sheet>
  </>;
}

const styles = StyleSheet.create({
  bar: {
    width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 8,
    backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth,
    ...layout.split,
  },
  summary: {
    flex: 1, minWidth: 0, minHeight: 46, borderRadius: 13, paddingHorizontal: 4,
    flexDirection: 'row', gap: 9, alignItems: 'center', alignSelf: 'stretch',
  },
  pressed: { backgroundColor: colors.lavender },
  bag: {
    width: 38, height: 38, marginRight: 6, borderRadius: 11, backgroundColor: colors.lavender,
    alignItems: 'center', justifyContent: 'center',
  },
  count: {
    position: 'absolute', top: -5, right: -8, minWidth: 18, paddingHorizontal: 5, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  countText: { color: colors.white, fontSize: 11, lineHeight: 17, fontWeight: '800' },
  amount: { flexShrink: 1 },
  checkout: { minWidth: 100 },
  total: { flex: 1, minWidth: 0, flexWrap: 'wrap' },
  item: { gap: 8, padding: 10 },
  photo: { width: 46, height: 46, borderRadius: 9 },
});
