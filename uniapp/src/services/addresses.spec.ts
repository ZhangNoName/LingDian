import { afterEach, assert, test, vi } from "vitest";
import { customerAuth } from "./auth";
import { addresses } from "./addresses";

const address = {
  id: "address-1", recipientName: "张三", phoneNumber: "13800000000",
  provinceName: "北京市", cityName: "北京市", countyName: "西城区", streetName: "太平街", detailInfo: "甲6号",
  postalCode: "100000", nationalCode: "110102", isDefault: true,
  createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z",
};

afterEach(() => {
  customerAuth.clear();
  vi.restoreAllMocks();
});

test("address client uses authenticated list, create, default, and delete routes", async () => {
  customerAuth.acceptLogin({
    access_token: "customer-jwt", expires_in: 900,
    user: { userId: "customer-1", sessionId: "session-1", audience: "user-api", roles: ["USER"] },
  });
  const responses = [[address], address, address, undefined];
  const request = vi.fn((options: UniApp.RequestOptions) => {
    const data = responses.shift();
    options.success?.({ statusCode: data === undefined ? 204 : 200, data: data === undefined ? { code: 0 } : { code: 0, data } } as unknown as UniApp.RequestSuccessCallbackResult);
    return { abort() {} } as UniApp.RequestTask;
  });
  Object.assign(uni, { request });

  assert.deepEqual(await addresses.list(), [address]);
  assert.equal((await addresses.create(address)).id, "address-1");
  assert.equal((await addresses.setDefault("address-1")).isDefault, true);
  await addresses.remove("address-1");

  assert.deepEqual(request.mock.calls.map((call) => [call[0].method ?? "GET", new URL(call[0].url).pathname]), [
    ["GET", "/api/addresses"],
    ["POST", "/api/addresses"],
    ["PATCH", "/api/addresses/address-1/default"],
    ["DELETE", "/api/addresses/address-1"],
  ]);
  assert.ok(request.mock.calls.every((call) => call[0].header?.Authorization === "Bearer customer-jwt"));
});
