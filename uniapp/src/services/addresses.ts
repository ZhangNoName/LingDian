import type { CreateUserAddressRequest, UserAddress } from "@lingdian/contracts";
import { request } from "./request";

export const addresses = {
  list(): Promise<UserAddress[]> {
    return request("/addresses");
  },

  create(address: CreateUserAddressRequest): Promise<UserAddress> {
    return request("/addresses", { method: "POST", data: address });
  },

  setDefault(addressId: string): Promise<UserAddress> {
    return request(`/addresses/${encodeURIComponent(addressId)}/default`, { method: "PATCH" });
  },

  remove(addressId: string): Promise<void> {
    return request(`/addresses/${encodeURIComponent(addressId)}`, { method: "DELETE" });
  },
};
