import type { UserAddress } from '@lingdian/contracts';

export const addressesPath = '/addresses';

export function formatAddress(address: UserAddress) {
  return [address.provinceName, address.cityName, address.countyName, address.streetName, address.detailInfo].filter(Boolean).join(' ');
}

export type AddressSelection = Pick<UserAddress, 'id' | 'updatedAt'>;

export function selectAddress({ id, updatedAt }: AddressSelection): AddressSelection {
  return { id, updatedAt };
}

export function reviewAddressSelection(selection: AddressSelection | null | undefined, addresses: UserAddress[] | undefined): {
  currentAddress?: UserAddress;
  issue?: 'updated' | 'removed';
} {
  if (selection === null) return { issue: 'updated' };
  if (!selection || !addresses) return {};
  const address = addresses.find(({ id }) => id === selection.id);
  if (!address) return { issue: 'removed' };
  return address.updatedAt === selection.updatedAt ? { currentAddress: address } : { issue: 'updated' };
}
