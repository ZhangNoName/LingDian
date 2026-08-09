import type { CreateUserAddressRequest } from '@lingdian/contracts';
import { IsMobilePhone, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
