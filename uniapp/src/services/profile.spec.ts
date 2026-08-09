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

test("loads the signed-in customer profile", async () => {
  customerAuth.acceptLogin({
    access_token: "customer-jwt", expires_in: 900,
    user: { userId: "customer-1", sessionId: "session-1", audience: "user-api", roles: ["USER"] },
  });
  const requestMock = vi.fn((options: UniApp.RequestOptions) => {
    options.success?.({ statusCode: 200, data: { code: 0, data: { nickname: "灵点用户", avatar_data_url: null } } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request: requestMock });

  assert.deepEqual(await profile.get(), { nickname: "灵点用户", avatar_data_url: null });
  assert.match(requestMock.mock.calls[0][0].url, /\/auth\/profile$/);
});

test("uploads an avatar with the current access token", async () => {
  customerAuth.acceptLogin({
    access_token: "customer-jwt", expires_in: 900,
    user: { userId: "customer-1", sessionId: "session-1", audience: "user-api", roles: ["USER"] },
  });
  const uploadFile = vi.fn((options: UniApp.UploadFileOption) => {
    options.success?.({
      statusCode: 201,
      data: JSON.stringify({ code: 0, data: { nickname: "灵点用户", avatar_data_url: "data:image/png;base64,eA==" } }),
    } as UniApp.UploadFileSuccessCallbackResult);
    return {} as UniApp.UploadTask;
  });
  Object.assign(uni, { uploadFile });

  const result = await profile.uploadAvatar("wxfile://avatar.png");

  assert.equal(result.avatar_data_url, "data:image/png;base64,eA==");
  assert.equal(uploadFile.mock.calls[0][0].name, "avatar");
  assert.equal(uploadFile.mock.calls[0][0].header?.Authorization, "Bearer customer-jwt");
});
