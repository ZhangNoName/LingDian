import type { CreateUserAddressRequest } from "@lingdian/contracts";

type ChooseAddressResult =
  | { status: "selected"; address: CreateUserAddressRequest }
  | { status: "cancelled" };

type NativeAddress = {
  userName: string;
  telNumber: string;
  provinceName: string;
  cityName: string;
  countyName: string;
  streetName?: string;
  detailInfo: string;
  detailInfoNew?: string;
  postalCode?: string;
  nationalCode?: string;
};

export function chooseWechatAddress(): Promise<ChooseAddressResult> {
  return new Promise((resolve, reject) => {
    if (typeof uni.chooseAddress !== "function") {
      reject(new Error("当前平台不支持从微信导入地址。"));
      return;
    }
    uni.chooseAddress({
      success(result) {
        const address = result as unknown as NativeAddress;
        resolve({
          status: "selected",
          address: {
            recipientName: address.userName,
            phoneNumber: address.telNumber,
            provinceName: address.provinceName,
            cityName: address.cityName,
            countyName: address.countyName,
            streetName: address.streetName ?? "",
            detailInfo: address.detailInfoNew || address.detailInfo,
            postalCode: address.postalCode ?? "",
            nationalCode: address.nationalCode ?? "",
          },
        });
      },
      fail(error) {
        if (error.errMsg.toLowerCase().includes("cancel")) {
          resolve({ status: "cancelled" });
          return;
        }
        reject(new Error(error.errMsg || "微信地址选择失败。"));
      },
    });
  });
}
