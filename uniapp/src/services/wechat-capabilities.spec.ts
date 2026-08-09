import { afterEach, assert, expect, test, vi } from "vitest";
import { chooseWechatAddress } from "./wechat-capabilities";

afterEach(() => {
  vi.restoreAllMocks();
});

test("WeChat address selection maps every supported address field", async () => {
  Object.assign(uni, {
    chooseAddress(options: UniApp.ChooseAddressOptions) {
      options.success?.({
        errMsg: "chooseAddress:ok", userName: "张三", telNumber: "13800000000",
        provinceName: "北京市", cityName: "北京市", countyName: "西城区", streetName: "太平街",
        detailInfo: "旧详情", detailInfoNew: "甲6号", postalCode: "100000", nationalCode: "110102",
      } as unknown as UniApp.ChooseAddressRes);
    },
  });

  assert.deepEqual(await chooseWechatAddress(), {
    status: "selected",
    address: {
      recipientName: "张三", phoneNumber: "13800000000", provinceName: "北京市", cityName: "北京市",
      countyName: "西城区", streetName: "太平街", detailInfo: "甲6号", postalCode: "100000", nationalCode: "110102",
    },
  });
});

test("WeChat address cancellation is a non-error result", async () => {
  Object.assign(uni, {
    chooseAddress(options: UniApp.ChooseAddressOptions) {
      options.fail?.({ errMsg: "chooseAddress:fail cancel" });
    },
  });

  assert.deepEqual(await chooseWechatAddress(), { status: "cancelled" });
});

test("WeChat address failures remain retryable errors", async () => {
  Object.assign(uni, {
    chooseAddress(options: UniApp.ChooseAddressOptions) {
      options.fail?.({ errMsg: "chooseAddress:fail system error" });
    },
  });

  await expect(chooseWechatAddress()).rejects.toThrow(/system error/i);
});
