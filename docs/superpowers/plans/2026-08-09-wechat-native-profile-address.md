# WeChat Native Profile and Address Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WeChat phone-number login, persistent nickname/avatar data, WeChat address import and management, and delivery checkout with immutable address snapshots.

**Architecture:** Extend the shared contracts and Prisma schema first, then keep WeChat credential exchange inside `WechatOAuthProvider`, identity merging inside `OAuthService`, profile/address invariants in focused services, and delivery validation inside `OrdersService`. The uni-app client wraps each native capability in testable services, while pages only coordinate user gestures, loading, empty states, and navigation.

**Tech Stack:** pnpm 11.7.0 via Corepack, TypeScript, uni-app/Vue 3, Vitest, NestJS 11, Node test runner, Prisma 7, MariaDB.

## Global Constraints

- Use the project-declared `pnpm@11.7.0` through `corepack pnpm`.
- Never send the WeChat AppSecret, access token, openid, unionid, or raw WeChat error response to the mini-app.
- Keep SMS login and pickup checkout working when users decline WeChat permissions.
- Use `button open-type="getPhoneNumber"`, `button open-type="chooseAvatar"`, `input type="nickname"`, and user-triggered `uni.chooseAddress`.
- Accept avatar MIME types `image/jpeg`, `image/png`, and `image/webp`, with a maximum size of 512 KiB.
- Limit each user to 20 saved addresses; exactly one address is default whenever the user has at least one address.
- A `takeout` order requires an owned address ID and stores a delivery-address snapshot; a `pickup` order does not require an address.

---

### Task 1: Shared contracts and database schema

**Files:**
- Create: `packages/contracts/src/wechat-profile-address.contract.spec.ts`
- Modify: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/order.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260809_wechat_profile_addresses/migration.sql`

**Interfaces:**
- Produces: `WechatMiniProgramPhoneLoginRequest`, `CustomerProfile`, `UserAddress`, `CreateUserAddressRequest`.
- Produces: `OrderSummaryContract.delivery_address: string | null`.
- Produces: Prisma fields `User.avatarData`, `User.avatarMimeType`, `User.addresses`, `Order.deliveryAddress`, and model `UserAddress`.

- [ ] **Step 1: Add a contract compile test that imports and constructs every new type**

Create `packages/contracts/src/wechat-profile-address.contract.spec.ts` with values that exercise exact snake/camel naming:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CustomerProfile, CreateUserAddressRequest, UserAddress, WechatMiniProgramPhoneLoginRequest } from './auth';
import type { OrderSummaryContract } from './order';

test('wechat profile, address, and delivery contracts remain constructible', () => {
  const login: WechatMiniProgramPhoneLoginRequest = { loginCode: 'login-code', phoneCode: 'phone-code', audience: 'user-api' };
  const input: CreateUserAddressRequest = { recipientName: '张三', phoneNumber: '13800000000', provinceName: '北京市', cityName: '北京市', countyName: '西城区', streetName: '太平街', detailInfo: '甲6号', postalCode: '100000', nationalCode: '110102' };
  const address: UserAddress = { id: 'address-1', ...input, isDefault: true, createdAt: '2026-08-09T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z' };
  const profile: CustomerProfile = { nickname: '零点用户', avatar_data_url: null };
  const order = { delivery_address: '张三 13800000000 北京市北京市西城区太平街甲6号' } as OrderSummaryContract;
  assert.equal(login.audience, 'user-api');
  assert.equal(address.isDefault, true);
  assert.equal(profile.nickname, '零点用户');
  assert.ok(order.delivery_address);
});
```

- [ ] **Step 2: Run the new contract test and confirm it fails to compile because the types do not exist**

Run: `corepack pnpm --filter @lingdian/contracts build`

Expected: TypeScript reports missing exported members.

- [ ] **Step 3: Add the exact contracts and Prisma models**

Add the request/response interfaces to `auth.ts`, make `delivery_address` nullable in `order.ts`, add the schema fields/models, and create SQL that adds the avatar/order columns plus `user_addresses` with foreign key, `user_id/is_default`, and `user_id/updated_at` indexes.

- [ ] **Step 4: Format/generate Prisma and rerun contract verification**

Run: `corepack pnpm --filter @lingdian/db prisma:format && corepack pnpm --filter @lingdian/db prisma:generate && corepack pnpm --filter @lingdian/contracts build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit the schema and contracts**

```powershell
git add packages/contracts packages/db/prisma
git commit -m "feat: add customer profile and address contracts"
```

### Task 2: WeChat phone-code exchange provider

**Files:**
- Modify: `backend/src/modules/auth/providers/oauth-provider.ts`
- Modify: `backend/src/modules/auth/providers/wechat-oauth.provider.ts`
- Create: `backend/src/modules/auth/providers/wechat-oauth.provider.spec.ts`

**Interfaces:**
- Produces: `WechatOAuthProvider.exchangeMiniProgramPhoneCode({ code }): Promise<{ phoneNumber: string }>`.
- Produces: in-process stable-access-token cache with a five-minute expiry margin and one forced refresh retry for invalid-token errors.

- [ ] **Step 1: Write failing provider tests**

Test that two phone-code exchanges reuse one stable token, the phone endpoint receives the dynamic code, and WeChat error payloads become a sanitized `Error('WeChat phone number exchange failed.')` without secrets.

- [ ] **Step 2: Run the provider test and confirm the missing method failure**

Run: `corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/auth/providers/wechat-oauth.provider.spec.ts`

Expected: FAIL because `exchangeMiniProgramPhoneCode` is undefined.

- [ ] **Step 3: Implement stable token and phone exchange**

Use `POST https://api.weixin.qq.com/cgi-bin/stable_token` with `{ grant_type: 'client_credential', appid, secret, force_refresh }`, then `POST https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=...` with `{ code }`. Cache only the token and expiry timestamp, never the phone code or response.

- [ ] **Step 4: Run the provider test**

Run: `corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/auth/providers/wechat-oauth.provider.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/modules/auth/providers
git commit -m "feat: exchange wechat phone authorization codes"
```

### Task 3: Atomic WeChat phone login

**Files:**
- Create: `backend/src/modules/auth/dto/wechat-mini-program-phone-login.dto.ts`
- Modify: `backend/src/modules/auth/oauth.service.ts`
- Modify: `backend/src/modules/auth/oauth.service.spec.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/auth.e2e.spec.ts`

**Interfaces:**
- Consumes: provider methods `exchangeMiniProgramCode` and `exchangeMiniProgramPhoneCode`.
- Produces: `OAuthService.miniProgramPhoneLogin(input): Promise<OAuthUser>`.
- Produces: `POST /auth/wechat/miniapp/phone-login` returning existing `AuthTokens` and refresh cookie.

- [ ] **Step 1: Write failing service tests for new user, existing phone user, and conflicting WeChat identity**

Assert that the transaction creates exactly one phone identity and one WeChat identity, reuses the phone user when present, and throws `ConflictException` when the WeChat subject belongs to a different user.

- [ ] **Step 2: Run the focused OAuth tests and confirm failure**

Run: `corepack pnpm --filter @lingdian/api test:oauth`

Expected: FAIL because `miniProgramPhoneLogin` is missing.

- [ ] **Step 3: Implement the transaction**

Exchange both codes, normalize the returned Chinese phone number, derive the existing WeChat subject rule (`unionId` else `<miniAppId>:<openId>`), find-or-create the phone user, link the WeChat identity through the existing conflict-safe helper, and audit success/rejection without logging identifiers.

- [ ] **Step 4: Add the DTO/controller endpoint and an e2e test**

The e2e test posts `{ loginCode: 'login-code', phoneCode: 'phone-code', audience: 'user-api' }`, expects HTTP 201, response data with `access_token`, and a `refresh_token` cookie.

- [ ] **Step 5: Run OAuth and auth e2e tests**

Run: `corepack pnpm --filter @lingdian/api test:oauth && corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/auth/auth.e2e.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/modules/auth
git commit -m "feat: add wechat phone quick login"
```

### Task 4: Persistent profile and avatar

**Files:**
- Modify: `backend/src/modules/auth/profile.service.ts`
- Modify: `backend/src/modules/auth/profile.service.spec.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/auth.module.ts`

**Interfaces:**
- Produces: `ProfileService.get(userId): Promise<CustomerProfile>`.
- Produces: `ProfileService.setAvatar(userId, file): Promise<CustomerProfile>` with 512 KiB and MIME validation.
- Produces: guarded `GET /auth/profile` and multipart `POST /auth/profile/avatar` (`avatar` field).

- [ ] **Step 1: Write failing profile tests**

Test an unset avatar returns `null`, a valid PNG becomes `data:image/png;base64,...`, a 524289-byte image is rejected, and `text/plain` is rejected.

- [ ] **Step 2: Run and confirm failure**

Run: `corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/auth/profile.service.spec.ts`

Expected: FAIL on missing `get`/`setAvatar`.

- [ ] **Step 3: Implement profile retrieval/avatar storage and controller upload**

Use `FileInterceptor('avatar', { limits: { fileSize: 524288 } })`, memory storage, and the service MIME allowlist. Keep the existing nickname endpoint behavior.

- [ ] **Step 4: Run profile tests and API build**

Run: `corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/auth/profile.service.spec.ts && corepack pnpm --filter @lingdian/api build`

Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/modules/auth
git commit -m "feat: persist customer profile avatars"
```

### Task 5: Address service and guarded API

**Files:**
- Create: `backend/src/modules/addresses/addresses.module.ts`
- Create: `backend/src/modules/addresses/addresses.controller.ts`
- Create: `backend/src/modules/addresses/addresses.service.ts`
- Create: `backend/src/modules/addresses/addresses.service.spec.ts`
- Create: `backend/src/modules/addresses/dto/create-address.dto.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `AddressesService.list`, `create`, `setDefault`, `remove`, and `findOwnedAddress`.
- Produces: authenticated user routes `GET/POST /addresses`, `PATCH /addresses/:id/default`, and `DELETE /addresses/:id`.

- [ ] **Step 1: Write failing address invariant tests**

Cover first-address defaulting, exact duplicate reuse, 21st-address rejection, atomic default switching, non-owner not-found behavior, and default reassignment after delete.

- [ ] **Step 2: Run the test and confirm missing service failure**

Run: `corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/addresses/addresses.service.spec.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement DTO, service, controller, and module**

Normalize all strings with `trim`, validate Chinese mobile numbers and maximum field lengths, use serializable transactions for default switching/deletion, always include `userId` in address lookups, and sort default first then `updatedAt desc`.

- [ ] **Step 4: Run focused test and API build**

Run: `corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/addresses/addresses.service.spec.ts && corepack pnpm --filter @lingdian/api build`

Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/modules/addresses backend/src/app.module.ts
git commit -m "feat: add customer address management"
```

### Task 6: Delivery address snapshot in orders

**Files:**
- Modify: `backend/src/modules/orders/dto/create-order.dto.ts`
- Modify: `backend/src/modules/orders/orders.service.ts`
- Modify: `backend/src/modules/orders/orders.service.spec.ts`
- Modify: `backend/src/modules/orders/orders.module.ts`

**Interfaces:**
- Consumes: `AddressesService.findOwnedAddress(userId, addressId)`.
- Produces: `CreateOrderDto.addressId?: string` and mapped `delivery_address`.

- [ ] **Step 1: Write failing order tests**

Add tests proving `pickup` needs no address, `takeout` without `addressId` fails, an unowned address fails, and an owned address supplies recipient/mobile plus a stable `deliveryAddress` snapshot to `tx.order.create`.

- [ ] **Step 2: Run the focused order test and confirm failure**

Run: `corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/orders/orders.service.spec.ts`

Expected: FAIL because delivery address validation is absent.

- [ ] **Step 3: Implement address resolution and snapshot mapping**

Resolve the address before order creation only for `takeout`, format the snapshot as `<recipient> <phone> <province><city><county><street><detail>`, and include `delivery_address` in summary/detail contract mapping.

- [ ] **Step 4: Run order tests and API build**

Run: `corepack pnpm --filter @lingdian/api exec node --require ts-node/register --test src/modules/orders/orders.service.spec.ts && corepack pnpm --filter @lingdian/api build`

Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/modules/orders
git commit -m "feat: snapshot delivery addresses on orders"
```

### Task 7: Mini-app native adapters and API clients

**Files:**
- Modify: `uniapp/tests/setup-uni.ts`
- Modify: `uniapp/src/services/auth.ts`
- Modify: `uniapp/src/services/auth.spec.ts`
- Modify: `uniapp/src/services/profile.ts`
- Modify: `uniapp/src/services/profile.spec.ts`
- Create: `uniapp/src/services/addresses.ts`
- Create: `uniapp/src/services/addresses.spec.ts`
- Create: `uniapp/src/services/wechat-capabilities.ts`
- Create: `uniapp/src/services/wechat-capabilities.spec.ts`

**Interfaces:**
- Produces: `customerAuth.wechatPhoneLogin(phoneCode)`.
- Produces: `profile.get()` and `profile.uploadAvatar(tempFilePath)`.
- Produces: address CRUD client and `chooseWechatAddress(): Promise<{ status: 'selected'; address } | { status: 'cancelled' }>`.

- [ ] **Step 1: Write failing service tests**

Assert separate phone/login codes are sent to the new endpoint; choose-address results map every field; `chooseAddress:fail cancel` returns `cancelled`; non-cancel failures reject; authenticated address requests use the expected methods and paths.

- [ ] **Step 2: Run tests and confirm missing API failures**

Run: `corepack pnpm --filter @lingdian/uniapp test -- src/services/auth.spec.ts src/services/profile.spec.ts src/services/addresses.spec.ts src/services/wechat-capabilities.spec.ts`

Expected: FAIL on missing exports.

- [ ] **Step 3: Implement the clients and adapters**

Keep native callback parsing in `wechat-capabilities.ts`; pass credentials to the existing authenticated request layer; parse `uni.uploadFile` JSON envelopes and retry a 401 only through the existing refresh policy.

- [ ] **Step 4: Rerun focused tests**

Run: `corepack pnpm --filter @lingdian/uniapp test -- src/services/auth.spec.ts src/services/profile.spec.ts src/services/addresses.spec.ts src/services/wechat-capabilities.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add uniapp/tests uniapp/src/services
git commit -m "feat: wrap wechat profile and address capabilities"
```

### Task 8: Login, profile, and address pages

**Files:**
- Modify: `uniapp/src/pages/auth/login.vue`
- Modify: `uniapp/src/pages/user/user.vue`
- Modify: `uniapp/src/components/profile/ProfileHeader.vue`
- Create: `uniapp/src/pages/address/address.vue`
- Modify: `uniapp/src/pages.json`
- Modify: `uniapp/src/types/member.ts`

**Interfaces:**
- Consumes: Task 7 clients/adapters.
- Produces: user-triggered WeChat quick login, nickname/avatar editing, and address import/default/delete UI.

- [ ] **Step 1: Add source-level behavior tests to `uniapp/tests/miniapp-layout.test.mjs`**

Assert login contains `open-type="getPhoneNumber"`, profile contains `open-type="chooseAvatar"` and `type="nickname"`, address page calls the adapter rather than `wx` directly, and `pages.json` registers `pages/address/address`.

- [ ] **Step 2: Run the layout test and confirm failure**

Run: `corepack pnpm --filter @lingdian/uniapp exec node --test tests/miniapp-layout.test.mjs`

Expected: FAIL because the new controls/page are absent.

- [ ] **Step 3: Implement the three page flows**

Use one loading flag per mutation, do not toast on native cancellation, navigate the enabled address tile to `/pages/address/address`, and refresh profile/address state in `onShow` after authentication.

- [ ] **Step 4: Run layout test, unit tests, and type check**

Run: `corepack pnpm --filter @lingdian/uniapp exec node --test tests/miniapp-layout.test.mjs && corepack pnpm --filter @lingdian/uniapp test && corepack pnpm --filter @lingdian/uniapp type-check`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```powershell
git add uniapp/src/pages uniapp/src/components/profile uniapp/src/pages.json uniapp/src/types/member.ts uniapp/tests
git commit -m "feat: add wechat profile and address interactions"
```

### Task 9: Pickup/delivery checkout

**Files:**
- Modify: `uniapp/src/components/checkout/CheckoutStoreCard.vue`
- Create: `uniapp/src/components/checkout/CheckoutAddressCard.vue`
- Modify: `uniapp/src/pages/checkout/checkout.vue`
- Modify: `uniapp/src/services/checkout-state.ts`
- Modify: `uniapp/src/services/checkout-state.spec.ts`
- Modify: `uniapp/src/services/orders.ts`
- Modify: `uniapp/src/services/orders.spec.ts`
- Modify: `uniapp/src/types/order.ts`

**Interfaces:**
- Produces: `canSubmitCheckout({ itemCount, serviceMode, addressId })`.
- Produces: `createOrderFromCart(cart, { serviceMode, addressId })` mapping pickup/takeout correctly.

- [ ] **Step 1: Write failing checkout/order tests**

Assert an empty cart always fails, pickup with items succeeds without address, delivery without address fails, delivery with address succeeds, and the request uses `{ orderType: 'takeout', addressId }` without clearing the cart on request failure.

- [ ] **Step 2: Run and confirm failure**

Run: `corepack pnpm --filter @lingdian/uniapp test -- src/services/checkout-state.spec.ts src/services/orders.spec.ts`

Expected: FAIL on missing service-mode behavior.

- [ ] **Step 3: Implement checkout state, request mapping, and UI**

Default to pickup, show the address card only for delivery, load the default address on show, route missing-address users to address management, and keep submit enabled only when `canSubmitCheckout` is true.

- [ ] **Step 4: Run focused and full mini-app verification**

Run: `corepack pnpm --filter @lingdian/uniapp test && corepack pnpm --filter @lingdian/uniapp type-check && corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```powershell
git add uniapp/src/components/checkout uniapp/src/pages/checkout uniapp/src/services uniapp/src/types/order.ts
git commit -m "feat: support delivery checkout with saved addresses"
```

### Task 10: Final regression and operational handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/03-frontend-uniapp.md`

**Interfaces:**
- Produces: setup notes for `WECHAT_MINI_APP_ID`, `WECHAT_MINI_APP_SECRET`, database migration, privacy declaration, and WeChat developer-tool smoke tests.

- [ ] **Step 1: Document required environment and privacy console configuration**

State that production must apply the Prisma migration, configure the mini-app AppID/secret only on the API, declare nickname/avatar/phone/address purposes in the WeChat privacy guide, and test with a real developer/experience account because native authorization is not fully emulated by Vitest.

- [ ] **Step 2: Run the complete fresh verification suite**

Run: `corepack pnpm --filter @lingdian/contracts build && corepack pnpm --filter @lingdian/db build && corepack pnpm --filter @lingdian/api test && corepack pnpm --filter @lingdian/api build && corepack pnpm --filter @lingdian/uniapp test && corepack pnpm --filter @lingdian/uniapp type-check && corepack pnpm --filter @lingdian/uniapp build:mp-weixin`

Expected: every command exits 0 with zero failing tests.

- [ ] **Step 3: Inspect the final diff and migration**

Run: `git diff --check HEAD~9..HEAD && git status --short`

Expected: no whitespace errors; only intentional documentation edits remain before the final commit.

- [ ] **Step 4: Commit documentation**

```powershell
git add README.md docs/03-frontend-uniapp.md
git commit -m "docs: explain wechat customer capability setup"
```
