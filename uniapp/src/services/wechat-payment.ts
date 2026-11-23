import type { PaymentIntentContract, PaymentIntentStatus } from "@lingdian/contracts";
import { customerAuth, loginWithProvider } from "./auth";
import { request, RequestError } from "./request";

export async function fetchWechatPaymentAvailability(storeId: string): Promise<boolean> {
  try {
    const availability = await request<{ wechatMiniProgram: boolean }>(
      `/customer/payment-methods?storeId=${encodeURIComponent(storeId)}`,
    );
    return availability.wechatMiniProgram === true;
  } catch (error) {
    // Previously deployed APIs supported cash checkout without this endpoint.
    if (error instanceof RequestError && error.statusCode === 404) return false;
    throw error;
  }
}

export async function getWechatPayment(orderId: string) {
  const { intent } = await request<{ intent: PaymentIntentContract | null }>(
    `/customer/orders/${encodeURIComponent(orderId)}/wechat-payment`,
  );
  return intent;
}

export function fetchWechatPaymentReceipt(paymentNo: string) {
  return request<PaymentIntentContract>(`/customer/payments/${encodeURIComponent(paymentNo)}`);
}

export function recheckWechatPaymentReceipt(paymentNo: string) {
  return request<PaymentIntentContract>(`/customer/payments/${encodeURIComponent(paymentNo)}/recheck`, { method: "POST" });
}

export function canRetryWechatPayment(status: PaymentIntentStatus): boolean {
  return status === "FAILED" || status === "CANCELLED" || status === "EXPIRED";
}

export function wechatPaymentConfirmationStorage(orderId: string) {
  const userId = customerAuth.getUser()?.userId;
  const key = userId ? `lingdian:wechat-confirming:${JSON.stringify([userId, orderId])}` : undefined;
  return {
    read(): string {
      if (!key) return "";
      try {
        const value: unknown = uni.getStorageSync(key);
        return typeof value === "string" && /^PAY[A-Za-z0-9]{1,61}$/.test(value) ? value : "";
      } catch {
        return "";
      }
    },
    write(paymentNo: string): void {
      if (!key) return;
      try {
        if (paymentNo) uni.setStorageSync(key, paymentNo);
        else uni.removeStorageSync(key);
      } catch {
        // Keep the in-page confirmation state even if device storage is unavailable.
      }
    },
  };
}

export function newWechatPaymentRequestId(): string {
  return `wechat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export async function createWechatPayment(orderId: string, clientRequestId: string) {
  const miniProgramLoginCode = await loginWithProvider("WECHAT").catch(() => {
    throw new Error("微信授权失败，请重试");
  });
  return request<PaymentIntentContract>(`/customer/orders/${encodeURIComponent(orderId)}/payments`, {
    method: "POST",
    data: { provider: "WECHAT_PAY", channel: "WECHAT", clientRequestId, miniProgramLoginCode },
  });
}

export function requestNativeWechatPayment(action: Record<string, unknown> | null): Promise<"submitted" | "cancelled"> {
  if (!action || action.type !== "WECHAT_MINI_PROGRAM" ||
      typeof action.timeStamp !== "string" || !/^\d{10}$/.test(action.timeStamp) ||
      typeof action.nonceStr !== "string" || !action.nonceStr || action.nonceStr.length > 32 ||
      typeof action.package !== "string" || !/^prepay_id=\S+$/.test(action.package) ||
      action.signType !== "RSA" || typeof action.paySign !== "string" || !action.paySign.trim()) {
    return Promise.reject(new Error("暂时无法打开微信收银台，请稍后重试"));
  }
  const { timeStamp, nonceStr, package: paymentPackage, signType, paySign } = action;
  return new Promise((resolve, reject) => {
    uni.requestPayment({
      provider: "wxpay",
      timeStamp,
      nonceStr,
      package: paymentPackage,
      signType,
      paySign,
      success: () => resolve("submitted"),
      fail: (error) => {
        if (error.errMsg?.toLowerCase().includes("cancel")) resolve("cancelled");
        else reject(new Error("微信收银台未完成支付，请查看订单状态后重试"));
      },
    });
  });
}
