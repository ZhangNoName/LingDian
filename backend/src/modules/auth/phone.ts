import { BadRequestException } from '@nestjs/common';

const MAINLAND_CHINESE_MOBILE = /^1[3-9]\d{9}$/;
const MAINLAND_CHINESE_E164 = /^\+861[3-9]\d{9}$/;

export function normalizeChinesePhone(phone: string): string {
  if (MAINLAND_CHINESE_MOBILE.test(phone)) {
    return `+86${phone}`;
  }

  if (MAINLAND_CHINESE_E164.test(phone)) {
    return phone;
  }

  throw new BadRequestException('A mainland Chinese mobile number is required.');
}
