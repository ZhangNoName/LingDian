import type { CartItem, CartSummary } from "@/types/cart";
import type { ProductDetail, SelectedOption } from "@/types/menu";

export const MAX_LINE_QUANTITY = 99;
const MAX_CART_LINES = 100;
const cartItems: CartItem[] = [];

export function cartLineId(productId: string, skuId: string | null, selectedOptions: readonly { groupId: string | null; optionId: string | null }[]): string {
  const optionKey = JSON.stringify(
    selectedOptions
      .map((option) => [option.groupId, option.optionId])
      .sort(([leftGroup, leftOption], [rightGroup, rightOption]) =>
        (leftGroup ?? "").localeCompare(rightGroup ?? "") || (leftOption ?? "").localeCompare(rightOption ?? ""),
      ),
  );
  return `${productId}:${skuId}:${optionKey}`;
}

function cloneItem(item: CartItem): CartItem {
  return {
    ...item,
    selectedOptions: item.selectedOptions.map((option) => ({ ...option })),
  };
}

export function addCartItem(
  product: ProductDetail,
  quantity: number,
  selectedOptions: SelectedOption[],
): CartSummary {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("商品数量必须是大于 0 的整数");
  }
  if (!product.skuId) {
    throw new Error("商品规格不可用");
  }

  const id = cartLineId(product.id, product.skuId, selectedOptions);
  const existing = cartItems.find((item) => item.id === id);

  if ((existing?.quantity ?? 0) + quantity > MAX_LINE_QUANTITY) {
    throw new Error(`每种规格最多购买 ${MAX_LINE_QUANTITY} 份`);
  }
  if (existing) {
    existing.quantity += quantity;
    return getCartSummary();
  }

  if (cartItems.length >= MAX_CART_LINES) throw new Error(`每单最多选择 ${MAX_CART_LINES} 种规格`);

  const unitPrice = Math.round(
    (product.price + selectedOptions.reduce((sum, option) => sum + (option.priceDelta ?? 0), 0)) * 100,
  ) / 100;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("商品价格无效");
  }

  cartItems.push({
    id,
    productId: product.id,
    skuId: product.skuId,
    ...(product.skuName ? { skuName: product.skuName } : {}),
    productName: product.name,
    imageUrl: product.imageUrl,
    quantity,
    unitPrice,
    selectedOptions: selectedOptions.map((option) => ({ ...option })),
  });

  return getCartSummary();
}

export function setCartQuantity(id: string, quantity: number): CartSummary {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_LINE_QUANTITY) {
    throw new Error("商品数量无效");
  }
  const index = cartItems.findIndex((item) => item.id === id);
  if (index >= 0) {
    if (quantity === 0) cartItems.splice(index, 1);
    else cartItems[index].quantity = quantity;
  }
  return getCartSummary();
}

export function removeOrderedItems(items: readonly Pick<CartItem, "id" | "quantity">[]): void {
  for (const item of items) {
    const index = cartItems.findIndex((current) => current.id === item.id);
    if (index < 0) continue;
    cartItems[index].quantity -= item.quantity;
    if (cartItems[index].quantity <= 0) cartItems.splice(index, 1);
  }
}

export function clearCart(): void {
  cartItems.splice(0, cartItems.length);
}

export function getCartSummary(): CartSummary {
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity,
    0,
  ) / 100;
  return {
    itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount,
    discountAmount: 0,
    items: cartItems.map(cloneItem),
  };
}
