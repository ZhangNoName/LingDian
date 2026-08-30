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
  uni.removeStorageSync("lingdian_customer_auto_recovery_blocked");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("recovers a linked WeChat mini-program session with a fresh platform login code", async () => {
  vi.spyOn(uni, "getSystemInfoSync").mockReturnValue({
    uniPlatform: "mp-weixin",
  } as unknown as ReturnType<typeof uni.getSystemInfoSync>);
  const request = vi.fn((options: UniApp.RequestOptions) => {
    const recovery = String(options.url).endsWith("/auth/oauth/wechat/miniapp/session");
    options.success?.({
      statusCode: 201,
      data: { code: 0, data: { access_token: recovery ? "recovered-access" : "initial-access", expires_in: 900, user: userProfile } },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  let loginCalls = 0;
  Object.assign(uni, {
    request,
    login(options: UniApp.LoginOptions) {
      loginCalls += 1;
      options.success?.({ code: `mini-login-${loginCalls}`, errMsg: "login:ok" } as UniApp.LoginRes);
      return {} as UniApp.LoginRes;
    },
  });

  await customerAuth.wechatPhoneLogin("phone-code", legalConsent);
  assert.equal(customerAuth.getAccessToken(), "initial-access");

  await customerAuth.recoverAfterRelaunch();

  assert.equal(customerAuth.getAccessToken(), "recovered-access");
  assert.match(String(request.mock.calls[1][0].url), /\/auth\/oauth\/wechat\/miniapp\/session$/);
  assert.deepEqual(request.mock.calls[1][0].data, { code: "mini-login-2", audience: "user-api" });
  assert.equal(request.mock.calls[1][0].withCredentials, false);
  assert.equal(uni.getStorageSync("lingdian_refresh_credential"), "");
});

test("uses the HttpOnly cookie refresh endpoint only on H5", async () => {
  vi.spyOn(uni, "getSystemInfoSync").mockReturnValue({
    uniPlatform: "web",
  } as unknown as ReturnType<typeof uni.getSystemInfoSync>);
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 201,
      data: { code: 0, data: { access_token: "browser-access", expires_in: 900, user: userProfile } },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  assert.equal(await customerAuth.recoverAfterRelaunch(), true);
  assert.match(String(request.mock.calls[0][0].url), /\/auth\/refresh$/);
  assert.deepEqual(request.mock.calls[0][0].data, {});
  assert.equal(request.mock.calls[0][0].withCredentials, true);
});

test("does not silently recreate a native session after explicit logout", async () => {
  vi.spyOn(uni, "getSystemInfoSync").mockReturnValue({
    uniPlatform: "mp-weixin",
  } as unknown as ReturnType<typeof uni.getSystemInfoSync>);
  customerAuth.acceptLogin({ access_token: "native-access", expires_in: 900, user: userProfile });
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 204, data: undefined } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  const login = vi.fn();
  Object.assign(uni, { request, login });

  await customerAuth.logout();

  assert.equal(await customerAuth.recoverAfterRelaunch(), false);
  assert.equal(request.mock.calls.length, 1);
  assert.match(String(request.mock.calls[0][0].url), /\/auth\/logout$/);
  assert.equal(login.mock.calls.length, 0);
});

test("replaces the demo token with an authenticated access token", () => {
  uni.setStorageSync("lingdian_demo_token", "demo-token");

  customerAuth.acceptLogin({ access_token: "jwt", expires_in: 900, user: userProfile });

  assert.equal(uni.getStorageSync("lingdian_demo_token"), "");
  assert.equal(customerAuth.getAccessToken(), "jwt");
});

test("rejects cross-audience or non-customer sessions", () => {
  customerAuth.acceptLogin({ access_token: "existing-jwt", expires_in: 900, user: userProfile });
  expect(() => customerAuth.acceptLogin({
    access_token: "admin-jwt",
    expires_in: 900,
    user: { ...userProfile, audience: "admin-api", roles: ["ADMIN"] },
  })).toThrow("不属于顾客端");
  expect(() => customerAuth.acceptLogin({
    access_token: "merchant-jwt",
    expires_in: 900,
    user: { ...userProfile, audience: "user-api", roles: ["MERCHANT"] },
  })).toThrow("不属于顾客端");
  assert.equal(customerAuth.getAccessToken(), undefined);
  assert.equal(customerAuth.getUser(), undefined);
});

test("sends a phone-login code through the customer endpoint", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 201, data: { code: 0, data: { messageId: "code-1" } } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await customerAuth.sendCode("13800000000");

  const options = request.mock.calls[0][0];
  const data = options.data as { phone: string; purpose: string; deviceId: string };
  assert.deepEqual(data, {
    phone: "13800000000",
    purpose: "PHONE_LOGIN",
    deviceId: data.deviceId,
  });
  assert.match(data.deviceId, /^customer-/);
  assert.equal(options.header?.["X-Device-Id"], data.deviceId);
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

test("maps the legal-consent API code before exposing an authentication error", async () => {
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({
      statusCode: 400,
      data: { code: 2004, msg: "Legal agreement version is outdated.", data: null },
    } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await expect(customerAuth.phoneLogin("13800000000", "123456", legalConsent))
    .rejects.toThrow("请更新小程序后重试");
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

test("refreshes an expired customer token before revoking the server session", async () => {
  customerAuth.acceptLogin({ access_token: "expired-jwt", expires_in: 0, user: userProfile });
  const request = vi.fn((options: UniApp.RequestOptions) => {
    if (String(options.url).endsWith("/auth/refresh")) {
      options.success?.({
        statusCode: 201,
        data: { code: 0, data: { access_token: "refreshed-jwt", expires_in: 900, user: userProfile } },
      } as unknown as UniApp.RequestSuccessCallbackResult);
    } else {
      options.success?.({ statusCode: 204, data: undefined } as unknown as UniApp.RequestSuccessCallbackResult);
    }
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await customerAuth.logout();

  assert.match(String(request.mock.calls[0][0].url), /\/auth\/refresh$/);
  assert.match(String(request.mock.calls[1][0].url), /\/auth\/logout$/);
  assert.equal(request.mock.calls[1][0].header?.Authorization, "Bearer refreshed-jwt");
  assert.equal(customerAuth.getAccessToken(), undefined);
});

test("clears an expired local session even when refresh fails during logout", async () => {
  customerAuth.acceptLogin({ access_token: "expired-jwt", expires_in: 0, user: userProfile });
  const request = vi.fn((options: UniApp.RequestOptions) => {
    options.fail?.({ errMsg: "request:fail offline" } as UniApp.GeneralCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  await expect(customerAuth.logout()).resolves.toBeUndefined();

  assert.equal(request.mock.calls.length, 1);
  assert.match(String(request.mock.calls[0][0].url), /\/auth\/refresh$/);
  assert.equal(customerAuth.getAccessToken(), undefined);
  assert.equal(customerAuth.getUser(), undefined);
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
