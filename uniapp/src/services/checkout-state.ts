export function canCheckout(cart: { itemCount: number }): boolean {
  return cart.itemCount > 0
}

export function canSubmitCheckout(input: {
  itemCount: number;
  serviceMode: ServiceMode;
  addressId?: string;
  businessStatus?: "open" | "closed" | "busy";
  supportedModes?: readonly string[];
}): boolean {
  if (input.itemCount < 1) return false;
  if (input.businessStatus && input.businessStatus !== "open") return false;
  if (input.supportedModes && !input.supportedModes.includes(input.serviceMode)) return false;
  return input.serviceMode !== "delivery" || Boolean(input.addressId);
}
import type { ServiceMode } from "@/types/store";
