export function canCheckout(cart: { itemCount: number }): boolean {
  return cart.itemCount > 0
}

export function canSubmitCheckout(input: {
  itemCount: number;
  serviceMode: "takeaway" | "delivery";
  addressId?: string;
}): boolean {
  if (input.itemCount < 1) return false;
  return input.serviceMode !== "delivery" || Boolean(input.addressId);
}
