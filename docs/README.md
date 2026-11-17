# LingDian 文档中心

文档分为“当前实现”“目标产品”“工程指南”和“历史记录”。阅读时先确认类型，避免把 PRD、页面壳或历史方案当成已上线能力。

## 当前实现基线

| 文档 | 用途 |
| --- | --- |
| [11-system-structure.md](./11-system-structure.md) | 2026-08-30 系统上下文、模块化单体边界、数据流、部署与可观测性 |
| [12-module-catalog.md](./12-module-catalog.md) | 三端、后端、共享包、CI/运维的逐模块真实状态与责任边界 |
| [13-permission-and-gap-analysis.md](./13-permission-and-gap-analysis.md) | 当前权限矩阵、已关闭风险、剩余 P0–P2、目标 RBAC 与上线 Gate |
| [26-merchant-catalog-2026-11-17.md](./26-merchant-catalog-2026-11-17.md) | 商家分类/商品草稿建档、资料维护和菜单发布/下架 |
| [27-replenishment-follow-through-2026-11-17.md](./27-replenishment-follow-through-2026-11-17.md) | 预警/库存定位补货、未收采购追查与已收齐原料口径修正 |
| [28-stocktakes-2026-11-18.md](./28-stocktakes-2026-11-18.md) | 盘点单、实盘草稿、版本复核与整单库存过账 |
| [29-category-management-2026-11-18.md](./29-category-management-2026-11-18.md) | 商家分类改名/排序/展示、版本审计与菜单门店关联过滤 |
| [30-product-images-2026-11-18.md](./30-product-images-2026-11-18.md) | 商家图片上传/替换/移除、版本审计、幂等与过期文件清理 |
| [31-inventory-analysis-2026-11-18.md](./31-inventory-analysis-2026-11-18.md) | 原料损耗率/盘盈盘亏分析、同快照完整导出与精确区间追查 |
| [32-purchase-delivery-2026-11-18.md](./32-purchase-delivery-2026-11-18.md) | 预计到货/空日期未收跟进、服务端筛选和采购/供应商列表链接恢复 |
| [25-account-settings-2026-11-17.md](./25-account-settings-2026-11-17.md) | 全局语言、账号/设置中英文、昵称预填与集成审计 |
| [24-purchasing-analysis-2026-11-17.md](./24-purchasing-analysis-2026-11-17.md) | 收货期间/供应商/原料报表、完整快照导出与未收采购补货建议 |
| [23-purchasing-2026-11-17.md](./23-purchasing-2026-11-17.md) | 供应商、采购单、分批收货、取消剩余与原子入库 |
| [22-product-catalog-2026-11-17.md](./22-product-catalog-2026-11-17.md) | 商品中英文配置、手机卡片、版本冲突保护与配方/共享组隔离 |
| [21-order-workflow-2026-11-17.md](./21-order-workflow-2026-11-17.md) | 商家订单中英文、筛选链接、手机交互与汇总口径修复 |
| [20-merchant-operations-2026-11-17.md](./20-merchant-operations-2026-11-17.md) | 真实经营概览、汇总快照与到期原料占用安全核验 |
| [19-inventory-alerts-2026-11-17.md](./19-inventory-alerts-2026-11-17.md) | 站内预警、确认跟进、自动解除、历史记录与升级验证 |
| [18-order-inventory-2026-11-17.md](./18-order-inventory-2026-11-17.md) | 销售配方、订单原料预占/扣减/释放、真实 MySQL 与迁移修正 |
| [17-inventory-reports-2026-11-17.md](./17-inventory-reports-2026-11-17.md) | 损耗登记、历史筛选、库存收支报表与完整快照导出 |
| [16-multi-store-iteration-2026-11-17.md](./16-multi-store-iteration-2026-11-17.md) | 多店运行时、统一选店、租户边界与验证记录 |
| [15-inventory-iteration-2026-11-17.md](./15-inventory-iteration-2026-11-17.md) | 原料库存台账、预警、流水、报表与后续迭代计划 |
| [14-codebase-review-2026-08-30.md](./14-codebase-review-2026-08-30.md) | 本轮全仓审查范围、bug 修复、长文件/循环依赖治理、验证结果和剩余风险 |
| [10-payment-order-architecture.md](./10-payment-order-architecture.md) | 当前工作区支付/订单服务端设计；顾客端支付、退款和对账尚未闭环 |
| [08-integration-architecture.md](./08-integration-architecture.md) | Connector、outbox 和可插拔外部系统边界 |
| [09-architecture-review-2026-08-29.md](./09-architecture-review-2026-08-29.md) | 2026-08-29 历史审查记录；现状以 11–14 为准 |

推荐先读 11，再用 12 查具体模块，按 13 排上线与治理工作；14 用于追溯本轮改动依据。

## 目标产品文档

| 文档 | 类型与说明 |
| --- | --- |
| [00-prd.md](./00-prd.md) | 全产品目标 PRD；不代表全部已实现 |
| [07-web-prd.md](./07-web-prd.md) | 商家 Web 目标页面与模块 PRD；当前多个一级模块仍是占位 |
| [2026-06-20-miniapp-prd.md](./2026-06-20-miniapp-prd.md) | 小程序阶段 PRD |
| [2026-06-21-miniapp-component-tree.md](./2026-06-21-miniapp-component-tree.md) | 小程序历史组件设计树，不是当前组件清单 |

## 工程指南

| 文档 | 说明 |
| --- | --- |
| [../README.md](../README.md) | 仓库启动、构建与常用命令 |
| [../deploy/README.md](../deploy/README.md) | 当前唯一生产部署 Runbook：新机初始化、TLS、监控、备份、回滚与恢复 |
| [../backend/README.md](../backend/README.md) | NestJS 后端与认证运维入口 |
| [01-overview.md](./01-overview.md) | 项目概览；以 11–13 的当前审查结论为准 |
| [02-directory-structure.md](./02-directory-structure.md) | 目录说明 |
| [03-frontend-uniapp.md](./03-frontend-uniapp.md) | uni-app 基础说明和发布前法律信息要求；模块现状见 12 |
| [04-frontend-admin.md](./04-frontend-admin.md) | 管理端基础说明；权限现状见 13 |
| [05-backend-nestjs.md](./05-backend-nestjs.md) | NestJS 后端分层、安全边界与常用验证入口 |
| [06-development-guide.md](./06-development-guide.md) | 开发指南 |
| [2026-07-27-zsf-shopping-lighthouse-deployment.md](./2026-07-27-zsf-shopping-lighthouse-deployment.md) | 已废弃的历史部署方案，不可用于新服务器部署 |

## 文档维护规则

- PRD 只描述目标；模块目录用“已实现 / 部分实现 / 占位 / 缺失”描述代码事实；
- 新增页面、API、权限或数据表时，同步更新 11、12、13 中受影响部分；14 作为日期化审查记录不滚动改写；
- 金额、订单、库存、退款和授权规则必须以服务端实现与测试为准；
- 历史方案不直接作为运行手册，发生偏差时先更新或明确归档；
- 正式发布前，由实际运营方补齐并审核法律文本中的真实主体、服务商、联系渠道和数据留存信息。

## 认证运维

[后端认证 runbook](../backend/README.md#authentication-operations) 覆盖部署配置、微信/QQ 注册、短信提供方替换、管理员 bootstrap、密钥轮换、审计与事件响应。认证设计记录位于 [authentication design](./superpowers/specs/2026-07-11-authentication-design.md)。
