import type { CompleteOAuthLoginRequest } from '@lingdian/contracts';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { LegalConsentDto } from './legal-consent.dto';
import { LinkPhoneDto } from './link-phone.dto';

export class CompleteOAuthLoginDto extends LinkPhoneDto implements CompleteOAuthLoginRequest {
  @IsDefined()
  @ValidateNested()
  @Type(() => LegalConsentDto)
  legalConsent!: LegalConsentDto;
}
