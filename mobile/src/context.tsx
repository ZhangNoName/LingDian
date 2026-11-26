import type { AuthenticatedUser } from '@lingdian/contracts';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { request, type RequestOptions } from './api';
import { auth, type Workspace } from './auth';
import type { Route } from './routes';

export type Store = { id: string; name: string; code?: string; status?: string };

export type WorkspaceContext = {
  workspace: Workspace;
  user: AuthenticatedUser | null;
  store?: Store;
  customerStoreId?: string;
  selectCustomerStore: (id?: string) => void;
  key: string;
  isCurrent: () => boolean;
  go: (route: Route) => void;
  back: () => void;
  signIn: () => void;
  show: (message: string) => void;
};

export const WorkspaceContext = createContext<WorkspaceContext | null>(null);
export const ScreenActiveContext = createContext(true);

export function useScreenActive() {
  return useContext(ScreenActiveContext);
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Workspace provider missing');
  return context;
}

export function useApi() {
  const { workspace, key, user, store } = useWorkspace();
  return {
    key,
    call: <T,>(path: string, options?: RequestOptions) => {
      if (!user) return request<T>(path, options);
      return auth.authenticated<T>(workspace, user.sessionId, workspace === 'merchant' ? store?.id : undefined, path, options);
    },
  };
}

export function useData<T>(path: string, enabled = true) {
  const { key, call } = useApi();
  const active = useScreenActive();
  return useQuery({ queryKey: [key, path], queryFn: ({ signal }) => call<T>(path, { signal }), enabled, subscribed: active });
}

export function useMerchantPaths() {
  const { store } = useWorkspace();
  const root = `/merchant/stores/${encodeURIComponent(store!.id)}`;
  return { root, inventory: `${root}/inventory` };
}
