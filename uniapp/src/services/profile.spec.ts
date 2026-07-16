import { afterEach, assert, test, vi } from "vitest";
import { customerAuth } from "./auth";
import { profile } from "./profile";

afterEach(() => {
  customerAuth.clear();
  vi.restoreAllMocks();
});

test("updates only the signed-in user nickname", async () => {
  customerAuth.acceptLogin({
    access_token: "customer-jwt",
    expires_in: 900,
    user: { userId: "customer-1", sessionId: "session-1", audience: "user-api", roles: ["USER"] },
  });
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 200, data: { code: 0, data: { nickname: "灵点用户" } } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock });

  const result = await profile.updateNickname("灵点用户");

  assert.deepEqual(result, { nickname: "灵点用户" });
  assert.match(requestMock.mock.calls[0][0].url, /\/auth\/profile\/nickname$/);
  assert.equal(requestMock.mock.calls[0][0].method, "PATCH");
  assert.equal(requestMock.mock.calls[0][0].header?.Authorization, "Bearer customer-jwt");
  assert.deepEqual(requestMock.mock.calls[0][0].data, { nickname: "灵点用户" });
});
