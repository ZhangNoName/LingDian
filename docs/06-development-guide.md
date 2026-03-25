# 本地开发与协作

## 前置条件

- Node.js（LTS，与 uni-app / Vite 要求一致）
- Python 3.11+（或团队统一版本）
- 包管理器：npm / pnpm / yarn（三选一，全仓库统一）
- 数据库与缓存：按后端 `README` 与 `.env.example` 准备

## 推荐启动顺序

1. 启动数据库、Redis 等依赖服务（若使用 Docker，可在 `backend` 或后续 `infra` 中提供 `compose` 示例）。
2. 启动 **backend**，确认健康检查与 OpenAPI 文档可访问。
3. 启动 **frontend-admin** 与 **uniapp**，将 API 地址指向本机后端。

## 环境变量

各子项目维护 `.env.example`，说明：

- `API_BASE_URL` 或等价变量
- 跨域与 Cookie 策略（若管理端与 API 不同域）

## Git 忽略

确保忽略：`node_modules/`、`.venv/`、`__pycache__/`、`.env`、各端 `unpackage/` 或 `dist/` 等构建产物。

## 协作流程（建议）

- 功能分支开发，合并前跑 lint 与后端测试。
- 接口变更时同步更新 OpenAPI，并在 PR 说明中标注破坏性变更。

## 发布（概述）

- **backend**：容器化或 systemd + 反向代理；静态文件若由后端托管需单独说明。
- **frontend-admin**：构建静态资源部署到 Nginx / OSS + CDN。
- **uniapp**：按各平台在 HBuilderX 或 CI 中云打包/本地打包。
