import type { LegalConsentInput, WechatMiniProgramPhoneLoginRequest } from '@lingdian/contracts';
import { IsIn, IsString, Length } from 'class-validator';

export class WechatMiniProgramPhoneLoginDto implements WechatMiniProgramPhoneLoginRequest {
  @IsString()
  @Length(1, 2048)
  loginCode!: string;

  @IsString()
  @Length(1, 2048)
  phoneCode!: string;

  @IsIn(['user-api'])
  audience!: 'user-api';

  legalConsent!: LegalConsentInput;
}
