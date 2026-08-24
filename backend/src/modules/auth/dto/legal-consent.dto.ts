import { LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from '@lingdian/contracts';
import { IsIn } from 'class-validator';

export class LegalConsentDto implements LegalConsentInput {
  @IsIn([LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT])
  userAgreementVersion!: string;

  @IsIn([LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY])
  privacyPolicyVersion!: string;
}
