import { afterEach, assert, test, vi } from "vitest";
import { customerAuth } from "./auth";
import { addresses, formatAddress } from "./addresses";

const manualAddress = {
  recipientName: "张三", phoneNumber: "13800000000",
  provinceName: "河南省", cityName: "开封市", countyName: "龙亭区", detailInfo: "示例路6号",
  streetName: "示例街道", postalCode: "", nationalCode: "",
};
const address = {
  ...manualAddress, id: "address-1", isDefault: true,
  createdAt: "2026-08-09T00:00:00.000Z", updatedAt: "2026-08-09T00:00:00.000Z",
};

afterEach(() => {
  customerAuth.clear();
  vi.restoreAllMocks();
});

test("address display keeps an existing street and avoids repeating the municipality", () => {
  assert.equal(formatAddress(address), "河南省开封市龙亭区示例街道示例路6号");
  assert.equal(formatAddress({ ...address, streetName: "" }), "河南省开封市龙亭区示例路6号");
  assert.equal(formatAddress({
    ...address, provinceName: "北京市", cityName: "北京市", countyName: "西城区", streetName: "太平街", detailInfo: "甲6号",
  }), "北京市西城区太平街甲6号");
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
  assert.equal((await addresses.create(manualAddress)).id, "address-1");
  assert.equal((await addresses.setDefault("address-1")).isDefault, true);
  await addresses.remove("address-1");

  assert.deepEqual(request.mock.calls.map((call) => [call[0].method ?? "GET", new URL(call[0].url).pathname]), [
    ["GET", "/api/addresses"],
    ["POST", "/api/addresses"],
    ["PATCH", "/api/addresses/address-1/default"],
    ["DELETE", "/api/addresses/address-1"],
  ]);
  assert.ok(request.mock.calls.every((call) => call[0].header?.Authorization === "Bearer customer-jwt"));
  assert.deepEqual(request.mock.calls[1][0].data, manualAddress);
});
