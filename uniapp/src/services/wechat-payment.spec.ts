import { afterEach, expect, it, vi } from "vitest";
import { customerAuth } from "./auth";
import * as transport from "./request";
import { fetchWechatPaymentAvailability, requestNativeWechatPayment, wechatPaymentConfirmationStorage } from "./wechat-payment";

const paymentAction = {
  type: "WECHAT_MINI_PROGRAM",
  timeStamp: "1795000000",
  nonceStr: "nonce",
  package: "prepay_id=fixture",
  signType: "RSA",
  paySign: "signed-value",
};

const originalRequestPayment = uni.requestPayment;
afterEach(() => {
  uni.requestPayment = originalRequestPayment;
  vi.restoreAllMocks();
});

it("keeps cash checkout usable on an API that predates payment availability", async () => {
  vi.spyOn(transport, "request")
    .mockRejectedValueOnce(new transport.RequestError("endpoint unavailable", 404))
    .mockRejectedValueOnce(new transport.RequestError("service unavailable", 503));
  await expect(fetchWechatPaymentAvailability("store-1")).resolves.toBe(false);
  await expect(fetchWechatPaymentAvailability("store-1")).rejects.toThrow("service unavailable");
});

it("restores confirmation only for the same user and order", () => {
  const getUser = vi.spyOn(customerAuth, "getUser");
  getUser.mockReturnValue({ userId: "user-1" } as NonNullable<ReturnType<typeof customerAuth.getUser>>);
  wechatPaymentConfirmationStorage("order-1").write("PAY123");
  expect(wechatPaymentConfirmationStorage("order-1").read()).toBe("PAY123");
  expect(wechatPaymentConfirmationStorage("other-order").read()).toBe("");
  getUser.mockReturnValue({ userId: "user-2" } as NonNullable<ReturnType<typeof customerAuth.getUser>>);
  expect(wechatPaymentConfirmationStorage("order-1").read()).toBe("");
  getUser.mockReturnValue({ userId: "user-1" } as NonNullable<ReturnType<typeof customerAuth.getUser>>);
  wechatPaymentConfirmationStorage("order-1").write("");
  expect(wechatPaymentConfirmationStorage("order-1").read()).toBe("");
});

it("opens only a supported, well formed native payment action", async () => {
  const requestPayment = vi.fn();
  uni.requestPayment = requestPayment;
  await expect(requestNativeWechatPayment({ ...paymentAction, package: "https://elsewhere.test" })).rejects.toThrow("无法打开");
  await expect(requestNativeWechatPayment({ ...paymentAction, type: "REDIRECT" })).rejects.toThrow("无法打开");
  expect(requestPayment).not.toHaveBeenCalled();
});

it("hands the signed fields to WeChat and distinguishes cancellation from a submitted payment", async () => {
  const requestPayment = vi.fn()
    .mockImplementationOnce((options: UniApp.RequestPaymentOptions) => options.fail?.({ errMsg: "requestPayment:fail cancel" }))
    .mockImplementationOnce((options: UniApp.RequestPaymentOptions) => options.success?.({ errMsg: "requestPayment:ok" }));
  uni.requestPayment = requestPayment;
  await expect(requestNativeWechatPayment(paymentAction)).resolves.toBe("cancelled");
  await expect(requestNativeWechatPayment(paymentAction)).resolves.toBe("submitted");
  const { type: _type, ...params } = paymentAction;
  expect(requestPayment).toHaveBeenCalledWith(expect.objectContaining({ provider: "wxpay", ...params }));
});
