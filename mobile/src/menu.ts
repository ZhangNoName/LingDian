import type { MenuContract } from '@lingdian/contracts';
import { useQuery } from '@tanstack/react-query';
import { ApiError, endpoint, request } from './api';
import type { OrderMode } from './cart-state';
import { useScreenActive } from './context';

const modes: Array<{ id: OrderMode; label: string }> = [
  { id: 'pickup', label: '到店自取' }, { id: 'dine_in', label: '堂食' }, { id: 'takeout', label: '送货上门' },
];

export const menuQueryKey = ['public', '/menu/current'] as const;
const scopedMenuKey = (storeId?: string) => storeId ? [...menuQueryKey, storeId] : menuQueryKey;

export function useMenu({ storeId, checkout = false, enabled = true }: { storeId?: string; checkout?: boolean; enabled?: boolean } = {}) {
  const active = useScreenActive();
  return useQuery<MenuContract>({
    queryKey: scopedMenuKey(storeId),
    queryFn: async ({ signal }) => {
      const menu = await request<MenuContract>(endpoint('/menu/current', { storeId }), { signal });
      if (storeId && menu.store.id !== storeId) throw new ApiError(409, '当前门店已不可选，请重新选择。');
      return menu;
    },
    enabled, subscribed: active, staleTime: checkout ? 0 : 60_000,
    refetchOnMount: checkout ? 'always' : true,
  });
}

export function availableModes(store: MenuContract['store']) {
  return modes.filter(({ id }) => id === 'pickup' ? store.pickupEnabled !== false : id === 'dine_in' ? store.dineInEnabled !== false : store.takeoutEnabled === true);
}
