import type { CreateUserAddressRequest, UpdateUserAddressRequest } from '@lingdian/contracts';
import { IsISO8601, IsMobilePhone, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAddressDto implements CreateUserAddressRequest {
  @IsString() @IsNotEmpty() @MaxLength(64) recipientName!: string;
  @IsString() @IsMobilePhone('zh-CN') @MaxLength(32) phoneNumber!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) provinceName!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) cityName!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) countyName!: string;
  @IsString() @MaxLength(128) streetName!: string;
  @IsString() @IsNotEmpty() @MaxLength(255) detailInfo!: string;
  @IsString() @MaxLength(16) postalCode!: string;
  @IsString() @MaxLength(16) nationalCode!: string;
}

export class UpdateAddressDto extends CreateAddressDto implements UpdateUserAddressRequest {
  @IsISO8601({ strict: true, strictSeparator: true })
  @MaxLength(32)
  expectedUpdatedAt!: string;
}
