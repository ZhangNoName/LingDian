# 小程序法律同意最终修复报告

日期：2026-08-17

## 结论

四项 Important finding 均已修复，未削弱已批准设计。消费者登录缺失或使用过期法律版本时，后端 DTO/控制器路径统一返回稳定错误码 `2004` 与消息“请更新小程序后重试”，uniapp 优先按错误码映射并兼容旧英文消息。手机号登录、微信手机号快捷登录、待完成 OAuth 手机绑定均把同意、会话和成功审计纳入同一个 Prisma 数据库事务；禁用用户在同意写入前被拒绝，任一同意或会话写入失败都会回滚整个本地登录结果。

## Finding 逐项处理

### 1. 稳定且可识别的法律版本错误契约

- 在现有 `RES_CODE` 约定中新增 `LEGAL_CONSENT_UPDATE_REQUIRED = 2004`，并补充元数据。
- 新增 `LegalConsentUpdateRequiredException`，固定 HTTP 400、业务码 `2004`、消息“请更新小程序后重试”。缺失和过期版本均使用同一异常。
- 新增全局验证异常工厂，递归识别 DTO 的 `legalConsent` 字段错误，避免 `@IsDefined`/`@IsIn` 先返回通用参数错误。其他 DTO 验证仍维持原 `PARAM_INVALID` 行为。
- HTTP 测试通过真实 Nest 控制器、DTO、全局 `ValidationPipe` 和 `AllExceptionsFilter` 验证完整响应包络：`{ code: 2004, msg: "请更新小程序后重试", data: null }`。
- HTTP 覆盖旧手机号客户端缺失同意、微信快捷登录提交过期版本、旧 pending OAuth 客户端缺失同意，并确认 Auth/OAuth 服务均未被调用。因此手机号验证码消费和微信 provider 换码都不会发生。
- uniapp 将响应包络的 `code` 与 `msg` 一并交给认证消息映射。错误码优先；旧后端的两类英文法律错误保留兼容回退，不再坍缩为通用登录失败。

### 2. 登录成功边界与同意/会话一致性

调查确认 `AuthSession`、`UserLegalConsent` 和认证审计均由同一个 Prisma 数据库保存，不存在必须跨外部 session store 协调的写入。因此采用单事务比“先写后删”补偿更可靠，也不会误删登录前已经存在的、同版本且有效的同意证据。

`SessionService.create` 新增可选事务客户端，并通过该客户端同时写入 `AuthSession` 和 `SESSION_CREATED` 审计。控制器不再在 OAuth 服务返回后另行创建会话；OAuth 服务仅在事务完成后返回令牌。

三条消费者路径的具体顺序如下：

1. 手机号登录：先校验当前法律版本，再消费短信验证码；随后在 Serializable 事务中查找/创建用户、校验启用状态和角色、记录同意、创建会话、记录 `SESSION_CREATED` 和 `PHONE_LOGIN_SUCCEEDED`，提交后才返回令牌。`P2002`/`P2034` 重试整个数据库事务。禁用用户先于同意写入被拒绝。
2. 微信手机号快捷登录：先校验法律版本和 audience，再调用微信换取身份/手机号；随后在 Serializable 事务中解析或创建用户、校验启用状态、绑定微信身份、记录同意、创建会话和成功审计，提交后返回令牌。缺失/过期版本不会调用 provider。
3. pending OAuth 完成：先校验法律版本和手机号格式；在 Serializable 事务中消费 `PHONE_LINK` 验证码、认领 pending OAuth、解析/创建并校验用户、绑定身份、记录同意、创建会话和成功审计，提交后返回令牌。事务失败时验证码消费和 pending 认领也回滚。

失败方向测试覆盖三条路径：同意写入失败时不会调用会话创建；会话写入失败时事务不提交同意；禁用用户不会写同意或会话。另有 `SessionService` 直接测试证明 supplied transaction client 同时承载会话与创建审计。

### 3. 成功审计元数据

- 手机号成功审计保持法律版本元数据，并新增 `loginMethod: PHONE_VERIFICATION_CODE`。
- 微信手机号快捷登录成功审计新增 `loginMethod: WECHAT_MINI_PROGRAM_PHONE`、`userAgreementVersion`、`privacyPolicyVersion`，同时记录事务内创建的 session ID。
- pending OAuth 完成成功审计新增 `loginMethod: PENDING_OAUTH_PHONE`、两个法律版本和 session ID。
- 三条成功审计都与同意和会话处于同一事务；成功审计失败也不会留下可用会话或本次同意写入。

### 4. 法律权利与联系 UI

- 从用户页移除未核实的 `400-888-0123`、对应“联系客服”入口、弹窗逻辑、图标和样式；未虚构替代号码。
- 用户协议和隐私政策均明确当前版本没有自助账户注销入口，并使用精确占位文本“账户注销申请渠道：【正式发布前补充】”，要求正式发布时核验并公布真实有效渠道。
- 隐私权利章节只列出当前确实存在的个人资料、收货地址和订单页面；其他权利请求渠道保留正式发布占位符。
- 测试锁定运营者全称“开封市示范区赵美红小吃店”，并防止假号码、虚假的“已提供账户入口”表述回归。

## 修改文件

错误契约与前端映射：

- `common/src/response-codes/codes.ts`
- `common/src/response-codes/meta.ts`
- `backend/src/common/exceptions/app.exception.ts`
- `backend/src/common/exceptions/validation.exception.ts`
- `backend/src/main.ts`
- `backend/src/modules/auth/legal-consent.service.ts`
- `backend/src/modules/auth/legal-consent.service.spec.ts`
- `backend/src/modules/auth/legal-consent.http.spec.ts`
- `uniapp/src/services/auth-message.ts`
- `uniapp/src/services/auth-message.spec.ts`
- `uniapp/src/services/auth.ts`
- `uniapp/src/services/auth.spec.ts`

事务边界与审计：

- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.controller.spec.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.service.spec.ts`
- `backend/src/modules/auth/oauth.service.ts`
- `backend/src/modules/auth/oauth.service.spec.ts`
- `backend/src/modules/auth/session.service.ts`
- `backend/src/modules/auth/session.service.spec.ts`

法律文档与 UI：

- `uniapp/src/legal/legal-documents.ts`
- `uniapp/src/legal/legal-documents.spec.ts`
- `uniapp/src/pages/user/user.vue`
- `uniapp/tests/legal-pages.test.mjs`

## RED 证据

先添加测试、确认失败，再修改生产代码：

- 后端首轮定向测试：40 项，30 通过、10 失败。失败分别证明稳定法律错误码尚不存在、DTO HTTP 路径仍返回通用参数错误、手机号会话不在事务内、禁用用户会留下同意、会话失败会留下同意、手机号审计缺少方法，以及微信快捷/pending OAuth 两条路径的会话失败回滚和成功审计元数据缺失。
- 修正测试应用 guard 装配后，HTTP 用例单独运行 1 项、0 通过、1 失败；旧响应为 `{ code: 1001, msg: "legalConsent should not be null or undefined", data: null }`，期望为稳定 `2004` 中文响应。
- uniapp RED：72 项，67 通过、5 失败，覆盖法律文档虚假注销入口、API 包络错误码映射，以及错误码/两类旧英文消息回退。
- 页面 RED：4 项，3 通过、1 失败，直接检出用户页中的 `400-888-0123`。

## GREEN 与完整验证

定向 GREEN：

- 后端六个认证相关测试文件：60/60 通过。
- 增加 `SessionService` 事务客户端直接回归后，相关后端子集：36/36 通过，TypeScript `--noEmit` 通过。
- uniapp 法律文档和认证映射：23/23 通过。
- 页面法律/UI 回归：4/4 通过。

完整验证按要求原样执行：

```text
corepack pnpm --filter @lingdian/contracts build &&
corepack pnpm --filter @lingdian/db build &&
corepack pnpm --filter @lingdian/api test &&
corepack pnpm --filter @lingdian/api build &&
corepack pnpm --filter @lingdian/uniapp test &&
corepack pnpm --filter @lingdian/uniapp type-check &&
corepack pnpm --filter @lingdian/uniapp build:mp-weixin
```

结果：

- contracts build：通过。
- db build：通过。
- API：173/173 通过。
- API build：通过。
- uniapp：15 个测试文件、72/72 通过。该总数包含工作区中用户未跟踪且未提交的 `product-image.spec.ts` 7 项测试。
- uniapp type-check：通过。
- 微信小程序 build：通过。
- 因本次新增 common 错误码，另行运行 `corepack pnpm --filter @lingdian/common build`：通过。
- `git diff --check`：无输出。
- 冲突标记扫描 `rg -n '^(<<<<<<<|=======|>>>>>>>)' ...`：无输出。
- 已有 Vite CJS API 弃用提示和 uni-app 新版本提示均为非失败提示。

## 提交

- `e175497bd479170194a91e285a40af5ec554bef0` `修复：统一协议版本错误契约`
- `eac7bb815a9776e0be768f5fd00ef2b2a97d396b` `修复：原子化登录同意与会话创建`
- `061d078cde989e49f0a2ee749f89810922ca693f` `修复：校正法律文档与联系方式`

未推送。

## 用户脏改动保留证明

三个实现提交完成后的 `git status --branch --short`：

```text
## main...origin/main [ahead 15]
 M pnpm-workspace.yaml
 M uniapp/src/components/home/RecommendSection.vue
 M uniapp/src/components/menu/CategorySidebar.vue
 M uniapp/src/components/menu/MenuProductItem.vue
 M uniapp/src/manifest.json
 M uniapp/src/services/catalog.ts
 M uniapp/tests/miniapp-layout.test.mjs
?? docs/superpowers/plans/2026-07-28-uniapp-preview-ui-fixes.md
?? uniapp/src/services/product-image.spec.ts
?? uniapp/src/services/product-image.ts
```

以上路径均未被本任务修改，且未暂存、未提交；本次修复文件在实现提交后均为干净状态。

## 剩余风险

- 微信换码是外部系统调用，无法与本地 Prisma 事务原子提交。若换码成功后本地事务失败，微信动态码可能已被消费，但本地不会留下同意、会话或成功审计。
- 手机号直接登录沿用现有架构，在进入数据库事务前消费一次性短信验证码。若后续数据库事务失败，验证码不会恢复，用户需要重新获取；但本地同意与会话保持全有或全无。pending OAuth 的验证码消费位于同一数据库事务内，可随事务回滚。
- 法律文档中的联系、注销和其他权利请求渠道仍是强制发布占位符。正式发布前必须由运营方核验并替换为真实有效信息；当前修复刻意没有虚构事实。
