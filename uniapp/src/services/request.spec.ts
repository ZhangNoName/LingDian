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

  await expect(request("/orders")).rejects.toThrow("expired");

  assert.equal(customerAuth.getAccessToken(), undefined);
  assert.deepEqual(reLaunch.mock.calls[0][0], { url: "/pages/auth/login" });
});
