import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { apiBase } from './api';
import type { CartRecords } from './cart-state';
import { privateSnapshot } from './private-snapshot';

let scope: Promise<string> | undefined;
function storageKey() {
  scope ??= digestStringAsync(CryptoDigestAlgorithm.SHA256, apiBase).then((digest) => `lingdian-cart-${digest}`).catch((error: unknown) => {
    scope = undefined;
    throw error;
  });
  return scope;
}
const previewKey = `lingdian-cart:${apiBase}`;

export const cartStorage = {
  async read(): Promise<CartRecords> {
    if (Platform.OS !== 'web') return await privateSnapshot('cart', await storageKey()).read<CartRecords>() ?? {};
    const stored = sessionStorage.getItem(previewKey);
    return stored ? JSON.parse(stored) as CartRecords : {};
  },
  async write(records: CartRecords): Promise<void> {
    if (Platform.OS !== 'web') return privateSnapshot('cart', await storageKey()).write(randomUUID(), records);
    sessionStorage.setItem(previewKey, JSON.stringify(records));
  },
};
