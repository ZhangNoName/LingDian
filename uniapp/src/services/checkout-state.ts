import type { ServiceMode, StoreSummary } from "@/types/store";

export function canCheckout(cart: { itemCount: number }): boolean {
  return cart.itemCount > 0
}

export function canSubmitCheckout(input: {
  itemCount: number;
  serviceMode: ServiceMode;
  addressId?: string;
  store: StoreSummary | null;
}): boolean {
  if (input.itemCount < 1) return false;
  if (input.store?.businessStatus !== "open" || !input.store.supportModes.includes(input.serviceMode)) return false;
  return input.serviceMode !== "delivery" || Boolean(input.addressId);
}
