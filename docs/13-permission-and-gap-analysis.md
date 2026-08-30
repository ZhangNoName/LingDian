# LingDian 权限与缺口分析

> 审查基线：2026-08-30 当前工作区。架构边界见 [系统结构](./11-system-structure.md)，模块事实见 [模块目录](./12-module-catalog.md)，本轮已修问题见 [代码库全面审查](./14-codebase-review-2026-08-30.md)。

## 1. 结论

当前认证、用户归属和单店数据范围已经形成可验证边界；本轮又关闭了旧 session 复活、支付意图越权/并发、在线手工支付退款、规格选择和前端模拟模块暴露等问题。系统仍不是完整的线上经营闭环，剩余阻塞主要来自真实支付与退款、法律信息、库存承诺、动作级权限和外部灾备条件。

风险口径：

| 级别 | 含义 |
| --- | --- |
| **P0** | 在对应上线范围内会直接造成资金、合规或不可恢复数据风险，必须关闭或明确禁用能力 |
| **P1** | 可小范围受控试点，但必须有负责人、降级和关闭计划 |
| **P2** | 规模经营前建设，不应以静态页冒充真实能力 |
| **P3** | 工程一致性和长期维护项 |

## 2. 当前身份与授权模型

### 2.1 身份域

| 身份 | Token audience | 固定角色 | 当前数据范围 | 客户端 |
| --- | --- | --- | --- | --- |
| 顾客 | `user-api` | 通常为 `USER` | 自己的 user ID | `uniapp/` |
| 商家 | `merchant-api` | `MERCHANT` | JWT 中的 `merchantStoreIds`，再收口到主门店 | `web/` |
| 平台管理员 | `admin-api` | `ADMIN` | 平台全局，部分账号操作受层级限制 | `admin/` |
| 超级管理员 | `admin-api` | `SUPER_ADMIN` | 平台全局及超管敏感动作 | `admin/` |
| Connector | HMAC 服务身份 | 无用户角色 | 指定账户、提供方和事件 | 独立连接器 |

`AccessTokenGuard` 校验 JWT、数据库 session、用户状态和 `sessionVersion`；随后由 audience/角色 guard 收窄入口。owner 和 store scope 在 service/repository 查询条件中再次执行。

### 2.2 当前资源矩阵

| 资源/动作 | 顾客 | 商家 | ADMIN | SUPER_ADMIN | 评价 |
| --- | --- | --- | --- | --- | --- |
| 公开主门店/菜单 | 公开读 | 公开读 | 公开读 | 公开读 | 服务端固定 `PRIMARY_STORE_ID` |
| 自己的资料/身份 | 读写部分资料、绑定/解绑 | — | — | — | 缺注销与数据删除 |
| 自己的地址 | 读、创建/导入、默认、删除 | — | — | — | owner scope 已执行 |
| 自己的订单 | 创建、列表、详情 | — | 全局读/改状态/软删 | 同 ADMIN | owner scope 已执行；平台写权限过宽 |
| 主门店订单 | — | 读、改状态、软删 | 全局 | 全局 | store scope 已执行；无岗位/动作权限 |
| 主门店商品 | — | 读、配置、改价格/库存 | 全局 CRUD/图片/配置 | 全局 | store scope 已执行；平台用宽角色 |
| 门店集成开关 | — | 主门店读写 | — | — | scope 已执行；缺敏感变更审计 |
| 自己订单的支付 | 创建意图、查意图 | 账户只读 | 全部账户只读 | 账户写及全局读 | owner/store 和支付不变量已执行；前端未接 |
| 平台账号 | — | — | 管理更低层级 | 管理更低层级 | 层级有效；仍是固定角色 |
| 系统错误日志 | — | — | — | 读 | 前后端一致 |
| 指标端点 | Nginx 公网阻断 | Docker 网络内 Prometheus 读 | 同左 | 同左 | 端口与路径均受部署边界保护 |

### 2.3 已建立的安全不变量

- 管理、商家、顾客 token 不能跨 audience 复用；前端接收登录结果时也校验 audience/角色；
- 每次登录创建新 session ID，`activeDeviceKey` 的可空唯一键保证每设备最多一条活动会话；退出后的旧 access token 不会在重登录后复活；
- refresh token 原子轮换，重放会撤销 session；密码、状态、角色和门店范围变化会撤销会话；
- H5 用 `HttpOnly` cookie 刷新；小程序只用新的平台登录码为已绑定活动顾客创建新 session，显式退出或服务端 401 后不会静默重建会话；
- 顾客订单、地址、支付及幂等重试按当前用户归属查询；商家数据按服务端 claims 和主门店双重收口；
- 订单提交重读 SKU、选项和价格，客户端金额不是资金事实；
- 一个订单最多一个活动支付尝试；订单终止和支付预占使用一致的行锁顺序；
- 在线 `PAID` 只能来自验签支付回调，在线 `REFUNDING/REFUNDED` 不能由通用状态接口手工写入；
- webhook 校验签名、时效、账户、提供方、外部意图、金额、币种、事件 ID 和载荷哈希，并防止乱序状态复活；
- 支付过期不按本地时钟直接释放；Connector 必须按稳定支付号返回持久 `CLOSED` 凭证，否则占位保留并标记人工核对；
- 图片入口检查 MIME、文件签名、大小并服务端转码；日志入口限制来源、级别、大小和速率，并做基础脱敏。

本轮静态遍历未发现私有业务 Controller 明显漏挂 Guard。但应用尚未采用“全局默认认证 + 公开路由显式 `@Public()`”，新增路由仍可能因漏加 Guard 而 fail open。

## 3. 本轮已关闭的陈旧风险

以下问题已经有实现和回归测试，不再作为待办重复列出：

| 问题 | 关闭方式 |
| --- | --- |
| 同设备重登录复活已注销 access token | 新建 session ID + `activeDeviceKey` 唯一活动约束 + 迁移清理异常重复活动 session |
| PaymentIntent 幂等路径对象越权 | 先校验订单 owner/store/isDeleted，再查幂等结果和冲突恢复 |
| 同一订单并发创建多个活动支付 | `activeOrderKey` 唯一键、串行化事务、订单条件更新与重试 |
| 订单终止与支付预占竞态 | 两者统一订单行锁顺序；已预占时拒绝终止，已终止时拒绝预占 |
| Connector 同步终态造成“意图成功、订单未支付” | 同步 `SUCCEEDED` 只记为 `PROCESSING`；成功统一由验签 webhook 确认 |
| 在线订单可手工标记支付/退款 | 非现金 `PAID/REFUNDING/REFUNDED` 由订单策略直接拒绝 |
| 失败意图被迟到 PROCESSING 复活 | webhook 只从活动状态推进；迟到成功进入 `LATE_PAYMENT` |
| 成功 webhook 与取消并发时读到旧订单快照 | 成功事务先条件更新/锁定订单，再读取意图；取消与成功统一 order → intent 锁顺序 |
| 过期或创建响应丢失的支付永久占用订单 | 新尝试前调用 Connector 关单；仅持久 `CLOSED` 凭证可释放，未知/处理中/成功均保留并人工核对 |
| 同一渠道交易号可在不同 intent 重复入账 | 交易流水冗余保存 provider/account，并由数据库唯一键约束 `provider + accountId + providerTransactionId`；冲突使支付确认事务整体回滚 |
| 顾客规格不支持多选/min/max | 前端按契约实现选择模式、上下限和默认项；仍保留默认 SKU 限制 |
| 堂食/自取/配送在首页、规格、结算和订单类型间漂移 | 服务方式作为路由上下文贯穿，统一映射为 `dine_in` / `pickup` / `takeout` |
| 商家重新编辑时丢失已禁用规格配置 | 管理查询保留禁用绑定/组/选项，公开菜单仍只返回活动配置，并校验重启用规则 |
| 订单查询缺在线支付渠道 | DTO 和前端统一补齐 UNIONPAY/STRIPE/PAYPAL |
| 生产导航展示占位经营模块/伪指标 | 占位一级模块默认 feature flag 关闭，工作台移除模拟指标 |
| CI 没有 PR verify、根测试漏跑脚本、type-check 名不副实 | PR verify、生效的全 workspace type-check、完整根测试和结构/文档门禁 |
| 空库迁移无法复现 | 完整 baseline + MySQL 8.4 空库迁移和 drift 校验 |
| 多前端/API 逐个切换形成版本分裂 | Compose 核心服务成组激活、健康门禁和整组应用回滚 |
| 迁移执行时旧 API 继续写、迁移失败误启旧版本 | 迁移前停止 API；不确定失败时核心保持停止，只允许 roll-forward 或恢复已验证备份 |
| 错误/不兼容 rollback SHA 误停当前健康服务 | 激活前比较完整迁移树；不兼容直接拒绝且保持当前服务，兼容性比较覆盖内容、读失败和软链接 |
| Windows editor route 后缀绕过静态规则 | 按完整路径边界识别 route，并通过真实中间件请求行为测试覆盖后缀和子路径 |
| `packages/contracts` 把类型 fixture 编进发布包 | fixture 移至测试目录、独立 noEmit 类型校验、构建先清理 dist 并断言产物无 spec/test |

## 4. P0：对应上线范围的阻塞项

### P0-COM-01：正式法律与运营信息仍是占位

`uniapp/src/legal/legal-documents.ts` 明确保留运营主体、联系方式、投诉/注销渠道、第三方服务商、保存期限和存储地点等 `【正式发布前补充】`。当前也没有自助账号注销入口。

关闭条件：由实际运营方和法律/隐私负责人提供并审核真实信息；完成注销/删除受理、数据留存和第三方清单核验。研发不得猜测填入。

### P0-PAY-01：在线收款尚未形成端到端产品闭环

服务端支付底座已收紧，但顾客端仍固定提交 `cash` 并显示“模拟支付”。如首期只收现金，必须在产品、配置和运营流程中明确关闭在线渠道；如要上线在线收款，以下项全部是同一上线门禁：

1. 顾客端创建 PaymentIntent、调起真实 SDK、轮询/订阅服务端结果和失败恢复；
2. 收款账户不可变版本，PaymentIntent 固定引用创建时配置；轮换保留旧版本验签窗口；
3. 主动查单、定时订单/意图超时 worker、停机恢复和迟到支付自动退款或人工差错流程；当前只有“新支付重试时，以 Connector 持久关单凭证安全释放旧意图”的底座，不等于自动关单闭环；
4. 全额/部分退款领域、退款 Connector、回调、幂等、失败重试和审批；
5. 日终对账、差错单、报警和人工处置；
6. 真实商户、证书和沙箱/生产 E2E 验收。

`LATE_PAYMENT` 只是识别迟到资金，不等同于自动退款或对账闭环。

### P0-INV-01：库存承诺的条件阻塞

当前 SKU 有库存数，但下单不检查、预占或扣减库存。若首期商品不限量或人工售罄，可明确降级；只要对外承诺限量、实时余量或售罄强一致，就必须先实现预占—支付确认—取消/超时释放、库存流水和并发测试。

### P0-OPS-01：生产外部控制必须现场核验

仓库声明了 GitHub `production` environment、迁移前备份、定时备份和恢复工具，但 environment reviewers、分支保护、值班 webhook、异机备份、域名/证书、真实数据库权限和恢复演练结果属于仓库外状态。

关闭条件：上线清单逐项留证；同机备份加密复制到异机/对象存储；完成隔离恢复演练；确认审批人和值班人。不能用“配置文件里有字段”代替实际控制。

## 5. P1：受控试点核心缺口

| 编号 | 缺口 | 风险/影响 | 最小关闭条件 |
| --- | --- | --- | --- |
| P1-IAM-01 | 商家员工、岗位和动作权限缺失 | 任一商家账号可改价格、库存、订单和集成 | 多人使用前完成 membership、角色、动作权限和审计 |
| P1-IAM-02 | 平台商品/订单仍用宽 `AdminGuard` | 普通 ADMIN 有全局交易写能力 | 拆显式权限点和敏感动作审批；默认拒绝 |
| P1-IAM-03 | 无全局默认拒绝授权 | 新 Controller 漏 Guard 可能公开 | 全局策略 Guard，公开路由显式标记，路由枚举测试 |
| P1-IAM-04 | `admin/merchants` 与 `admin/users` 策略重叠 | 同一账号治理可能出现不同授权规则 | 统一 API、UI、层级、审计和产品入口 |
| P1-IAM-05 | 顾客 audience 与 `USER` 角色语义未完全统一 | 角色撤销是否撤销顾客能力不够显式 | 固化 audience/role 策略与撤权矩阵测试 |
| P1-STORE-01 | 主门店设置只读 | 经营条件不能在产品内维护 | 资料、营业时段、服务方式、配送范围写入和审计 |
| P1-CAT-01 | 商家无完整商品建档/发布入口 | 仍依赖平台 API 或脚本初始化 | 分类、商品、图片、SKU、上下架、菜单发布闭环 |
| P1-ORDER-01 | 无顾客取消和自动关单 worker | 没有新支付重试时，僵尸订单与活动支付不能主动收敛 | 独立 worker、查单前置、幂等关单和告警 |
| P1-ORDER-02 | 履约未独立建模 | 基础订单状态不能覆盖接单、备餐、核销和配送 | 履约单/事件、实时商家工作台和顾客同步 |
| P1-PAY-01 | 支付账户只读视图暴露配置元数据，敏感修改无 step-up | 扩大配置泄露和误改影响 | 最小投影、MFA/step-up、maker-checker 或强审计 |
| P1-OPS-01 | outbox 无查询、死信重放和积压告警 | 外部系统失败只能查库 | 运营页、重放/跳过、权限、审计和指标告警 |
| P1-AUD-01 | 无统一业务审计 | 价格、库存、账户、集成变更难追责 | actor/action/resource/before/after/requestId 模型和查询 |
| P1-OBS-01 | 无分布式 trace 和交易/任务指标 | 支付/订单/Connector 跨边界定位困难 | trace/span、订单/支付/outbox 指标、SLO 和告警 |
| P1-DATA-01 | 会话、验证码、OAuth、订单、地址、outbox 的生命周期不完整 | 安全数据和 PII 长期累积 | 数据分级、留存表、清理 worker、legal hold 和结果监控 |
| P1-PRIV-01 | 普通 ADMIN 可读全平台账号和手机号 | 敏感身份缺字段/对象级读隔离 | `users:read_sensitive` 等最小投影权限 |
| P1-SEC-01 | 管理和敏感配置无 MFA/step-up | 密码会话失陷后可执行高风险动作 | 管理员 MFA，支付/权限/退款二次验证或审批 |
| P1-SEC-02 | 验证码主要依赖进程内 IP 限流 | 分布式尝试和多实例下限流不稳定 | 目标/IP/设备多维计数、共享存储、短期锁定和告警 |
| P1-REL-01 | 单主机、本地 uploads 和同机备份 | 整机故障影响业务与恢复 | 异机备份、对象存储或复制、RPO/RTO 和定期演练 |
| P1-REL-02 | 数据库迁移不可自动回退 | 迁移历史不一致时应用回滚会被安全拒绝，仍需 roll-forward 或恢复 | expand/contract、向后兼容、迁移前备份和演练 |
| P1-REL-03 | readiness 未覆盖迁移漂移、磁盘和 Connector | 健康可能高估 | 依赖分级、容量指标、外部合成探测和 runbook |
| P1-ACC-01 | 顾客端无可见退出/注销入口 | 用户无法完成账号生命周期操作 | 退出入口、注销/解绑流程和影响提示 |

## 6. 依赖风险例外

`pnpm audit --prod --audit-level high` 当前仍报告 **1 high + 4 moderate**，都来自 DCloud/uni-app 锁定的 Vite 5 开发工具链（Vite、esbuild、launch-editor/phin 链路），不是已清零状态。

当前缓解：

- uni-app 开发服务器固定 `127.0.0.1`，不对局域网暴露；
- Windows 上按路径边界阻断 `/__open-in-editor` 及其变体，并以真实中间件请求测试；
- 小程序生产构建强制显式 HTTPS API；
- 生产只部署静态构建产物，DCloud/Vite 开发服务器不进入运行时容器。

后续应跟踪 DCloud 对新 Vite 主版本的官方兼容版本，再通过完整 H5/小程序构建和真机验收升级；不要为了让 audit 归零而强制覆盖不兼容 peer dependency。相关官方公告见 [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)、[GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)、[GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)、[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) 和 [GHSA-x565-32qp-m3vf](https://github.com/advisories/GHSA-x565-32qp-m3vf)。

## 7. P2：规模经营能力

| 领域 | 建议模块 | 能力范围 |
| --- | --- | --- |
| 顾客运营 | customers/membership | 会员档案、标签、等级、积分、余额和资产流水 |
| 促销定价 | pricing/promotions | 优惠券、活动、服务端试算、核销和退款返还 |
| 库存供应链 | inventory/procurement | 库存流水、盘点、采购、供应商和成本 |
| 财务 | finance/reconciliation | 退款账、渠道账单、手续费、结算、发票和差错 |
| 配送与设备 | fulfillment/devices | 配送任务、打印机、叫号屏和核销设备 |
| 通知 | notifications | 订单/支付/退款消息、模板、偏好和失败重试 |
| 数据分析 | analytics | 统一指标口径、聚合、导出和数据权限 |
| 运行保障 | backups/DR/HA | 对象存储、异地备份、RPO/RTO、多副本部署 |

当前明确不建设组织/品牌层级、顾客选店、跨店授权、跨店购物车、库存调拨和跨店报表。经营范围改变时单独做 ADR，不为假设性扩店增加复杂度。

## 8. 目标权限模型

采用“RBAC 赋动作能力 + owner/store 关系约束”，不要只增加角色枚举：

```text
Subject
  ├─ PlatformRoleAssignment
  └─ StoreMembership（唯一生产门店）
       └─ RoleAssignment ──> Role ──> Permission(resource:action)

Policy = audience + active subject + permission + owner/primary-store relation + domain invariant
```

建议权限名：

```text
stores:read            stores:update
catalog:read           catalog:write        catalog:publish
prices:write           inventory:adjust
orders:read            orders:accept        orders:fulfill
orders:cancel          refunds:request       refunds:approve
payments:read          reconciliation:manage
integrations:read      integrations:manage
staff:read             staff:manage          roles:manage
audit:read             system_logs:read
```

顾客“只能访问自己的订单”是对象关系，不是可分配角色；超管也不能绕过支付、退款、库存和订单状态等领域不变量。

### 服务端授权顺序

1. 校验 access token、session、账号状态和 audience；
2. 解析 `resource:action`；
3. 解析主门店和主体 membership；
4. **带 owner/store scope 查询对象**，未授权前不返回缓存或幂等结果；
5. 执行支付、订单、库存等领域不变量；
6. 同事务写业务事实和必要审计；
7. 返回服务端计算的 `allowed_actions` 改善前端体验。

## 9. 上线 Gate

### Gate 0：明确经营范围

- 真实法律/运营信息审核完成；
- 现金试点与在线支付二选一：现金则彻底禁用在线渠道，在线则关闭 P0-PAY-01 全部条件；
- 明确是否承诺库存强一致；
- 确认生产审批、异机备份、值班和隔离恢复演练。

### Gate 1：受控单店试点

- 主门店资料与营业配置可维护；
- 商品建档、订单取消/超时和最小履约闭环；
- 若多人登录，先完成商家员工与动作权限；
- 死信、业务审计、支付/订单告警和人工处置 runbook 可用。

### Gate 2：规模经营

- 库存、促销、会员、退款/对账、通知和履约按实际经营模式建设；
- 数据生命周期、对象存储/异机备份、RPO/RTO 和恢复演练制度化；
- 只有模块达到 [模块目录](./12-module-catalog.md) 的“已实现”口径后才解除 feature flag。
