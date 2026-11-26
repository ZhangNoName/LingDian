import type { Workspace } from './auth-manager';

export type OrderMode = 'pickup' | 'dine_in' | 'takeout';
export type CartChoice = { selectionGroupId: string; selectionOptionId: string };
export type CartLine = {
  id: string; selectionKey: string; storeId: string; productName: string; image: string | undefined; variantName: string;
  productId?: string;
  skuId: string; quantity: number; cents: number;
  selections: CartChoice[]; options: string[];
};
export type CartLineInput = Omit<CartLine, 'id' | 'selectionKey'>;
export type CartSelection = Omit<CartLineInput, 'quantity'>;
export type CartRecord = { lines: CartLine[]; mode?: OrderMode; lastAppliedOrder?: string };
export type CartRecords = Record<string, CartRecord>;
export type PurchasedLine = Pick<CartLine, 'id' | 'quantity'>;

export const guestCart = 'guest';
export const emptyCart: CartRecord = { lines: [] };
export const maxCartQuantity = 99;
const maxCartLines = 100;

export function cartOwnerForWorkspace(workspace: Workspace, userId?: string) {
  return workspace === 'user' && userId ? `account:${userId}` : guestCart;
}

export function storeCartKey(owner: string, storeId: string) {
  return JSON.stringify([owner, storeId]);
}

export function storeCart(records: CartRecords, owner: string, storeId: string): CartRecord {
  return records[storeCartKey(owner, storeId)] ?? (records[owner]?.mode ? { ...emptyCart, mode: records[owner].mode } : emptyCart);
}

export function restoreCartRecords(records: CartRecords): CartRecords {
  let restored = records;
  for (const [owner, cart] of Object.entries(records)) {
    if ((owner !== guestCart && !owner.startsWith('account:')) || !cart.lines.length) continue;
    if (restored === records) restored = { ...records };
    for (const storeId of new Set(cart.lines.map((line) => line.storeId))) {
      restored[storeCartKey(owner, storeId)] ??= { ...cart, lines: cart.lines.filter((line) => line.storeId === storeId) };
    }
    delete restored[owner];
  }
  return restored;
}

export function guestStoreIds(records: CartRecords) {
  return Object.entries(records).flatMap(([key, cart]) => {
    const storeId = cart.lines[0]?.storeId;
    return storeId && key === storeCartKey(guestCart, storeId) ? [storeId] : [];
  });
}

export function cartSelectionKey({ skuId, selections }: CartSelection) {
  return JSON.stringify([skuId, selections.map(({ selectionGroupId, selectionOptionId }) => `${selectionGroupId}:${selectionOptionId}`).sort()]);
}

export function addCartLine(cart: CartRecord, incoming: CartLine): CartRecord {
  if (cart.lines.some((line) => line.storeId !== incoming.storeId)) throw new Error('购物袋中已有其他门店的商品，请先清空。');
  const existing = cart.lines.find((line) => line.selectionKey === incoming.selectionKey);
  if ((existing?.quantity ?? 0) + incoming.quantity > maxCartQuantity) throw new Error('每种规格最多购买 99 份。');
  if (!existing && cart.lines.length >= maxCartLines) throw new Error('每单最多选择 100 种规格。');
  const lines = existing
    ? cart.lines.map((item) => item.id === existing.id
      ? { ...incoming, productId: incoming.productId ?? item.productId, id: item.id, quantity: item.quantity + incoming.quantity }
      : item)
    : [...cart.lines, incoming];
  return { ...cart, lines };
}

export function replaceCartLine(cart: CartRecord, id: string, selection: CartSelection, replacementId: string): CartRecord {
  const current = cart.lines.find((line) => line.id === id);
  if (!current || current.storeId !== selection.storeId || (current.productId && current.productId !== selection.productId)) {
    throw new Error('购物袋中的商品已变化，请返回后重试。');
  }
  const selectionKey = cartSelectionKey(selection);
  const sameSelection = current.selectionKey === selectionKey;
  const replacement = { ...selection, id: sameSelection ? current.id : replacementId, selectionKey, quantity: current.quantity };
  if (!sameSelection && cart.lines.some((line) => line.selectionKey === selectionKey)) {
    return addCartLine({ ...cart, lines: cart.lines.filter((line) => line.id !== id) }, replacement);
  }
  return { ...cart, lines: cart.lines.map((line) => line.id === id ? replacement : line) };
}

export function transferGuestCart(records: CartRecords, owner: string): CartRecords {
  let next = records;
  for (const storeId of guestStoreIds(records)) {
    const guestKey = storeCartKey(guestCart, storeId);
    const guest = records[guestKey];
    const account = storeCart(records, owner, storeId);
    let merged = account;
    try {
      for (const line of guest.lines) merged = addCartLine(merged, line);
    } catch {
      // A failed merge leaves both carts for this store intact.
      continue;
    }
    if (next === records) next = { ...records };
    delete next[guestKey];
    next[storeCartKey(owner, storeId)] = { ...merged, mode: guest.mode ?? account.mode };
  }
  return next;
}

export function clearCartLines(cart: CartRecord): CartRecord {
  return cart.lines.length ? { ...cart, lines: [] } : cart;
}

export function applyPurchase(cart: CartRecord, requestId: string, purchased: PurchasedLine[]): CartRecord {
  if (cart.lastAppliedOrder === requestId) return cart;
  const quantities = new Map(purchased.map((item) => [item.id, item.quantity]));
  const lines = cart.lines.flatMap((line) => {
    const quantity = line.quantity - (quantities.get(line.id) ?? 0);
    return quantity > 0 ? [quantity === line.quantity ? line : { ...line, quantity }] : [];
  });
  return { ...cart, lines, lastAppliedOrder: requestId };
}
