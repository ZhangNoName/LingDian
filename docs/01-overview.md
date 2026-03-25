# 项目总览

## 目标

构建「用户端 + 运营后台 + 统一 API」的一体化工程：多端前台用 uni-app，运营管理用 Web 后台，数据与权限由 Python 后端提供。

## 技术选型（当前约定）

| 层级 | 技术 | 说明 |
|------|------|------|
| 前台 | uni-app（Vue 语法） | 可发布到小程序、App、H5 等 |
| 后台 | Vue 3 + Vite + Element Plus | 与 Vue 生态一致，便于组件与类型习惯复用；若团队更熟悉 React，可改为 React + Ant Design |
| 后端 | Python 3.x +（推荐）FastAPI | 异步友好、自动生成 OpenAPI；亦可选用 Django / Flask，见 [05-backend-python.md](05-backend-python.md) |

## 系统边界

- **uniapp**：面向终端用户；仅调用后端公开或用户态 API；令牌与敏感信息按平台安全规范存储。
- **frontend-admin**：面向内部运营；调用管理态 API，通常需独立鉴权与更严格的权限模型。
- **backend**：唯一业务数据源；负责鉴权、校验、持久化及与第三方服务集成。

## 后续可补充文档

- 业务领域模型与用例
- 安全与合规（日志脱敏、密钥管理）
- 部署拓扑与环境（开发 / 测试 / 生产）
