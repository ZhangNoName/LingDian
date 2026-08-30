import { afterEach, assert, expect, test, vi } from "vitest";
import type { AuthenticatedUser } from "@lingdian/contracts";
import { customerAuth } from "./auth";
import { request } from "./request";

const userProfile: AuthenticatedUser = {
  userId: "customer-1",
  sessionId: "session-1",
  audience: "user-api" as const,
  roles: ["USER"],
};

afterEach(() => {
  customerAuth.clear();
  uni.removeStorageSync("lingdian_customer_auto_recovery_blocked");
  vi.restoreAllMocks();
});

test("retries a rejected request once with a refreshed bearer token", async () => {
  customerAuth.acceptLogin({ access_token: "expired-jwt", expires_in: 900, user: userProfile });
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    if (requestMock.mock.calls.length === 1) {
      options.success?.({ statusCode: 401, data: { code: 401, msg: "expired" } } as unknown as UniApp.RequestSuccessCallbackResult);
    } else if (requestMock.mock.calls.length === 2) {
      options.success?.({ statusCode: 200, data: { code: 0, data: { access_token: "fresh-jwt", expires_in: 900, user: userProfile } } } as unknown as UniApp.RequestSuccessCallbackResult);
    } else {
      options.success?.({ statusCode: 200, data: { code: 0, data: { id: "order-1" } } } as unknown as UniApp.RequestSuccessCallbackResult);
    }
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock });

  const result = await request<{ id: string }>("/orders");

  assert.equal(result.id, "order-1");
  assert.equal(requestMock.mock.calls[0][0].header?.Authorization, "Bearer expired-jwt");
  assert.match(requestMock.mock.calls[1][0].url, /\/auth\/refresh$/);
  assert.equal(requestMock.mock.calls[2][0].header?.Authorization, "Bearer fresh-jwt");
});

test("clears the session and directs the customer to login when refresh fails", async () => {
  customerAuth.acceptLogin({ access_token: "expired-jwt", expires_in: 900, user: userProfile });
  const reLaunch = vi.fn();
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 401, data: { code: 401, msg: "expired" } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock, reLaunch });

  await expect(request("/orders")).rejects.toThrow("登录状态已失效，请重新登录。");

  assert.equal(customerAuth.getAccessToken(), undefined);
  assert.deepEqual(reLaunch.mock.calls[0][0], { url: "/pages/auth/login" });
});

test("does not silently reauthenticate a rejected native access token", async () => {
  vi.spyOn(uni, "getSystemInfoSync").mockReturnValue({
    uniPlatform: "mp-weixin",
  } as unknown as ReturnType<typeof uni.getSystemInfoSync>);
  customerAuth.acceptLogin({ access_token: "revoked-jwt", expires_in: 900, user: userProfile });
  const reLaunch = vi.fn();
  const login = vi.fn();
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 401, data: { code: 401, msg: "revoked" } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock, reLaunch, login });

  await expect(request("/orders")).rejects.toThrow("登录状态已失效，请重新登录。");

  assert.equal(requestMock.mock.calls.length, 1);
  assert.equal(login.mock.calls.length, 0);
  assert.equal(customerAuth.getAccessToken(), undefined);
  assert.deepEqual(reLaunch.mock.calls[0][0], { url: "/pages/auth/login" });
});

test("blocks further native recovery when the request still fails after platform reauthentication", async () => {
  vi.spyOn(uni, "getSystemInfoSync").mockReturnValue({
    uniPlatform: "mp-weixin",
  } as unknown as ReturnType<typeof uni.getSystemInfoSync>);
  customerAuth.acceptLogin({ access_token: "expired-jwt", expires_in: 0, user: userProfile });
  const reLaunch = vi.fn();
  const login = vi.fn((options: UniApp.LoginOptions) => {
    options.success?.({ code: "fresh-platform-code", errMsg: "login:ok" } as UniApp.LoginRes);
    return {} as UniApp.LoginRes;
  });
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    if (String(options.url).endsWith("/miniapp/session")) {
      options.success?.({
        statusCode: 201,
        data: { code: 0, data: { access_token: "recovered-jwt", expires_in: 900, user: userProfile } },
      } as unknown as UniApp.RequestSuccessCallbackResult);
    } else {
      options.success?.({ statusCode: 401, data: { code: 401, msg: "rejected" } } as unknown as UniApp.RequestSuccessCallbackResult);
    }
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock, reLaunch, login });

  await expect(request("/orders")).rejects.toThrow("登录状态已失效，请重新登录。");

  assert.equal(login.mock.calls.length, 1);
  assert.equal(await customerAuth.refresh(), false);
  assert.equal(login.mock.calls.length, 1);
  assert.equal(customerAuth.getAccessToken(), undefined);
  assert.deepEqual(reLaunch.mock.calls[0][0], { url: "/pages/auth/login" });
});

test("turns a platform network failure into a useful Chinese message", async () => {
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    options.fail?.({ errMsg: "request:fail" } as UniApp.GeneralCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock });

  await expect(request("/menu/current", { requiresAuth: false })).rejects.toThrow(
    "网络连接异常，请检查网络后重试。",
  );
});

test("does not force a guest to login when a public request returns 401", async () => {
  const reLaunch = vi.fn();
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 401, data: { code: 401, msg: "Unauthorized" } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock, reLaunch });

  await expect(request("/menu/current", { requiresAuth: false })).rejects.toThrow();

  expect(requestMock).toHaveBeenCalledTimes(1);
  expect(reLaunch).not.toHaveBeenCalled();
});

test("does not destroy a valid customer session when a public endpoint rejects a request", async () => {
  customerAuth.acceptLogin({ access_token: "still-valid", expires_in: 900, user: userProfile });
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 401, data: { code: 401, msg: "Unauthorized" } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock });

  await expect(request("/menu/current", { requiresAuth: false })).rejects.toThrow();

  expect(customerAuth.getAccessToken()).toBe("still-valid");
  expect(requestMock.mock.calls[0][0].header?.Authorization).toBeUndefined();
});

test("accepts an empty 204 response for delete operations", async () => {
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 204, data: undefined } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock });

  await expect(request<void>("/addresses/address-1", { method: "DELETE" })).resolves.toBeUndefined();
});
