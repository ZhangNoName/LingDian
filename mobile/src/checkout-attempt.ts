import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Platform } from 'react-native';
import { apiBase } from './api';
import type { CartChoice, OrderMode, PurchasedLine } from './cart-state';
import { privateSnapshot } from './private-snapshot';

export type CheckoutBody = {
  storeId: string;
  orderType: OrderMode;
  addressId?: string;
  expectedAddressUpdatedAt?: string;
  remark?: string;
  customerName?: string;
  paymentChannel: 'cash';
  expectedPayableCents?: number;
  items: {
    sku_id: string;
    quantity: number;
    expectedUnitCents?: number;
    selections: CartChoice[];
  }[];
};

export type CheckoutDraft = {
  storeName: string;
  body: CheckoutBody;
  cartLines: PurchasedLine[];
};

export type CheckoutAttempt = {
  createdAt: string;
  storeName?: string;
  body: CheckoutBody & { clientRequestId: string };
  cartLines?: PurchasedLine[];
};

// The web preview keeps checkout data in memory alongside its session.
const browserAttempts = new Map<string, CheckoutAttempt>();
const keyName = async (userId: string) => {
  const scope = await digestStringAsync(CryptoDigestAlgorithm.SHA256, JSON.stringify([apiBase, userId]));
  return `lingdian-checkout-${scope}`;
};
export const checkoutStorage = {
  async read(userId: string): Promise<CheckoutAttempt | null> {
    if (Platform.OS === 'web') return browserAttempts.get(userId) ?? null;
    return privateSnapshot('checkout', await keyName(userId)).read<CheckoutAttempt>();
  },

  async write(userId: string, attempt: CheckoutAttempt): Promise<void> {
    if (Platform.OS === 'web') {
      browserAttempts.set(userId, attempt);
      return;
    }
    await privateSnapshot('checkout', await keyName(userId)).write(attempt.body.clientRequestId, attempt);
  },

  async remove(userId: string, id: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (browserAttempts.get(userId)?.body.clientRequestId === id) browserAttempts.delete(userId);
      return;
    }
    await privateSnapshot('checkout', await keyName(userId)).remove(id);
  },
};
