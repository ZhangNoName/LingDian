# LingDian 代码库全面审查（2026-08-30）

> 本文记录 2026-08-30 全仓审查的范围、发现、修复和剩余风险。长期架构事实维护在 [系统结构](./11-system-structure.md)，逐模块状态维护在 [模块目录](./12-module-catalog.md)，上线排序维护在 [权限与缺口分析](./13-permission-and-gap-analysis.md)。

## 1. 审查结论

仓库的总体结构合理：单店产品采用模块化单体，三个客户端、NestJS API、共享契约、Prisma 和部署模块的责任方向清晰。本轮发现的确定性安全/一致性 bug、生产源码超长、运行时循环依赖、占位模块误导和 CI 门禁缺口均已修复。

当前代码可定义为“具备真实认证、商品配置、基础下单、商家订单、支付服务端底座、外部集成和单机生产运维能力的单店 MVP”。它仍不能被描述为完整线上餐饮经营系统：顾客端真实支付、退款/对账、库存一致性、完整履约、正式法律信息和动作级权限尚未闭环。

## 2. 范围与方法

审查覆盖：

- `backend/` 全部 NestJS 模块、Guard、DTO、事务、状态机和后台轮询器；
- `admin/`、`web/`、`uniapp/` 的路由、会话、API client、真实/模拟数据边界和主要页面；
- `common/`、`packages/contracts`、`packages/db`、`packages/icons`、`packages/observability`；
- Prisma schema、全部迁移、空库迁移包装；
- `.github/workflows/deploy.yml`、Dockerfile、Compose、Nginx、发布/备份/恢复/监控脚本；
- 全仓生产源码行数、相对/别名/workspace 运行时依赖环；
- workspace 测试、类型检查、构建、文档本地链接和生产依赖审计。

方法包括静态遍历、依赖图 SCC 检查、关键资金/权限路径逐分支审查、针对性回归测试、全仓门禁和官方安全公告核对。

## 3. 已修复问题

### 3.1 安全、资金和并发

| 严重度 | 发现 | 修复与约束 |
| --- | --- | --- |
| P0 | 同设备退出后重新登录复用 session 行，可能让旧 access token 复活 | 每次登录创建新 session ID；`activeDeviceKey` 可空唯一键保证每设备仅一条活动会话；迁移撤销异常重复活动 session；补旧 token 与并发登录测试 |
| P0 | 支付幂等快捷路径可能在 owner/store 校验前返回其他顾客意图 | 先按订单 ID + 当前顾客 + 主门店 + 未删除查询授权对象，再处理幂等和唯一冲突恢复 |
| P0 | 不同幂等键可并发为同一订单创建多个活动支付意图 | `activeOrderKey` 数据库唯一键、Serializable 预占事务、订单条件更新和唯一/事务冲突重试；迁移在永久 DDL 前 fail closed 检测历史重复活动意图 |
| P0 | 订单取消/超时与支付创建存在竞态 | 订单终止和支付预占使用一致的订单行锁顺序；支付已预占则终止回滚，订单已终止则预占条件更新失败 |
| P0 | 成功 webhook 与订单取消并发时，事务可能在等待行锁前建立旧快照，导致真实成功被误判迟到 | 成功事务的首个数据库动作改为条件更新/锁定订单，再读取意图；成功、取消、预占和过期释放统一 order → intent 锁顺序 |
| P0 | Connector 同步成功可能只改意图、不改订单/流水 | 同步 `SUCCEEDED` 只记为 `PROCESSING`；资金成功统一由验签 webhook 的领域事务写 Intent、Transaction、Order 和状态日志 |
| P0 | `expiresAt` 未参与处置，创建响应丢失或长期处理中意图会永久占用订单；直接本地过期又可能造成迟到成功与二次扣款 | 新尝试前按 `payment_no` 调 Connector 关单；只有串行化且带持久凭证的 `CLOSED` 可释放，未知/处理中/成功/通信失败均保留占位并人工核对；成功竞态不能被本地 `EXPIRED` 覆盖 |
| P0 | 渠道交易号只在单 intent 内唯一，同一真实资金事实可并发关联到两个支付意图 | 交易流水冗余 provider/account，数据库唯一约束 `provider + accountId + providerTransactionId`；迁移在持久 DDL 前预检历史重复，冲突使订单、意图和流水事务整体回滚 |
| P0 | 在线订单可通过通用状态接口手工标记支付或退款 | 非现金 `PAID`、`REFUNDING`、`REFUNDED` 直接拒绝；必须由资金领域事实推进 |
| P1 | webhook 乱序可能让失败意图被迟到处理中事件复活 | `PROCESSING` 只从活动状态幂等推进；失败后的迟到处理中事件只记已处理，不恢复状态或占位；迟到成功进入 `LATE_PAYMENT` |
| P1 | 订单查询渠道枚举与数据库/共享契约漂移 | DTO 和客户端补齐 `UNIONPAY`、`STRIPE`、`PAYPAL`，并增加逐项校验测试 |
| P1 | 订单状态更新/删除先读后写可能留下误导日志 | 条件更新携带已观察状态、支付渠道、未删除标志和 scope；影响行数不为 1 时回滚并报并发冲突 |

### 3.2 前端真实性与会话

| 范围 | 发现 | 修复 |
| --- | --- | --- |
| admin/web | 客户端可能接受错误 audience/角色的登录结果；redirect 需要防开放跳转 | 登录结果显式校验 audience/角色；redirect 只接受站内安全路径；补回归测试 |
| admin/web | 退出只清本地状态或失败语义不一致 | 增加可见退出入口，调用服务端 `/auth/logout`；服务端失败仍清本机状态并提示 |
| admin | 遗留一套无 token 且无人使用的裸商品/订单 `fetch` 服务 | 删除遗留服务；系统日志等请求统一使用认证 API client |
| web | 商品配置保存时，非首个 SKU 被选为默认可能同时保留两个默认项 | 提交前归一化为且仅为一个默认 SKU，并增加用例 |
| web/backend | 管理查询过滤掉已禁用的规格绑定/组选项，导致商家无法重新启用，公开菜单与管理模型混用 | 管理查询保留完整配置，公开菜单继续只返回活动配置；重启用时校验有效选项数满足 min/required |
| web | 工作台和一级导航把静态经营数据/占位模块伪装成能力 | 清除伪指标；会员、营销、分析、仓库、财务默认 feature flag 关闭且不注册路由 |
| web | 未知路由和多个异步页面缺可靠收敛 | 增加安全 fallback、请求竞态保护、错误态与共享 service/presentation 层 |
| uniapp | 菜单/订单仍混入大块 mock，服务方式与真实门店配置不一致 | 删除 284 行旧 mock；首页、菜单、订单和服务方式由真实契约映射；缺失字段显示“未记录”而非编造 |
| uniapp | 堂食/自取/配送在首页、规格、结算和订单 DTO 之间丢失或映射错误 | 服务方式作为路由上下文贯穿 home → menu → spec → checkout，统一映射 `dine_in` / `pickup` / `takeout`，缺失时间不再伪造“立即取餐” |
| uniapp | 规格页近似单选，忽略 `MULTIPLE`、min/max、可选组和 SKU 作用域 | 按默认活动 SKU 合并 PRODUCT/VARIANT 选择组，实现单/多选、上下限、默认项和非法选择校验 |
| uniapp | 购物车只按商品合并，规格不同可能混单；菜单请求竞态可覆盖新缓存 | 购物车 ID 纳入 SKU 和选项，选项加价参与显示；菜单使用 generation 和 in-flight 去重防旧请求覆盖 |
| uniapp | 地址等受保护页登录回跳不完整，服务端失败提示可能失真 | 补受保护页注册、真实错误语义、profile/request/auth 回归测试 |
| uniapp/backend | 把 H5 cookie 刷新错误套到小程序，进程重启后无法恢复；无约束重认证又可能撤销后静默复活 | H5 保留 HttpOnly refresh；小程序以新 `uni.login` 码为已绑定活动 `USER` 创建新 session，不存 raw token；显式退出、服务端 401 和二次 401 均阻断自动恢复 |

### 3.3 模块边界和维护性

生产源码门禁的 600 行预算只针对 `.ts` / `.vue` 业务源文件；测试、类型声明、Prisma schema、迁移和声明式部署配置按其自身可读性评估，不为追求行数机械拆分。

| 文件 | 审查前 | 审查后主文件 | 拆出的职责 |
| --- | ---: | ---: | --- |
| `backend/src/modules/products/products.service.ts` | 969 | 445 | 配置命令 305、查询形状 96；已有 mapper/controller 保持独立 |
| `backend/src/modules/orders/orders.service.ts` | 874 | 485 | 查询 181、策略 112、presenter 97 |
| `backend/src/modules/payments/payments.service.ts`（过期修复加入后） | 628 | 454 | 过期关单、人工核对和安全释放 192 |
| `web/src/views/orders/index.vue` | 612 | 441 | API service 70、展示映射 189、对话框组件 |
| `web/src/views/products/index.vue` | 611 | 589 | API service 64、配置归一化 119、行内编辑 38、编辑组件 |

审查前发现 3 个运行时循环依赖，审查后为 0：

- `badge/Badge.vue` ↔ `badge/index.ts`；
- `button/Button.vue` ↔ `button/index.ts`；
- `select/SelectContent.vue` ↔ `select/index.ts`。

变体定义移入无组件依赖的 `variants.ts`，Select 内部改为直接依赖具体组件。新增 `scripts/source-quality.test.mjs` 持续检查 600 行预算和运行时依赖环。

### 3.4 工程、CI、部署和安全基线

| 发现 | 修复 |
| --- | --- |
| 根测试未包含 `tests/*.test.mjs`，部分 workspace 没有真实 type-check | 根测试纳入仓库、uniapp、observability 和 scripts 测试；所有相关 workspace 提供 `type-check` |
| GitHub Actions 只在 `main` push 验证 | 增加 PR verify；生产 deploy 显式排除 PR，继续使用 `production` environment |
| 超长文件和循环依赖没有自动门禁 | 新增 source-quality 测试并纳入根测试 |
| 文档本地链接依赖人工维护 | 新增 documentation-links 测试；修正后端文档历史命名 |
| uni-app 开发工具链有已知网络暴露风险，editor route 的简单字符串规则可被后缀绕过 | 开发服务器固定 `127.0.0.1`；Windows 按路径边界阻断 editor route；以真实中间件请求覆盖后缀/子路径；小程序生产构建强制 HTTPS API |
| `packages/contracts` 的 TS fixture 被编入 `dist/*.spec.js/.d.ts` | fixture 移入测试目录并使用独立 noEmit tsconfig；生产 build 先清理 dist，运行时测试只走公开入口并断言发布产物无 spec/test |
| 迁移期间旧 API 仍可写库；不兼容手工回滚或迁移失败的恢复语义可能误停/误启服务 | 迁移前停止 API；迁移失败核心保持停止；自动应用回滚只允许完整迁移树逐字节一致；错误/不兼容手工 rollback 在激活前拒绝且保持当前服务运行，比较拒绝软链接、缺失、空、不可读和内容差异 |

已有并经本轮校准确认的部署能力包括：MySQL 8.4 空库迁移、迁移前数据库/uploads 备份与 API 停写、不可变 Git bundle、核心 Compose 服务成组激活、迁移兼容应用回滚、TLS、定时备份/恢复工具，以及 Prometheus、Alertmanager、Loki、Alloy、Grafana、exporters 和 blackbox 组成的完整观测栈。

## 4. 验证结果与持续门禁

| 门禁 | 本轮结果 | 防止的回归 |
| --- | --- | --- |
| `pnpm test` | 593/593 通过 | API、三端、共享包、结构、部署和文档回归 |
| `pnpm run build` | 通过 | 全部包、API、admin、web、uniapp H5 构建错误 |
| uniapp 微信小程序生产构建 | 通过，并已加入 CI | 小程序平台编译错误、生产 API 未使用 HTTPS |
| `pnpm run type-check` | 9/9 workspace 通过 | 跨包与三端类型漂移 |
| Prisma validate | 通过 | schema 语法和生成边界错误 |
| 部署契约测试 | 22/22 通过 | 发布、回滚、迁移树和备份恢复协议漂移 |
| 部署脚本 `bash -n` | 通过 | 发布、备份、恢复和观测脚本语法错误 |
| `scripts/source-quality.test.mjs` | 2/2 通过 | 生产源码超过 600 行、运行时循环依赖 |
| `scripts/documentation-links.test.mjs` | 通过 | 主要文档本地链接失效 |
| `git diff --check` | 通过 | 空白和补丁格式问题 |
| `pnpm audit --prod --audit-level high` | 预期非零：1 high + 4 moderate | 跟踪 DCloud/Vite 开发工具链风险例外 |

全仓测试由根 `pnpm test` 串行执行 API、admin、web、uniapp 及仓库/结构/部署/文档测试；该命令也是 CI verify 的强制门禁。本次快照共 593 项，后续数量可以随有效测试增删变化，不作为架构契约。

CI 还会在 MySQL 8.4 服务上从空库执行全部迁移、检查 schema drift，验证 Dockerfile、核心与观测 Compose、dashboard JSON 和校验后的 Git bundle。本地 Docker daemon 未启动，因此本轮没有在本机实际执行 MySQL 8.4 空库迁移和 Dockerfile/Compose 容器验证；本地 Prisma validate、迁移结构测试不能替代这两个交付门禁，合入前必须由当前 CI 或可用的 Docker 环境执行。

## 5. 未解决风险

这些问题不是本轮可以凭代码猜测解决的事项，或需要先明确产品范围和外部资源：

| 优先级 | 风险 | 当前安全口径/下一步 |
| --- | --- | --- |
| P0 | 法律文本仍缺真实主体、联系方式、第三方、留存和注销渠道 | 正式发布前由运营与法律负责人提供并审核；实现注销/删除受理 |
| P0（启用在线支付时） | 顾客端未接真实支付 | 未完成前只允许明确现金试点，在线渠道不得对外开放 |
| P0（启用在线支付时） | 无退款域、主动查单、定时超时/关单、迟到自动处置和日终对账 | 已有“重试触发 + 持久关单凭证”的安全释放底座；仍需真实商户 E2E、退款、worker、差错单与告警 |
| P0（启用在线支付时） | 收款账户可原地修改，旧意图验签窗口依赖可变配置 | 账户不可变版本；敏感变更 step-up/审批与旧版本保留 |
| P0（承诺限量时） | 下单不预占或扣减库存 | 不承诺实时库存，或先实现预占—确认—释放与并发测试 |
| P1 | 商家无员工/岗位/动作权限，平台商品/订单权限过宽 | RBAC + store/owner 关系策略，敏感动作审计 |
| P1 | 门店设置只读，商品建档、顾客取消、自动关单和履约不完整 | 按单店试点路径补最小闭环，不同时铺开所有占位模块 |
| P1 | outbox 无死信运营，缺统一业务审计和交易/任务指标 | 增加查询/重放、审计事件、业务指标和 runbook |
| P1 | 单主机、本地 uploads、默认同机备份 | 异机加密复制、对象存储/复制、RPO/RTO 和恢复演练 |
| P1 | 应用回滚不反向执行数据库迁移 | 迁移历史不一致会拒绝应用回滚；坚持 expand/contract 和向后兼容，依靠 roll-forward 或迁移前备份做经演练的恢复 |
| P1 | DCloud/uni-app 固定的 Vite 5 链路仍有 1 high + 4 moderate | 保留 loopback/editor-route 缓解，跟踪上游兼容升级，不强制覆盖 peer dependency |

依赖公告来源：[Vite Windows fs.deny](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)、[Vite optimized deps path traversal](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)、[launch-editor UNC](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)、[esbuild dev server](https://github.com/advisories/GHSA-67mh-4wv8-2f99)、[phin redirect headers](https://github.com/advisories/GHSA-x565-32qp-m3vf)。生产部署只包含静态前端产物，因此这些告警主要约束开发工具链和错误的开发服务器暴露方式，但仍须保留风险负责人和升级跟踪。

## 6. 后续维护建议

1. 把 [权限与缺口分析](./13-permission-and-gap-analysis.md) 的 Gate 0 作为上线范围决策，不用页面是否存在替代验收。
2. 优先完成一条闭环：现金单店试点，或完整在线支付试点；不要同时开放半成品支付、库存和营销承诺。
3. 新业务源码接近 600 行时，优先按 query/command/policy/presenter 或 service/composable/component 拆分。
4. 新 API 必须同时说明 audience、permission、owner/store scope、幂等和并发不变量。
5. 每次交付保持测试、类型、构建、空库迁移、源码质量、依赖审计、部署契约和文档链接门禁；风险例外必须有升级触发条件，而不是静默忽略。
