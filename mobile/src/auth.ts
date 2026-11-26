import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { apiBase, request } from './api';
import { AuthManager } from './auth-manager';

export { availableWorkspaces, workspaceLabel, type AccountWorkspace, type Workspace } from './auth-manager';

const WEB_STORAGE = new Map<string, string>();
const realm = apiBase.replace(/[^A-Za-z0-9._-]/g, '_');

const storage = {
  async get(key: string): Promise<string | null> {
    return Platform.OS === 'web' ? WEB_STORAGE.get(key) ?? null : SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') WEB_STORAGE.set(key, value);
    else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') WEB_STORAGE.delete(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

export const auth = new AuthManager({ storage, request, createDeviceId: randomUUID, realm });
export const useAuth = () => useSyncExternalStore(auth.subscribe, auth.snapshot, auth.snapshot);
