import type { OrderPickupSubscription } from "@lingdian/contracts";
import { customerAuth, loginWithProvider } from "./auth";
import { request } from "./request";

function pickupNotificationPath(orderId: string) {
  return `/customer/orders/${encodeURIComponent(orderId)}/pickup-notification`;
}

export function getPickupSubscription(orderId: string) {
  return request<OrderPickupSubscription | null>(pickupNotificationPath(orderId));
}

export async function subscribeToPickup(orderId: string, templateId: string) {
  const session = customerAuth.getSessionVersion();
  const accepted = await new Promise<boolean>((resolve, reject) => {
    uni.requestSubscribeMessage({
      tmplIds: [templateId],
      success(result) {
        resolve((result as unknown as Record<string, unknown>)[templateId] === "accept");
      },
      fail() { reject(new Error("无法订阅微信提醒，请稍后重试。")); },
    });
  });
  if (!accepted || session !== customerAuth.getSessionVersion()) return null;

  const loginCode = await loginWithProvider("WECHAT");
  if (session !== customerAuth.getSessionVersion()) return null;
  return request<OrderPickupSubscription>(pickupNotificationPath(orderId), {
    method: "POST",
    data: { templateId, loginCode },
  });
}
