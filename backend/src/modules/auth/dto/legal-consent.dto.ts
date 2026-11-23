import { SUPPORTED_LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from '@lingdian/contracts';
import { IsIn } from 'class-validator';

export class LegalConsentDto implements LegalConsentInput {
  @IsIn(SUPPORTED_LEGAL_DOCUMENT_VERSIONS.map((versions) => versions.USER_AGREEMENT))
  userAgreementVersion!: string;

  @IsIn(SUPPORTED_LEGAL_DOCUMENT_VERSIONS.map((versions) => versions.PRIVACY_POLICY))
  privacyPolicyVersion!: string;
}
