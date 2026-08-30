import type {
  CreateUserAddressRequest,
  CustomerProfile,
  UserAddress,
  WechatMiniProgramPhoneLoginRequest,
} from '../src/auth';
import { LEGAL_DOCUMENT_VERSIONS } from '../src/auth';
import type { OrderSummaryContract } from '../src/order';

export function constructWechatProfileAddressContracts() {
  const login = {
    loginCode: 'login-code',
    phoneCode: 'phone-code',
    audience: 'user-api',
    legalConsent: {
      userAgreementVersion: LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
      privacyPolicyVersion: LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
    },
  } satisfies WechatMiniProgramPhoneLoginRequest;
  const input = {
    recipientName: '张三',
    phoneNumber: '13800000000',
    provinceName: '北京市',
    cityName: '北京市',
    countyName: '西城区',
    streetName: '太平街',
    detailInfo: '甲6号',
    postalCode: '100000',
    nationalCode: '110102',
  } satisfies CreateUserAddressRequest;
  const address = {
    id: 'address-1',
    ...input,
    isDefault: true,
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  } satisfies UserAddress;
  const profile = {
    nickname: '零点用户',
    avatar_data_url: null,
  } satisfies CustomerProfile;
  const deliveryAddress: OrderSummaryContract['delivery_address'] =
    '张三 13800000000 北京市北京市西城区太平街甲6号';

  return { login, address, profile, deliveryAddress };
}
