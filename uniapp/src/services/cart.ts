import type { CartItem, CartSummary } from "@/types/cart";
import type { ProductDetail, SelectedOption } from "@/types/menu";

const cartItems: CartItem[] = [];

function makeCartId(product: ProductDetail, selectedOptions: SelectedOption[]) {
  const optionKey = selectedOptions.map((option) => option.optionId).join("-");
  return `${product.id}:${product.skuId}:${optionKey || "default"}`;
}

export function addCartItem(product: ProductDetail, quantity: number, selectedOptions: SelectedOption[]) {
  const id = makeCartId(product, selectedOptions);
  const existing = cartItems.find((item) => item.id === id);

  if (existing) {
    existing.quantity += quantity;
    return getCartSummary();
  }

  cartItems.push({
    id,
    productId: product.id,
    skuId: product.skuId,
    productName: product.name,
    imageUrl: product.imageUrl,
    quantity,
    unitPrice: product.price + selectedOptions.reduce((sum, option) => sum + (option.priceDelta ?? 0), 0),
    selectedOptions,
  });

  return getCartSummary();
}

export function clearCart() {
  cartItems.splice(0, cartItems.length);
}

export function getCartSummary(): CartSummary {
  const totalAmount = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return {
    itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount,
    discountAmount: 0,
    items: cartItems,
  };
}

