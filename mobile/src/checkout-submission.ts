import type { OrderDetailContract } from '@lingdian/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { addressesPath } from './address-selection';
import { ApiError } from './api';
import { auth } from './auth';
import type { useCart } from './cart';
import { checkoutStorage, type CheckoutAttempt, type CheckoutDraft } from './checkout-attempt';
import { useApi, useWorkspace } from './context';
import { menuQueryKey } from './menu';

type CheckoutCart = Pick<ReturnType<typeof useCart>, 'ready' | 'flush' | 'removePurchased'>;

export function useCheckoutSubmission({
  cart, onAddressConflict, onOrdered,
}: { cart: CheckoutCart; onAddressConflict: () => void; onOrdered: (id: string) => void }) {
  const api = useApi();
  const { user, show } = useWorkspace();
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (draft: CheckoutDraft | undefined) => {
      if (!user || !cart.ready) throw new Error('请登录并恢复购物袋后重试。');
      const userId = user.userId;
      if (activeCheckouts.has(userId)) throw new Error('订单正在确认，请稍候。');
      activeCheckouts.add(userId);
      try {
        const key = checkoutKey(userId);
        let attempt = client.getQueryData<CheckoutAttempt | null>(key);
        if (attempt === undefined) throw new Error('请重新加载待确认订单。');
        if (!attempt) {
          if (!draft) throw new Error('请核对购物袋后重新提交。');
          attempt = {
            ...draft,
            createdAt: new Date().toISOString(),
            body: { ...draft.body, clientRequestId: randomUUID() },
          };
          await cart.flush();
          await checkoutStorage.write(userId, attempt);
          client.setQueryData(key, attempt);
        }
        const id = attempt.body.clientRequestId;
        const clear = async () => {
          await checkoutStorage.remove(userId, id);
          client.setQueryData(key, null);
        };
        let order: OrderDetailContract;
        try {
          order = await api.call<OrderDetailContract>('/mobile/orders', { method: 'POST', body: attempt.body });
          if (!order?.id) throw new Error('未收到订单编号，请确认提交结果。');
        } catch (error) {
          if (isDefinitiveRejection(error)) await clear();
          throw error;
        }
        await cart.removePurchased(attempt.body.storeId, id, attempt.cartLines);
        await clear();
        return order;
      } finally {
        activeCheckouts.delete(userId);
      }
    },
    onError: (error) => {
      const session = auth.snapshot();
      if (session.workspace !== 'user' || session.user?.sessionId !== user?.sessionId || !isDefinitiveRejection(error)) return;
      if (conflictReason(error) === 'APP_CHECKOUT_ADDRESS_CHANGED') {
        onAddressConflict();
        void client.invalidateQueries({ queryKey: [api.key, addressesPath], exact: true }, { cancelRefetch: false });
      } else {
        void client.invalidateQueries({ queryKey: menuQueryKey }, { cancelRefetch: false });
      }
    },
    onSuccess: (order) => {
      void client.invalidateQueries({ queryKey: [api.key] });
      const session = auth.snapshot();
      if (session.workspace !== 'user' || session.user?.sessionId !== user?.sessionId) return;
      show('已下单');
      onOrdered(order.id);
    },
  });
}

function isDefinitiveRejection(error: unknown) {
  return error instanceof ApiError && error.code !== undefined && [400, 404, 409].includes(error.status);
}

export function conflictReason(error: unknown) {
  const details = error instanceof ApiError && error.status === 409 ? error.details : null;
  return typeof details === 'object' && details !== null && 'reason' in details ? details.reason : undefined;
}

const checkoutKey = (userId?: string) => ['checkout-attempt', userId] as const;
const activeCheckouts = new Set<string>();

export function useCheckoutAttempt() {
  const { user, workspace } = useWorkspace();
  const userId = user?.userId;
  return useQuery({
    queryKey: checkoutKey(userId),
    queryFn: () => checkoutStorage.read(userId!),
    enabled: !!userId && workspace === 'user' && !user?.mustChangePassword,
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: 0,
  });
}
