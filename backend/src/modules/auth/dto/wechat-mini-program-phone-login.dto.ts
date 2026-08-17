import type { WechatMiniProgramPhoneLoginRequest } from '@lingdian/contracts';
import { Type } from 'class-transformer';
import { IsDefined, IsIn, IsString, Length, ValidateNested } from 'class-validator';
import { LegalConsentDto } from './legal-consent.dto';

export class WechatMiniProgramPhoneLoginDto implements WechatMiniProgramPhoneLoginRequest {
  @IsString()
  @Length(1, 2048)
  loginCode!: string;

  @IsString()
  @Length(1, 2048)
  phoneCode!: string;

  @IsIn(['user-api'])
  audience!: 'user-api';

  @IsDefined()
  @ValidateNested()
  @Type(() => LegalConsentDto)
  legalConsent!: LegalConsentDto;
}
