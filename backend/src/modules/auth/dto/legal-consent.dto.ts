import { MOBILE_LEGAL_DOCUMENT_VERSIONS, SUPPORTED_LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from '@lingdian/contracts';
import { IsIn } from 'class-validator';

const documentVersions = [...SUPPORTED_LEGAL_DOCUMENT_VERSIONS, MOBILE_LEGAL_DOCUMENT_VERSIONS];

export class LegalConsentDto implements LegalConsentInput {
  @IsIn(documentVersions.map((versions) => versions.USER_AGREEMENT))
  userAgreementVersion!: string;

  @IsIn(documentVersions.map((versions) => versions.PRIVACY_POLICY))
  privacyPolicyVersion!: string;
}
