import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { AuditService } from './audit.service';
import { normalizeChinesePhone } from './phone';
import { SmsProvider } from './providers/sms-provider';
import { VerificationService } from './verification.service';

process.env.NODE_ENV = 'test';

type CodeRecord = {
  id: string;
  purpose: string;
  targetHash: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

type AuditRecord = {
  event: string;
  ip?: string;
  device?: string;
  metadata?: unknown;
  createdAt: Date;
};

type FakePrisma = {
  verificationCode: {
    count: (input: { where: Record<string, unknown> }) => Promise<number>;
    findFirst: (input: { where: Record<string, unknown>; orderBy?: { createdAt: 'asc' | 'desc' } }) => Promise<CodeRecord | null>;
    create: (input: { data: Omit<CodeRecord, 'id' | 'createdAt' | 'consumedAt'> }) => Promise<CodeRecord>;
    updateMany: (input: { data: { consumedAt: Date }; where: Record<string, unknown> }) => Promise<{ count: number }>;
  };
  authAuditLog: {
    count: (input: { where: Record<string, unknown> }) => Promise<number>;
    create: (input: { data: Omit<AuditRecord, 'createdAt'> }) => Promise<AuditRecord>;
  };
  $transaction: <T>(operation: (tx: FakePrisma) => Promise<T>) => Promise<T>;
};

function createService(options: { transactionErrors?: Error[]; sendError?: Error } = {}) {
  const codes: CodeRecord[] = [];
  const audits: AuditRecord[] = [];
  const sent: Array<{ phoneE164: string; code: string }> = [];
  const transactionErrors = [...(options.transactionErrors ?? [])];
  let transactionAttempts = 0;

  let transactionQueue = Promise.resolve();
  const prisma: FakePrisma = {
    verificationCode: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        codes.filter((code) => {
          const createdAt = where.createdAt as { gte?: Date } | undefined;
          const expiresAt = where.expiresAt as { gt?: Date } | undefined;
          return (
            (!where.purpose || code.purpose === where.purpose) &&
            (!where.targetHash || code.targetHash === where.targetHash) &&
            (where.consumedAt !== null || code.consumedAt === null) &&
            (!createdAt?.gte || code.createdAt >= createdAt.gte) &&
            (!expiresAt?.gt || code.expiresAt > expiresAt.gt)
          );
        }).length,
      findFirst: async ({ where, orderBy }) => {
        const expiresAt = where.expiresAt as { gt?: Date } | undefined;
        const matches = codes.filter(
          (code) =>
            code.purpose === where.purpose &&
            code.targetHash === where.targetHash &&
            code.codeHash === where.codeHash &&
            code.consumedAt === null &&
            (!expiresAt?.gt || code.expiresAt > expiresAt.gt),
        );
        matches.sort((left, right) =>
          orderBy?.createdAt === 'asc'
            ? left.createdAt.getTime() - right.createdAt.getTime()
            : right.createdAt.getTime() - left.createdAt.getTime(),
        );
        return matches[0] ?? null;
      },
      create: async ({ data }: { data: Omit<CodeRecord, 'id' | 'createdAt' | 'consumedAt'> }) => {
        const code = {
          id: `code-${codes.length + 1}`,
          createdAt: new Date(),
          consumedAt: null,
          ...data,
        };
        codes.push(code);
        return code;
      },
      updateMany: async ({ data, where }: { data: { consumedAt: Date }; where: Record<string, unknown> }) => {
        const expiresAt = where.expiresAt as { gt?: Date } | undefined;
        const matches = codes.filter(
          (code) =>
            (!where.id || code.id === where.id) &&
            (!where.purpose || code.purpose === where.purpose) &&
            (!where.targetHash || code.targetHash === where.targetHash) &&
            (!where.codeHash || code.codeHash === where.codeHash) &&
            code.consumedAt === null &&
            (!expiresAt?.gt || code.expiresAt > expiresAt.gt),
        );
        for (const matched of matches) matched.consumedAt = data.consumedAt;
        return { count: matches.length };
      },
    },
    authAuditLog: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        const createdAt = where.createdAt as { gte?: Date } | undefined;
        return audits.filter(
          (audit) =>
            audit.event === where.event &&
            (!where.ip || audit.ip === where.ip) &&
            (!where.device || audit.device === where.device) &&
            (!createdAt?.gte || audit.createdAt >= createdAt.gte),
        ).length;
      },
      create: async ({ data }: { data: Omit<AuditRecord, 'createdAt'> }) => {
        const audit = { ...data, createdAt: new Date() };
        audits.push(audit);
        return audit;
      },
    },
    $transaction: async <T>(operation: (tx: FakePrisma) => Promise<T>) => {
      transactionAttempts += 1;
      const transactionError = transactionErrors.shift();
      if (transactionError) throw transactionError;
      let release!: () => void;
      const previous = transactionQueue;
      transactionQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation(prisma);
      } finally {
        release();
      }
    },
  };

  const service = new VerificationService(
    prisma as never,
    { send: async (input: Parameters<SmsProvider['send']>[0]) => {
      sent.push(input);
      if (options.sendError) throw options.sendError;
      return { messageId: `sms-${sent.length}` };
    } },
    new AuditService(prisma as never),
    'test-refresh-pepper',
  );

  return { audits, codes, sent, service, transactionAttempts: () => transactionAttempts };
}

test('normalizes a mainland Chinese mobile number to E.164', () => {
  assert.equal(normalizeChinesePhone('13800000000'), '+8613800000000');
  assert.equal(normalizeChinesePhone('+8613800000000'), '+8613800000000');
  assert.throws(() => normalizeChinesePhone('1550000000'), /mainland Chinese mobile/i);
});

test('consumes a code exactly once', async () => {
  const { service } = createService();
  const issued = await service.issue({
    purpose: 'PHONE_LOGIN',
    phone: '13800000000',
    ip: '127.0.0.1',
    deviceId: 'd1',
  });
  await service.consume({ purpose: 'PHONE_LOGIN', phone: '+8613800000000', code: issued.testCode! });
  await assert.rejects(
    () => service.consume({ purpose: 'PHONE_LOGIN', phone: '+8613800000000', code: issued.testCode! }),
    /invalid or expired/i,
  );
});

test('rate limits a phone after three active verification codes', async () => {
  const { service } = createService();
  const input = { purpose: 'PHONE_LOGIN' as const, phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' };

  await service.issue(input);
  await service.issue(input);
  await service.issue(input);

  await assert.rejects(() => service.issue(input), /too many verification codes/i);
});

test('atomically limits concurrent phone code reservations to three', async () => {
  const { codes, service } = createService();
  const input = { purpose: 'PHONE_LOGIN' as const, phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' };
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => service.issue(input)));

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 3);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(codes.length, 3);
});

test('retries a Prisma write conflict while reserving a verification code', async () => {
  const writeConflict = Object.assign(new Error('write conflict'), { code: 'P2034' });
  const { sent, service, transactionAttempts } = createService({ transactionErrors: [writeConflict] });

  await service.issue({ purpose: 'PHONE_LOGIN', phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' });

  assert.equal(transactionAttempts(), 2);
  assert.equal(sent.length, 1);
});

test('rethrows an exhausted Prisma write conflict after the capped retries', async () => {
  const conflicts = [
    Object.assign(new Error('write conflict 1'), { code: 'P2034' }),
    Object.assign(new Error('write conflict 2'), { code: 'P2034' }),
    Object.assign(new Error('write conflict 3'), { code: 'P2034' }),
  ];
  const { service, transactionAttempts } = createService({ transactionErrors: conflicts });

  await assert.rejects(
    () => service.issue({ purpose: 'PHONE_LOGIN', phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' }),
    (error: unknown) => error === conflicts[2],
  );
  assert.equal(transactionAttempts(), 3);
});

test('invalidates a reserved verification code when the SMS provider fails', async () => {
  const gatewayError = new Error('SMS gateway unavailable');
  const { codes, service } = createService({ sendError: gatewayError });

  await assert.rejects(
    () => service.issue({ purpose: 'PHONE_LOGIN', phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' }),
    (error: unknown) => error === gatewayError,
  );

  assert.equal(codes.length, 1);
  assert.ok(codes[0].consumedAt instanceof Date);
});

test('rate limits the same IP after ten reservations per hour', async () => {
  const { service } = createService();
  for (let i = 0; i < 10; i += 1) {
    await service.issue({ purpose: 'PHONE_LOGIN', phone: `1380000000${i}`, ip: '127.0.0.1', deviceId: `d${i}` });
  }

  await assert.rejects(
    () => service.issue({ purpose: 'PHONE_LOGIN', phone: '13800000010', ip: '127.0.0.1', deviceId: 'd10' }),
    /too many verification codes/i,
  );
});

test('rate limits the same device after eight reservations per hour', async () => {
  const { service } = createService();
  for (let i = 0; i < 8; i += 1) {
    await service.issue({ purpose: 'PHONE_LOGIN', phone: `1390000000${i}`, ip: `127.0.0.${i + 1}`, deviceId: 'd1' });
  }

  await assert.rejects(
    () => service.issue({ purpose: 'PHONE_LOGIN', phone: '13900000008', ip: '127.0.0.9', deviceId: 'd1' }),
    /too many verification codes/i,
  );
});

test('stores only an HMAC code hash with a five-minute expiry', async () => {
  const { codes, sent, service } = createService();
  const startedAt = Date.now();
  await service.issue({ purpose: 'PHONE_LOGIN', phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' });

  assert.equal(codes.length, 1);
  assert.equal(codes[0].codeHash, createHmac('sha256', 'test-refresh-pepper')
    .update(`PHONE_LOGIN:+8613800000000:${sent[0].code}`)
    .digest('hex'));
  assert.notEqual(codes[0].codeHash, sent[0].code);
  assert.ok(codes[0].expiresAt.getTime() >= startedAt + 5 * 60 * 1000);
  assert.ok(codes[0].expiresAt.getTime() <= Date.now() + 5 * 60 * 1000);
});

test('does not return a plaintext code outside test mode', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const { sent, service } = createService();
    const issued = await service.issue({ purpose: 'PHONE_LOGIN', phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' });
    assert.equal('testCode' in issued, false);
    assert.equal(sent[0].code.length, 6);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('consumes only one issuance when duplicate code hashes exist', async () => {
  const { codes, service } = createService();
  const issued = await service.issue({ purpose: 'PHONE_LOGIN', phone: '13800000000', ip: '127.0.0.1', deviceId: 'd1' });
  const original = codes[0];
  codes.push({ ...original, id: 'code-collision', createdAt: new Date(original.createdAt.getTime() + 1) });

  await service.consume({ purpose: 'PHONE_LOGIN', phone: '13800000000', code: issued.testCode! });

  assert.equal(codes.filter((code) => code.consumedAt !== null).length, 1);
  assert.equal(codes.find((code) => code.id === 'code-collision')?.consumedAt !== null, true);
});

test('audits verification outcomes without storing the code or full phone in metadata', async () => {
  const { audits, service } = createService();
  const issued = await service.issue({
    purpose: 'PHONE_LOGIN',
    phone: '13800000000',
    ip: '127.0.0.1',
    deviceId: 'device-1234',
  });
  await service.consume({ purpose: 'PHONE_LOGIN', phone: '13800000000', code: issued.testCode! });
  await assert.rejects(
    () => service.consume({ purpose: 'PHONE_LOGIN', phone: '13800000000', code: issued.testCode! }),
    /invalid or expired/i,
  );

  assert.deepEqual(audits.map((audit) => audit.event), [
    'CODE_RESERVATION',
    'CODE_SENT',
    'CODE_CONSUMED',
    'CODE_REJECTED',
  ]);
  assert.doesNotMatch(JSON.stringify(audits), /13800000000|\b\d{6}\b/);
});
