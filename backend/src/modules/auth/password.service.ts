import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditContext, AuditService } from './audit.service';

const SCRYPT_PARAMETERS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SALT_BYTES = 16;
const HASH_BYTES = 64;

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async hash(password: string): Promise<string> {
    this.assertPasswordLength(password);
    const salt = randomBytes(SALT_BYTES);
    const hash = await this.derive(password, salt);
    return `scrypt$32768$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const parsed = parseEncodedHash(encodedHash);
    if (!parsed) return false;

    const candidate = await this.derive(password, parsed.salt);
    return candidate.length === parsed.hash.length && timingSafeEqual(candidate, parsed.hash);
  }

  async replace(identityId: string, newPassword: string, userId: string, context: AuditContext = {}): Promise<void> {
    const passwordHash = await this.hash(newPassword);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordCredential.update({
        where: { identityId },
        data: { passwordHash, passwordChangedAt: now },
      });
      await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
      await tx.authSession.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', activeDeviceKey: null, revokedAt: now },
      });
      await this.audit.record({ event: 'PASSWORD_CHANGED', userId, ip: context.ip, device: context.device }, tx);
    });
  }

  private async derive(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scryptCallback(password, salt, HASH_BYTES, SCRYPT_PARAMETERS, (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      });
    });
  }

  private assertPasswordLength(password: string): void {
    if (password.length < 12) throw new BadRequestException('Password must be at least 12 characters long.');
  }
}

type ParsedHash = { salt: Buffer; hash: Buffer };

function parseEncodedHash(encodedHash: string): ParsedHash | null {
  const fields = encodedHash.split('$');
  if (
    fields.length !== 6 ||
    fields[0] !== 'scrypt' ||
    fields[1] !== '32768' ||
    fields[2] !== '8' ||
    fields[3] !== '1' ||
    !/^[A-Za-z0-9_-]+$/.test(fields[4]) ||
    !/^[A-Za-z0-9_-]+$/.test(fields[5])
  ) return null;

  const salt = Buffer.from(fields[4], 'base64url');
  const hash = Buffer.from(fields[5], 'base64url');
  if (
    salt.length !== SALT_BYTES ||
    hash.length !== HASH_BYTES ||
    salt.toString('base64url') !== fields[4] ||
    hash.toString('base64url') !== fields[5]
  ) return null;

  return { salt, hash };
}
