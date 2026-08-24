import { Injectable } from '@nestjs/common';
import { LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from '@lingdian/contracts';
import type { Prisma } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthRequestContext } from './auth.service';
import { LegalConsentUpdateRequiredException } from '../../common/exceptions/app.exception';

type ConsentClient = Pick<PrismaService, 'userLegalConsent'> | Prisma.TransactionClient;

@Injectable()
export class LegalConsentService {
  constructor(private readonly prisma: PrismaService) {}

  assertCurrentForAudience(audience: string, input?: LegalConsentInput): asserts input is LegalConsentInput {
    if (audience !== 'user-api') return;
    if (!input) throw new LegalConsentUpdateRequiredException();
    if (
      input.userAgreementVersion !== LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT ||
      input.privacyPolicyVersion !== LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY
    ) {
      throw new LegalConsentUpdateRequiredException();
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
