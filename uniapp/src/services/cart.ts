import type { CartItem, CartSummary } from "@/types/cart";
import type { ProductDetail, SelectedOption } from "@/types/menu";

const cartItems: CartItem[] = [];

function makeCartId(product: ProductDetail, selectedOptions: SelectedOption[]): string {
  const optionKey = JSON.stringify(
    selectedOptions
      .map((option) => [option.groupId, option.optionId])
      .sort(([leftGroup, leftOption], [rightGroup, rightOption]) =>
        leftGroup.localeCompare(rightGroup) || leftOption.localeCompare(rightOption),
      ),
  );
  return `${product.id}:${product.skuId}:${optionKey || "default"}`;
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

  const id = makeCartId(product, selectedOptions);
  const existing = cartItems.find((item) => item.id === id);

  if (existing) {
    existing.quantity += quantity;
    return getCartSummary();
  }

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
    productName: product.name,
    imageUrl: product.imageUrl,
    quantity,
    unitPrice,
    selectedOptions: selectedOptions.map((option) => ({ ...option })),
  });

  return getCartSummary();
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
