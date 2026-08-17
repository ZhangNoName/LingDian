# 小程序协议确认与登录页优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为零点点餐小程序生成完整的《用户服务协议》和《隐私政策》，要求用户在登录前明确同意，并由服务端校验协议版本、持久化同意记录，同时优化登录页视觉层级。

**Architecture:** 协议版本和登录请求契约由 `@lingdian/contracts` 共享；后端通过独立 `LegalConsentService` 校验当前版本并写入 `user_legal_consents`，只对 `user-api` 登录生效。小程序使用集中式协议数据和通用阅读组件渲染两份本地协议，登录页通过一个可测试的同意守卫拦截短信、微信和第三方登录，并把当前版本随最终登录请求提交。

**Tech Stack:** Vue 3、uni-app、TypeScript、Vitest、NestJS 11、class-validator、Prisma 7、MySQL、Node test runner、pnpm 11。

## Global Constraints

- 运营主体名称固定为“开封市示范区赵美红小吃店”。
- 当前协议版本均固定为 `2026-08-17`。
- 正式发布前仍需补充统一社会信用代码、注册地址、客服电话/邮箱、投诉渠道、实际第三方服务商和真实数据保存期限；开发版正文使用明确的“正式发布前补充”提示，不虚构信息。
- 只有 `audience=user-api` 的消费者登录要求协议确认；管理员与商家登录不受影响。
- 未勾选协议时不得触发获取验证码、微信原生手机号授权、第三方授权或最终登录请求。
- 不新增协议 CMS，不改变订单、支付、配送、退款或令牌策略。
- 微信小程序后台的《用户隐私保护指引》仍需运营方单独配置，应用内协议不能替代平台配置。
- 正式协议上线前必须由运营方核验实际处理活动并完成法律审核。

---

## File Structure

- `packages/contracts/src/auth.ts`：共享当前协议版本、`LegalConsentInput` 和用户登录请求类型。
- `packages/db/prisma/schema.prisma`：定义协议类型枚举、用户同意记录及用户关系。
- `packages/db/prisma/migrations/20260817_user_legal_consents/migration.sql`：创建同意记录表、索引和外键。
- `packages/db/src/index.ts`：导出生成后的 Prisma 协议类型。
- `backend/src/modules/auth/legal-consent.service.ts`：唯一负责版本校验和幂等写入同意记录。
- `backend/src/modules/auth/legal-consent.service.spec.ts`：验证版本拒绝、管理员豁免和两份记录写入。
- `backend/src/modules/auth/dto/legal-consent.dto.ts`：嵌套请求校验。
- `backend/src/modules/auth/dto/complete-oauth-login.dto.ts`：区分“第三方登录完成”和“已登录账号绑定”，避免后者被消费者协议误伤。
- `backend/src/modules/auth/auth.service.ts`、`oauth.service.ts`、`auth.controller.ts`、`auth.module.ts`：把协议校验和写入接入三条消费者登录路径。
- `backend/src/modules/auth/auth.service.spec.ts`、`oauth.service.spec.ts`：覆盖服务端登录路径。
- `uniapp/src/legal/legal-documents.ts`：运营主体、版本、发布日期和两份完整协议正文的单一来源。
- `uniapp/src/legal/legal-consent.ts`：生成当前登录提交值并提供未同意错误类型。
- `uniapp/src/legal/legal-documents.spec.ts`、`legal-consent.spec.ts`：验证协议内容和守卫。
- `uniapp/src/components/legal/LegalDocumentPage.vue`：通用协议阅读页面。
- `uniapp/src/pages/legal/user-agreement.vue`、`privacy-policy.vue`：两份协议页面入口。
- `uniapp/src/pages.json`：注册协议页面。
- `uniapp/src/services/auth.ts`、`auth.spec.ts`：把协议版本加入最终登录请求。
- `uniapp/src/pages/auth/login.vue`：协议勾选、四类操作拦截、协议跳转和视觉优化。
- `uniapp/tests/miniapp-layout.test.mjs`：静态验证小程序页面注册、协议链接和原生微信授权门槛。
- `docs/03-frontend-uniapp.md`：记录协议运营信息和微信后台隐私配置要求。

---

### Task 1: 共享协议契约、数据库模型与记录服务

**Files:**
- Modify: `packages/contracts/src/auth.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260817_user_legal_consents/migration.sql`
- Modify: `packages/db/src/index.ts`
- Create: `backend/src/modules/auth/legal-consent.service.ts`
- Create: `backend/src/modules/auth/legal-consent.service.spec.ts`
- Modify: `backend/src/modules/auth/auth.module.ts`

**Interfaces:**
- Produces: `LEGAL_DOCUMENT_VERSIONS`, `LegalConsentInput`, `LegalConsentService.assertCurrentForAudience(audience, input)` and `LegalConsentService.record(userId, input, context, client?)`.
- Consumes: Prisma `userLegalConsent.createMany`, `AuthRequestContext` 的 `ip` 与 `deviceId`。

- [ ] **Step 1: 写失败的协议服务测试**

在 `backend/src/modules/auth/legal-consent.service.spec.ts` 覆盖：消费者缺失协议时拒绝、错误版本拒绝、`admin-api` 缺失协议时通过、正确版本写入两条记录、重复记录依赖 `skipDuplicates` 幂等。

```ts
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { LEGAL_DOCUMENT_VERSIONS } from '@lingdian/contracts';
import { LegalConsentService } from './legal-consent.service';

const consent = {
  userAgreementVersion: LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
  privacyPolicyVersion: LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
};

test('requires current legal versions for user-api logins', () => {
  const service = new LegalConsentService({} as never);
  assert.throws(() => service.assertCurrentForAudience('user-api', undefined), /agreement/i);
  assert.throws(
    () => service.assertCurrentForAudience('user-api', { ...consent, privacyPolicyVersion: 'old' }),
    /update/i,
  );
  assert.doesNotThrow(() => service.assertCurrentForAudience('admin-api', undefined));
});

test('records both current legal documents idempotently', async () => {
  const calls: unknown[] = [];
  const client = { userLegalConsent: { createMany: async (input: unknown) => { calls.push(input); return { count: 2 }; } } };
  const service = new LegalConsentService(client as never);

  await service.record('user-1', consent, { ip: '127.0.0.1', deviceId: 'miniapp' });

  assert.equal(calls.length, 1);
  assert.deepEqual((calls[0] as { skipDuplicates: boolean }).skipDuplicates, true);
  assert.deepEqual(
    (calls[0] as { data: Array<{ documentType: string; version: string }> }).data.map((item) => [item.documentType, item.version]),
    [
      ['USER_AGREEMENT', '2026-08-17'],
      ['PRIVACY_POLICY', '2026-08-17'],
    ],
  );
});
```

- [ ] **Step 2: 运行测试并确认按预期失败**

Run: `corepack pnpm --filter @lingdian/api test -- legal-consent.service.spec.ts`

Expected: FAIL，错误指向 `Cannot find module './legal-consent.service'`。

- [ ] **Step 3: 增加共享契约和 Prisma 模型**

在 `packages/contracts/src/auth.ts` 导出：

```ts
export const LEGAL_DOCUMENT_VERSIONS = {
  USER_AGREEMENT: '2026-08-17',
  PRIVACY_POLICY: '2026-08-17',
} as const;

export interface LegalConsentInput {
  userAgreementVersion: string;
  privacyPolicyVersion: string;
}
```

将 `PhoneLoginRequest` 增加 `legalConsent?: LegalConsentInput`，将 `WechatMiniProgramPhoneLoginRequest` 增加必填 `legalConsent: LegalConsentInput`，并新增：

```ts
export interface CompleteOAuthLoginRequest {
  pendingOauthId: string;
  phone: string;
  code: string;
  legalConsent: LegalConsentInput;
}
```

在 Prisma schema 增加：

```prisma
enum LegalDocumentType {
  USER_AGREEMENT
  PRIVACY_POLICY
}

model UserLegalConsent {
  id           String            @id @default(cuid())
  userId       String
  documentType LegalDocumentType
  version      String            @db.VarChar(32)
  acceptedAt   DateTime          @default(now())
  ip           String?           @db.VarChar(64)
  device       String?           @db.VarChar(191)
  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, documentType, version])
  @@index([userId, acceptedAt])
  @@map("user_legal_consents")
}
```

在 `User` 增加 `legalConsents UserLegalConsent[]`，在 `packages/db/src/index.ts` 导出 `LegalDocumentType` 和 `UserLegalConsent`。

迁移 SQL 使用以下结构创建 `user_legal_consents`、唯一索引、时间索引和指向 `users(id)` 的级联外键：

```sql
CREATE TABLE `user_legal_consents` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `documentType` ENUM('USER_AGREEMENT', 'PRIVACY_POLICY') NOT NULL,
  `version` VARCHAR(32) NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip` VARCHAR(64) NULL,
  `device` VARCHAR(191) NULL,
  UNIQUE INDEX `user_legal_consents_userId_documentType_version_key` (`userId`, `documentType`, `version`),
  INDEX `user_legal_consents_userId_acceptedAt_idx` (`userId`, `acceptedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `user_legal_consents_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

- [ ] **Step 4: 实现协议校验与记录服务**

`backend/src/modules/auth/legal-consent.service.ts` 的核心实现：

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from '@lingdian/contracts';
import type { Prisma } from '@lingdian/db';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthRequestContext } from './auth.service';

type ConsentClient = Pick<PrismaService, 'userLegalConsent'> | Prisma.TransactionClient;

@Injectable()
export class LegalConsentService {
  constructor(private readonly prisma: PrismaService) {}

  assertCurrentForAudience(audience: string, input?: LegalConsentInput): asserts input is LegalConsentInput {
    if (audience !== 'user-api') return;
    if (!input) throw new BadRequestException('Please accept the current user agreement and privacy policy.');
    if (
      input.userAgreementVersion !== LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT ||
      input.privacyPolicyVersion !== LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY
    ) {
      throw new BadRequestException('Legal agreement version is outdated. Please update the mini program.');
    }
  }

  async record(userId: string, input: LegalConsentInput, context: AuthRequestContext, client: ConsentClient = this.prisma) {
    await client.userLegalConsent.createMany({
      data: [
        { userId, documentType: 'USER_AGREEMENT', version: input.userAgreementVersion, ip: context.ip, device: context.deviceId },
        { userId, documentType: 'PRIVACY_POLICY', version: input.privacyPolicyVersion, ip: context.ip, device: context.deviceId },
      ],
      skipDuplicates: true,
    });
  }
}
```

在 `AuthModule` 注册并导出 `LegalConsentService`。

- [ ] **Step 5: 生成 Prisma Client 并运行单元测试和类型构建**

Run: `corepack pnpm --filter @lingdian/db prisma:format && corepack pnpm --filter @lingdian/db prisma:generate && corepack pnpm --filter @lingdian/contracts build && corepack pnpm --filter @lingdian/db build && corepack pnpm --filter @lingdian/api test -- legal-consent.service.spec.ts`

Expected: Prisma schema 格式化成功，contracts/db 构建通过，协议服务测试全部 PASS。

- [ ] **Step 6: 提交任务 1**

```bash
git add packages/contracts/src/auth.ts packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260817_user_legal_consents/migration.sql packages/db/src/index.ts backend/src/modules/auth/legal-consent.service.ts backend/src/modules/auth/legal-consent.service.spec.ts backend/src/modules/auth/auth.module.ts
git commit -m "功能：增加用户协议版本与同意记录"
```

---

### Task 2: 在全部消费者登录路径强制协议版本

**Files:**
- Create: `backend/src/modules/auth/dto/legal-consent.dto.ts`
- Create: `backend/src/modules/auth/dto/complete-oauth-login.dto.ts`
- Modify: `backend/src/modules/auth/dto/phone-login.dto.ts`
- Modify: `backend/src/modules/auth/dto/wechat-mini-program-phone-login.dto.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Modify: `backend/src/modules/auth/oauth.service.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/auth.service.spec.ts`
- Modify: `backend/src/modules/auth/oauth.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 的 `LegalConsentService`、`LegalConsentInput` 和 `LEGAL_DOCUMENT_VERSIONS`。
- Produces: 对 `/auth/phone/login`、`/auth/wechat/miniapp/phone-login`、`/auth/oauth/link-phone` 的服务端强制校验与记录。

- [ ] **Step 1: 写失败的手机号登录测试**

在 `auth.service.spec.ts` 增加两个测试：

```ts
test('rejects user-api phone login before consuming a code when legal consent is missing', async () => {
  let consumed = false;
  const service = new AuthService(
    {} as never,
    { consume: async () => { consumed = true; } } as never,
    {} as never,
    undefined,
    {
      assertCurrentForAudience: () => { throw new Error('legal agreement required'); },
      record: async () => undefined,
    } as never,
  );

  await assert.rejects(
    () => service.phoneLogin({ phone: '13800000000', code: '123456', audience: 'user-api' }, { deviceId: 'miniapp' }),
    /agreement required/i,
  );
  assert.equal(consumed, false);
});

test('records current consent in the phone-user transaction before issuing a session', async () => {
  const events: string[] = [];
  const currentConsent = { userAgreementVersion: '2026-08-17', privacyPolicyVersion: '2026-08-17' };
  const user = {
    id: 'user-1', status: 'ACTIVE' as const, sessionVersion: 1,
    roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }],
  };
  let transactionClient: unknown;
  const service = new AuthService(
    {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) => {
        const tx = { authIdentity: { findUnique: async () => { events.push('lookup'); return { user }; } } };
        transactionClient = tx;
        return operation(tx);
      },
    } as never,
    { consume: async () => { events.push('consume'); } } as never,
    {
      create: async () => {
        events.push('session');
        return { accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, user: { sessionId: 'session-1' } };
      },
    } as never,
    undefined,
    {
      assertCurrentForAudience: () => { events.push('validate'); },
      record: async (_userId: string, _input: unknown, _context: unknown, client: unknown) => {
        assert.equal(client, transactionClient);
        events.push('consent');
      },
    } as never,
  );

  await service.phoneLogin(
    { phone: '13800000000', code: '123456', audience: 'user-api', legalConsent: currentConsent },
    { deviceId: 'miniapp', ip: '127.0.0.1' },
  );

  assert.deepEqual(events, ['validate', 'consume', 'lookup', 'consent', 'session']);
});
```

同时把既有 `user-api` 测试请求补上当前 `legalConsent`；`admin-api` 测试保持不传，用于证明管理员豁免。

- [ ] **Step 2: 写失败的微信和 OAuth 完成测试**

在 `oauth.service.spec.ts` 增加：

```ts
test('validates and records consent during WeChat phone login', async () => {
  const events: string[] = [];
  const currentConsent = { userAgreementVersion: '2026-08-17', privacyPolicyVersion: '2026-08-17' };
  const user = {
    id: 'user-1', status: 'ACTIVE' as const, sessionVersion: 1,
    roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }],
  };
  let transactionClient: unknown;
  const provider = {
    provider: 'WECHAT', appId: 'wx-app', miniProgramAppId: 'mini-wx-app', redirectUri: 'https://client',
    buildAuthorizationUrl: () => '',
    exchange: async () => ({ openId: 'openid' }),
    exchangeMiniProgramCode: async () => { events.push('wechat-code'); return { openId: 'openid', unionId: 'unionid' }; },
    exchangeMiniProgramPhoneCode: async () => { events.push('phone-code'); return { phoneNumber: '13800000000' }; },
  };
  const service = new OAuthService(
    {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          authIdentity: {
            findUnique: async ({ where }: any) => where.provider_subject.provider === 'PHONE' ? { userId: user.id, user } : { userId: user.id },
            create: async () => undefined,
          },
        };
        transactionClient = tx;
        return operation(tx);
      },
    } as never,
    [provider] as never,
    { consume: async () => undefined } as never,
    { record: async () => undefined } as never,
    'test-refresh-pepper',
    {
      assertCurrentForAudience: () => { events.push('validate'); },
      record: async (userId: string, _input: unknown, context: any, client: unknown) => {
        assert.equal(userId, 'user-1');
        assert.equal(context.ip, '127.0.0.1');
        assert.equal(context.deviceId, 'miniapp');
        assert.equal(client, transactionClient);
        events.push('consent');
      },
    } as never,
  );

  await service.miniProgramPhoneLogin({
    loginCode: 'login-code', phoneCode: 'phone-code', audience: 'user-api',
    legalConsent: currentConsent, ip: '127.0.0.1', device: 'miniapp',
  });

  assert.equal(events[0], 'validate');
  assert.ok(events.includes('consent'));
});

test('records consent in the pending OAuth phone-link transaction', async () => {
  const currentConsent = { userAgreementVersion: '2026-08-17', privacyPolicyVersion: '2026-08-17' };
  const user = {
    id: 'user-1', status: 'ACTIVE' as const, sessionVersion: 1,
    roles: [{ role: 'USER' as const, status: 'ACTIVE' as const }],
  };
  let transactionClient: unknown;
  let recorded = false;
  const service = new OAuthService(
    {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          pendingOAuth: {
            findFirst: async () => ({ id: 'pending-1', provider: 'QQ', subject: 'qq:openid', expiresAt: new Date(Date.now() + 60_000) }),
            updateMany: async () => ({ count: 1 }),
          },
          authIdentity: {
            findUnique: async ({ where }: any) => where.provider_subject.provider === 'PHONE'
              ? { userId: user.id, user }
              : { userId: user.id },
            create: async () => undefined,
          },
        };
        transactionClient = tx;
        return operation(tx);
      },
    } as never,
    [] as never,
    { consume: async () => undefined } as never,
    { record: async () => undefined } as never,
    'test-refresh-pepper',
    {
      assertCurrentForAudience: () => undefined,
      record: async (userId: string, _input: unknown, _context: unknown, client: unknown) => {
        assert.equal(userId, 'user-1');
        assert.equal(client, transactionClient);
        recorded = true;
      },
    } as never,
  );

  await service.linkPhone({
    pendingOauthId: 'pending-1', phone: '13800000000', code: '123456',
    legalConsent: currentConsent, ip: '127.0.0.1', device: 'miniapp',
  });

  assert.equal(recorded, true);
});
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `corepack pnpm --filter @lingdian/api test -- auth.service.spec.ts oauth.service.spec.ts`

Expected: FAIL，原因是服务构造器、请求类型和登录流程尚未接入 `LegalConsentService`。

- [ ] **Step 4: 实现 DTO 校验**

`legal-consent.dto.ts`：

```ts
import { IsIn } from 'class-validator';
import { LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from '@lingdian/contracts';

export class LegalConsentDto implements LegalConsentInput {
  @IsIn([LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT])
  userAgreementVersion!: string;

  @IsIn([LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY])
  privacyPolicyVersion!: string;
}
```

`PhoneLoginDto` 对 `audience === 'user-api'` 使用 `@ValidateIf`、`@IsDefined`、`@ValidateNested` 和 `@Type(() => LegalConsentDto)` 要求 `legalConsent`；`admin-api` 可缺省。微信 DTO 和 `CompleteOAuthLoginDto` 直接要求嵌套 `legalConsent`。

保持现有 `LinkPhoneDto` 不带消费者协议字段，继续供已登录用户绑定身份使用；仅 `/oauth/link-phone` 改用 `CompleteOAuthLoginDto`。

- [ ] **Step 5: 把校验和记录接入 AuthService**

为 `AuthService` 注入 `LegalConsentService`。`phoneLogin` 的第一步调用：

```ts
this.legalConsent.assertCurrentForAudience(input.audience, input.legalConsent);
```

把当前同意值和请求上下文传入 `findOrCreatePhoneUser`。在 serializable transaction 中解析/创建用户后调用：

```ts
if (audience === 'user-api') {
  await this.legalConsent.record(user.id, legalConsent, context, tx);
}
```

唯一键竞争回退到已有用户时，也在返回用户前通过 `this.prisma` 幂等补写同意记录。成功审计元数据增加 `userAgreementVersion` 与 `privacyPolicyVersion`，不记录协议正文。

- [ ] **Step 6: 把校验和记录接入 OAuthService 与控制器**

为 `OAuthService` 注入 `LegalConsentService`：

- `miniProgramPhoneLogin` 在调用微信 provider 前校验；在创建/解析用户和绑定微信身份的 transaction 内记录两份同意。
- `linkPhone` 接收 `legalConsent`、`ip`、`device`；在消费验证码和 pending identity 的 transaction 内记录两份同意。
- `bindPendingIdentity` 是登录后账号管理能力，不要求消费者重新同意。

控制器把 `request.ip` 和 `deviceId(request)` 传给 `linkPhone`；微信路径已有相同上下文。

- [ ] **Step 7: 运行后端测试与构建**

Run: `corepack pnpm --filter @lingdian/api test -- auth.service.spec.ts oauth.service.spec.ts legal-consent.service.spec.ts && corepack pnpm --filter @lingdian/api build`

Expected: 目标测试全部 PASS，NestJS TypeScript 构建通过。

- [ ] **Step 8: 提交任务 2**

```bash
git add backend/src/modules/auth/dto/legal-consent.dto.ts backend/src/modules/auth/dto/complete-oauth-login.dto.ts backend/src/modules/auth/dto/phone-login.dto.ts backend/src/modules/auth/dto/wechat-mini-program-phone-login.dto.ts backend/src/modules/auth/auth.service.ts backend/src/modules/auth/oauth.service.ts backend/src/modules/auth/auth.controller.ts backend/src/modules/auth/auth.service.spec.ts backend/src/modules/auth/oauth.service.spec.ts
git commit -m "功能：登录时校验并记录协议同意"
```

---

### Task 3: 生成两份完整协议和小程序阅读页面

**Files:**
- Create: `uniapp/src/legal/legal-documents.ts`
- Create: `uniapp/src/legal/legal-documents.spec.ts`
- Create: `uniapp/src/components/legal/LegalDocumentPage.vue`
- Create: `uniapp/src/pages/legal/user-agreement.vue`
- Create: `uniapp/src/pages/legal/privacy-policy.vue`
- Modify: `uniapp/src/pages.json`
- Modify: `uniapp/tests/miniapp-layout.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `LEGAL_DOCUMENT_VERSIONS`。
- Produces: `LEGAL_OPERATOR_NAME`、`userAgreementDocument`、`privacyPolicyDocument` 和两个固定页面路由。

- [ ] **Step 1: 写失败的协议内容测试**

`legal-documents.spec.ts` 至少断言：

```ts
import { describe, expect, it } from 'vitest';
import { privacyPolicyDocument, userAgreementDocument } from './legal-documents';

describe('legal documents', () => {
  it('identifies the operator and current versions', () => {
    expect(userAgreementDocument.operatorName).toBe('开封市示范区赵美红小吃店');
    expect(userAgreementDocument.version).toBe('2026-08-17');
    expect(privacyPolicyDocument.version).toBe('2026-08-17');
  });

  it('covers ordering terms and customer remedies', () => {
    const titles = userAgreementDocument.sections.map((section) => section.title);
    expect(titles).toEqual(expect.arrayContaining(['订单、价格与支付', '取消、退款与售后', '争议解决与联系我们']));
  });

  it('describes every personal-information category used by the current product', () => {
    const text = privacyPolicyDocument.sections.flatMap((section) => section.paragraphs).join('\n');
    for (const item of ['手机号', '微信身份', '头像', '昵称', '收货地址', '订单信息', '设备与日志']) {
      expect(text).toContain(item);
    }
  });
});
```

在 `miniapp-layout.test.mjs` 断言 `pages.json` 注册两个法律页面，并且薄页面均使用 `LegalDocumentPage`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `corepack pnpm --filter @lingdian/uniapp test -- legal-documents.spec.ts && node --test uniapp/tests/miniapp-layout.test.mjs`

Expected: FAIL，原因是协议数据和页面尚不存在。

- [ ] **Step 3: 编写协议数据结构和完整正文**

`legal-documents.ts` 定义：

```ts
export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  version: string;
  effectiveDate: string;
  operatorName: string;
  introduction: string[];
  sections: LegalSection[];
}

export const LEGAL_OPERATOR_NAME = '开封市示范区赵美红小吃店';
```

《用户服务协议》逐节写入：接受与主体、服务范围、账户安全、商品信息、订单价格与支付、取消退款与售后、堂食/自取/配送、用户行为、知识产权、服务变更与中断、责任边界、未成年人、终止与注销、争议解决和联系。

《隐私政策》逐节写入：处理者、收集与用途、敏感信息、权限与拒绝影响、第三方/受托处理、存储期限、用户权利、注销删除、安全事件、未成年人、更新与联系。明确：

- 验证码和微信动态 code 只用于完成对应认证；
- 手机号、地址和订单配送信息按实现服务所需处理；
- 拒绝微信手机号授权后仍可使用短信登录；
- 拒绝地址授权后仍可使用门店自取；
- 不把协议同意扩张为营销同意；
- 统一社会信用代码、注册地址、客服电话/邮箱、第三方服务商名称和具体保存期限显示“【正式发布前补充】”。

- [ ] **Step 4: 实现通用阅读组件和薄页面**

`LegalDocumentPage.vue` 接收 `document: LegalDocument`，使用 `scroll-view` 渲染标题、版本、主体、引言、章节、列表和底部提示。样式使用现有小程序 token：浅暖灰背景、白色正文卡片、`32rpx` 标题、`28rpx` 章节标题、`26rpx` 正文、`1.75` 行高，并保留顶部状态栏和底部安全区。

两个页面只负责导入对应文档：

```vue
<template><LegalDocumentPage :document="userAgreementDocument" /></template>
<script setup lang="ts">
import LegalDocumentPage from '@/components/legal/LegalDocumentPage.vue';
import { userAgreementDocument } from '@/legal/legal-documents';
</script>
```

在 `pages.json` 注册：

- `/pages/legal/user-agreement`，标题“用户服务协议”；
- `/pages/legal/privacy-policy`，标题“隐私政策”。

- [ ] **Step 5: 运行协议测试和微信构建**

Run: `corepack pnpm --filter @lingdian/uniapp test -- legal-documents.spec.ts && node --test uniapp/tests/miniapp-layout.test.mjs && corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: 测试全部 PASS，生成 `uniapp/dist/build/mp-weixin`，协议页面无 WXSS 不支持警告。

- [ ] **Step 6: 提交任务 3**

```bash
git add uniapp/src/legal/legal-documents.ts uniapp/src/legal/legal-documents.spec.ts uniapp/src/components/legal/LegalDocumentPage.vue uniapp/src/pages/legal/user-agreement.vue uniapp/src/pages/legal/privacy-policy.vue uniapp/src/pages.json uniapp/tests/miniapp-layout.test.mjs
git commit -m "功能：增加用户协议与隐私政策页面"
```

---

### Task 4: 登录页协议门槛、请求参数与视觉优化

**Files:**
- Create: `uniapp/src/legal/legal-consent.ts`
- Create: `uniapp/src/legal/legal-consent.spec.ts`
- Modify: `uniapp/src/services/auth.ts`
- Modify: `uniapp/src/services/auth.spec.ts`
- Modify: `uniapp/src/pages/auth/login.vue`
- Modify: `uniapp/tests/miniapp-layout.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `LegalConsentInput`/版本常量与 Task 3 的两条页面路由。
- Produces: `requireLegalConsent(accepted): LegalConsentInput`，以及登录页全部用户登录动作的统一门槛。

- [ ] **Step 1: 写失败的同意守卫和请求负载测试**

`legal-consent.spec.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { LegalConsentRequiredError, requireLegalConsent } from './legal-consent';

describe('requireLegalConsent', () => {
  it('rejects an unchecked login', () => {
    expect(() => requireLegalConsent(false)).toThrow(LegalConsentRequiredError);
  });

  it('returns both current versions after explicit consent', () => {
    expect(requireLegalConsent(true)).toEqual({
      userAgreementVersion: '2026-08-17',
      privacyPolicyVersion: '2026-08-17',
    });
  });
});
```

修改 `auth.spec.ts` 中手机号、微信和 OAuth 完成测试，向调用传入 `legalConsent`，并断言请求 data 包含同一个嵌套对象。验证码发送负载保持不变。

在 `miniapp-layout.test.mjs` 增加静态断言：登录页包含两个协议路由、checkbox 状态、未勾选普通微信按钮和勾选后的 `open-type="getPhoneNumber"` 分支。

- [ ] **Step 2: 运行测试并确认失败**

Run: `corepack pnpm --filter @lingdian/uniapp test -- legal-consent.spec.ts auth.spec.ts && node --test uniapp/tests/miniapp-layout.test.mjs`

Expected: FAIL，原因是守卫不存在且 auth 方法尚未接收 `legalConsent`。

- [ ] **Step 3: 实现同意守卫与登录请求参数**

`legal-consent.ts`：

```ts
import { LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from '@lingdian/contracts';

export class LegalConsentRequiredError extends Error {
  constructor() {
    super('请先阅读并同意《用户服务协议》和《隐私政策》');
    this.name = 'LegalConsentRequiredError';
  }
}

export function requireLegalConsent(accepted: boolean): LegalConsentInput {
  if (!accepted) throw new LegalConsentRequiredError();
  return {
    userAgreementVersion: LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
    privacyPolicyVersion: LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
  };
}
```

调整 `customerAuth.phoneLogin`、`wechatPhoneLogin` 和 `completePhoneLink` 的签名，把 `legalConsent` 作为必填末参数，并将其放入请求 `data.legalConsent`。

- [ ] **Step 4: 把同意门槛接入登录页全部动作**

增加 `const legalAccepted = ref(false)` 与：

```ts
function acceptedLegalConsent() {
  try {
    return requireLegalConsent(legalAccepted.value);
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '请先同意相关协议', icon: 'none' });
    return undefined;
  }
}
```

`sendCode`、`submit`、`beginThirdPartyLogin` 和 `wechatPhoneLogin` 均把这段检查放在任何网络/API 调用前。对于微信原生授权，模板使用两个互斥按钮：

```vue
<button v-if="legalAccepted" open-type="getPhoneNumber" @getphonenumber="wechatPhoneLogin">微信手机号快捷登录</button>
<button v-else @tap="showConsentRequired">微信手机号快捷登录</button>
```

这样未勾选时不会弹出微信手机号授权面板。协议链接分别调用：

```ts
uni.navigateTo({ url: '/pages/legal/user-agreement' });
uni.navigateTo({ url: '/pages/legal/privacy-policy' });
```

- [ ] **Step 5: 完成登录页视觉优化**

在不改变认证文案语义的前提下：

- 内容壳层从垂直正中改为略偏上，缩小大面积顶部空白；
- 标题调整到约 `40rpx`、`800`，副标题约 `25rpx`；
- 表单卡片改为 `24rpx` 内边距、`20rpx` 圆角、细边框和更轻阴影；
- 输入框和按钮统一约 `88rpx` 高、`16rpx` 圆角；
- 微信入口使用白底、浅边框、深色文字，并保留一个小型微信绿状态点作为平台识别，不再使用整块绿色；
- 品牌红仅用于最终登录按钮、聚焦线和协议链接；
- 协议行放在提交按钮上方，checkbox 点击区域不小于 `44px` 等效范围；
- 验证码按钮维持浅红底，主按钮维持品牌红；
- 使用现有小程序 token，不新增依赖和位图素材。

- [ ] **Step 6: 运行前端测试、类型检查和微信构建**

Run: `corepack pnpm --filter @lingdian/uniapp test -- legal-consent.spec.ts auth.spec.ts && node --test uniapp/tests/miniapp-layout.test.mjs && corepack pnpm --filter @lingdian/uniapp type-check && corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: 全部测试 PASS，类型检查通过，微信小程序构建成功。

- [ ] **Step 7: 提交任务 4**

```bash
git add uniapp/src/legal/legal-consent.ts uniapp/src/legal/legal-consent.spec.ts uniapp/src/services/auth.ts uniapp/src/services/auth.spec.ts uniapp/src/pages/auth/login.vue uniapp/tests/miniapp-layout.test.mjs
git commit -m "功能：登录前确认协议并优化页面视觉"
```

---

### Task 5: 文档、全量验证与开发预览

**Files:**
- Modify: `docs/03-frontend-uniapp.md`

**Interfaces:**
- Consumes: 前四个任务的协议版本、运营信息缺口、迁移和小程序页面。
- Produces: 可执行的上线检查清单和微信开发者工具预览目录。

- [ ] **Step 1: 更新运营和上线文档**

在 `docs/03-frontend-uniapp.md` 增加：

- 当前运营主体“开封市示范区赵美红小吃店”；
- 两份协议版本 `2026-08-17`；
- `20260817_user_legal_consents` 迁移必须部署；
- 正式发布前必须补齐的六类运营信息；
- 微信小程序后台隐私指引必须与手机号、微信身份、头像昵称、地址和订单用途一致；
- 开发者工具不能替代真机授权与隐私弹窗验收；
- 协议版本变化后必须同步更新客户端常量、服务端常量、正文版本和发布日期。

- [ ] **Step 2: 运行全量验证**

Run: `corepack pnpm --filter @lingdian/contracts build && corepack pnpm --filter @lingdian/db build && corepack pnpm --filter @lingdian/api test && corepack pnpm --filter @lingdian/api build && corepack pnpm --filter @lingdian/uniapp test && corepack pnpm --filter @lingdian/uniapp type-check && corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: contracts/db/API/uniapp 全部构建成功，后端和小程序测试全部 PASS。

- [ ] **Step 3: 检查改动质量和数据库迁移**

Run: `git diff --check && rg -n "正式发布前补充|开封市示范区赵美红小吃店|2026-08-17" uniapp/src/legal docs/03-frontend-uniapp.md && rg -n "^(<<<<<<<|=======|>>>>>>>)" packages backend uniapp docs --glob '!**/dist/**'`

Expected: `git diff --check` 无输出；运营主体和版本出现在预期文件；无冲突标记。

- [ ] **Step 4: 提交文档**

```bash
git add docs/03-frontend-uniapp.md
git commit -m "文档：补充小程序协议上线检查"
```

- [ ] **Step 5: 启动微信小程序开发预览**

Run: `corepack pnpm --filter @lingdian/uniapp dev:mp-weixin`

Expected: 输出 `DONE Build complete. Watching for changes...`，微信开发者工具导入目录为 `uniapp/dist/dev/mp-weixin`。手工检查登录页、两份协议页面、返回状态、未勾选拦截和勾选后的微信授权入口。
