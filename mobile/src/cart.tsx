import { randomUUID } from 'expo-crypto';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCartLine, applyPurchase, cartOwnerForWorkspace, cartSelectionKey, clearCartLines, emptyCart, guestCart, guestStoreIds, maxCartQuantity,
  replaceCartLine, restoreCartRecords, storeCart, storeCartKey, transferGuestCart,
  type CartLineInput, type CartSelection, type CartRecord, type CartRecords, type OrderMode, type PurchasedLine,
} from './cart-state';
import { cartStorage } from './cart-storage';
import { useWorkspace } from './context';

type CartContext = {
  owner: string;
  records?: CartRecords;
  ready: boolean;
  loadFailed: boolean;
  writeFailed: boolean;
  load: () => void;
  update: (storeId: string, change: (cart: CartRecord) => CartRecord, required?: boolean) => Promise<void>;
};

const CartContext = createContext<CartContext | null>(null);

export function CartProvider({ children, enabled }: PropsWithChildren<{ enabled: boolean }>) {
  const { user, workspace, show } = useWorkspace();
  const owner = cartOwnerForWorkspace(workspace, user?.userId);
  const [records, setRecords] = useState<CartRecords>();
  const [activeOwner, setActiveOwner] = useState<string>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const current = useRef<CartRecords>(null);
  const stored = useRef<CartRecords>(null);
  const loading = useRef(false);
  const writes = useRef(Promise.resolve());
  const load = useCallback(() => {
    if (loading.current || current.current) return;
    loading.current = true;
    setLoadFailed(false);
    void cartStorage.read().then((snapshot) => {
      const data = restoreCartRecords(snapshot);
      current.current = data;
      stored.current = snapshot;
      setRecords(data);
    }).catch(() => setLoadFailed(true)).finally(() => { loading.current = false; });
  }, []);
  useEffect(load, [load]);

  const persist = useCallback((data: CartRecords, required = false) => {
    const operation = writes.current.catch(() => undefined).then(async () => {
      // Coalesce rapid quantity changes. Checkout can request a durable checkpoint.
      if (stored.current === data || (!required && current.current !== data)) return;
      try {
        await cartStorage.write(data);
        stored.current = data;
        if (current.current === data) setWriteFailed(false);
      } catch {
        if (current.current === data) setWriteFailed(true);
        throw new Error('暂时无法保存购物袋，请重试。');
      }
    });
    writes.current = operation;
    void operation.catch(() => undefined);
    return operation;
  }, []);
  const commit = useCallback((data: CartRecords, required?: boolean) => {
    current.current = data;
    setRecords(data);
    return persist(data, required);
  }, [persist]);

  const loaded = !!records;
  useEffect(() => {
    const data = current.current;
    if (!enabled || !loaded || !data || activeOwner === owner) return;
    if (activeOwner === guestCart && owner !== guestCart && guestStoreIds(data).length) {
      const next = transferGuestCart(data, owner);
      if (next !== data) void commit(next);
      if (guestStoreIds(next).length) show('部分访客商品仍保留在本机的访客购物袋。');
    }
    setActiveOwner(owner);
  }, [enabled, loaded, activeOwner, owner, show, commit]);

  const ready = enabled && workspace === 'user' && activeOwner === owner && loaded;
  const update = useCallback<CartContext['update']>((storeId, change, required) => {
    const data = current.current;
    if (!ready || !data) throw new Error('请先恢复购物袋。');
    const previous = storeCart(data, owner, storeId);
    const next = change(previous);
    return next !== previous ? commit({ ...data, [storeCartKey(owner, storeId)]: next }, required) : persist(data, required);
  }, [owner, ready, commit, persist]);
  const value = useMemo(() => ({ owner, records, ready, loadFailed, writeFailed, load, update }),
    [owner, records, ready, loadFailed, writeFailed, load, update]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(storeId?: string) {
  const context = useContext(CartContext);
  if (!context) throw new Error('Shopping cart provider missing');
  const { ready, records, owner, loadFailed, writeFailed, load, update } = context;
  const cart = ready && records && storeId ? storeCart(records, owner, storeId) : emptyCart;
  const scoped = (change: (cart: CartRecord) => CartRecord, required?: boolean) => {
    if (!storeId) throw new Error('请先打开门店菜单。');
    return update(storeId, change, required);
  };
  return {
    lines: cart.lines, mode: cart.mode, ready: ready && !!storeId, loadFailed, writeFailed, load,
    flush: () => scoped((current) => current, true),
    clear: () => { void scoped(clearCartLines); },
    setMode: (mode: OrderMode) => { void scoped((current) => mode === current.mode ? current : { ...current, mode }); },
    change: (id: string, quantity: number) => {
      void scoped((current) => ({ ...current, lines: current.lines.flatMap((line) => line.id !== id ? [line]
        : quantity > 0 ? [{ ...line, quantity: Math.min(quantity, maxCartQuantity) }] : []) }));
    },
    add: (line: CartLineInput) => {
      if (line.storeId !== storeId) throw new Error('商品不属于当前门店。');
      void scoped((current) => addCartLine(current, { ...line, id: randomUUID(), selectionKey: cartSelectionKey(line) }));
    },
    replace: (id: string, selection: CartSelection) => {
      void scoped((current) => replaceCartLine(current, id, selection, randomUUID()));
    },
    removePurchased: async (orderStoreId: string, id: string, lines?: PurchasedLine[]) => {
      if (lines) await update(orderStoreId, (current) => applyPurchase(current, id, lines), true);
    },
  };
}
