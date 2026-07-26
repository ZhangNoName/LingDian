export function canCheckout(cart: { itemCount: number }): boolean {
  return cart.itemCount > 0
}
