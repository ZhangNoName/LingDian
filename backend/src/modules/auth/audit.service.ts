import { Injectable } from '@nestjs/common';
import { Prisma } from '@lingdian/db';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export type AuthAuditInput = {
  event: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  device?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type AuditContext = Pick<AuthAuditInput, 'ip' | 'device'>;

type AuditClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuthAuditInput, client: AuditClient = this.prisma): Promise<void> {
    await client.authAuditLog.create({
      data: {
        event: input.event,
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.ip ? { ip: maskIp(input.ip) } : {}),
        ...(input.device ? { device: maskDevice(input.device) } : {}),
        ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async count(
    event: string,
    filter: { ip?: string; device?: string },
    since: Date,
    client: AuditClient = this.prisma,
  ): Promise<number> {
    return client.authAuditLog.count({
      where: {
        event,
        ...(filter.ip ? { ip: maskIp(filter.ip) } : {}),
        ...(filter.device ? { device: maskDevice(filter.device) } : {}),
        createdAt: { gte: since },
      },
    });
  }
}

function maskIp(ip: string): string {
  if (ip.includes('.')) return ip.replace(/\.\d+$/, '.***');
  return ip.length <= 8 ? '***' : `${ip.slice(0, 6)}***`;
}

function maskDevice(device: string): string {
  return `device:${createHash('sha256').update(device).digest('hex').slice(0, 16)}`;
}
