import { Injectable } from '@nestjs/common';
import { MOBILE_LEGAL_DOCUMENT_VERSIONS, SUPPORTED_LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from '@lingdian/contracts';
import type { Prisma } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthRequestContext } from './auth-request-context';
import { LegalConsentUpdateRequiredException } from '../../common/exceptions/app.exception';

type ConsentClient = Pick<PrismaService, 'userLegalConsent'> | Prisma.TransactionClient;

@Injectable()
export class LegalConsentService {
  constructor(private readonly prisma: PrismaService) {}

  assertCurrentForAudience(audience: string, input?: LegalConsentInput, channel: 'mobile' | 'miniapp' = 'miniapp'): asserts input is LegalConsentInput {
    if (audience !== 'user-api') return;
    const published = channel === 'mobile' ? [MOBILE_LEGAL_DOCUMENT_VERSIONS] : SUPPORTED_LEGAL_DOCUMENT_VERSIONS;
    const supported = input && published.some((versions) =>
      input.userAgreementVersion === versions.USER_AGREEMENT &&
      input.privacyPolicyVersion === versions.PRIVACY_POLICY,
    );
    if (!supported) {
      throw new LegalConsentUpdateRequiredException(channel === 'mobile' ? '请更新零点 App 后重试' : undefined);
    }
  }

  async record(
    userId: string,
    input: LegalConsentInput,
    context: AuthRequestContext,
    client: ConsentClient = this.prisma,
  ) {
    await client.userLegalConsent.createMany({
      data: [
        {
          userId,
          documentType: 'USER_AGREEMENT',
          version: input.userAgreementVersion,
          ip: context.ip,
          device: context.deviceId,
        },
        {
          userId,
          documentType: 'PRIVACY_POLICY',
          version: input.privacyPolicyVersion,
          ip: context.ip,
          device: context.deviceId,
        },
      ],
      skipDuplicates: true,
    });
  }
}
