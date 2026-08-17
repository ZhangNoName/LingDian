import { afterEach, assert, expect, test, vi } from "vitest";
import type { AuthenticatedUser } from "@lingdian/contracts";
import { beginMiniProgramThirdPartyLogin, customerAuth } from "./auth";

const userProfile: AuthenticatedUser = {
  userId: "customer-1",
  sessionId: "session-1",
  audience: "user-api" as const,
  roles: ["USER"],
};

const legalConsent = {
  userAgreementVersion: "2026-08-17",
  privacyPolicyVersion: "2026-08-17",
};

afterEach(() => {
  customerAuth.clear();
  uni.removeStorageSync("lingdian_demo_token");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("recovers a native session after relaunch through its OS-managed cookie transport without storing a raw refresh token", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    const refresh = request.mock.calls.length > 1;
    options.success?.({
      statusCode: 201,
      data: { code: 0, data: { access_token: refresh ? "recovered-access" : "initial-access", expires_in: 900, user: userProfile } },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await customerAuth.phoneLogin("13800000000", "123456", legalConsent);
  assert.equal(customerAuth.getAccessToken(), "initial-access");

  await customerAuth.recoverAfterRelaunch();

  assert.equal(customerAuth.getAccessToken(), "recovered-access");
  assert.equal(request.mock.calls[1][0].header?.["x-auth-client"], undefined);
  assert.deepEqual(request.mock.calls[1][0].data, {});
  assert.equal(uni.getStorageSync("lingdian_refresh_credential"), "");
});

test("replaces the demo token with an authenticated access token", () => {
  uni.setStorageSync("lingdian_demo_token", "demo-token");

  customerAuth.acceptLogin({ access_token: "jwt", expires_in: 900, user: userProfile });

  assert.equal(uni.getStorageSync("lingdian_demo_token"), "");
  assert.equal(customerAuth.getAccessToken(), "jwt");
});

test("sends a phone-login code through the customer endpoint", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 201, data: { code: 0, data: { messageId: "code-1" } } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await customerAuth.sendCode("13800000000");

  assert.deepEqual(request.mock.calls[0][0].data, {
    phone: "13800000000",
    purpose: "PHONE_LOGIN",
    deviceId: "uniapp",
  });
});

test("accepts a customer session after a phone login", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 201, data: { code: 0, data: { access_token: "phone-jwt", expires_in: 900, user: userProfile } } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await customerAuth.phoneLogin("13800000000", "123456", legalConsent);

  assert.equal(customerAuth.getAccessToken(), "phone-jwt");
  assert.deepEqual(request.mock.calls[0][0].data, {
    phone: "13800000000",
    code: "123456",
    audience: "user-api",
    legalConsent,
  });
  assert.equal((request.mock.calls[0][0].data as { legalConsent: unknown }).legalConsent, legalConsent);
});

test("accepts a session only after a pending OAuth binding completes", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 201, data: { code: 0, data: { access_token: "linked-jwt", expires_in: 900, user: userProfile } } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await customerAuth.completePhoneLink("pending-1", "13800000000", "123456", legalConsent);

  assert.equal(customerAuth.getAccessToken(), "linked-jwt");
  assert.deepEqual(request.mock.calls[0][0].data, {
    pendingOauthId: "pending-1",
    phone: "13800000000",
    code: "123456",
    legalConsent,
  });
  assert.equal((request.mock.calls[0][0].data as { legalConsent: unknown }).legalConsent, legalConsent);
});

test("treats a 204 logout response as a successful logout", async () => {
  customerAuth.acceptLogin({ access_token: "jwt", expires_in: 900, user: userProfile });
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 204, data: undefined } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await expect(customerAuth.logout()).resolves.toBeUndefined();

  assert.equal(customerAuth.getAccessToken(), undefined);
  assert.equal(request.mock.calls[0][0].header?.Authorization, "Bearer jwt");
});

test("sends a uni.login code to the mini-program callback endpoint and receives only a pending binding", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 200, data: { code: 0, data: { pending_oauth_id: "pending-1", expires_in: 600 } } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, {
    request,
    login(options: UniApp.LoginOptions) {
      options.success?.({ code: "mini-login-code", errMsg: "login:ok" } as UniApp.LoginRes);
      return {} as UniApp.LoginRes;
    },
  });

  const pending = await beginMiniProgramThirdPartyLogin("WECHAT");

  assert.equal(pending.pending_oauth_id, "pending-1");
  assert.match(request.mock.calls[0][0].url, /\/auth\/oauth\/wechat\/miniapp\/callback$/);
  assert.deepEqual(request.mock.calls[0][0].data, { code: "mini-login-code", audience: "user-api" });
  assert.equal(customerAuth.getAccessToken(), undefined);
});

test("exchanges distinct WeChat login and phone codes for a customer session", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 201,
      data: { code: 0, data: { access_token: "wechat-jwt", expires_in: 900, user: userProfile } },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, {
    request,
    login(options: UniApp.LoginOptions) {
      options.success?.({ code: "wx-login-code", errMsg: "login:ok" } as UniApp.LoginRes);
      return {} as UniApp.LoginRes;
    },
  });

  await customerAuth.wechatPhoneLogin("wx-phone-code", legalConsent);

  assert.equal(customerAuth.getAccessToken(), "wechat-jwt");
  assert.match(request.mock.calls[0][0].url, /\/auth\/wechat\/miniapp\/phone-login$/);
  assert.deepEqual(request.mock.calls[0][0].data, {
    loginCode: "wx-login-code",
    phoneCode: "wx-phone-code",
    audience: "user-api",
    legalConsent,
  });
  assert.equal((request.mock.calls[0][0].data as { legalConsent: unknown }).legalConsent, legalConsent);
});
