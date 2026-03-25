# 后端：Python

## 推荐默认方案

**Python 3.11+ + FastAPI + Uvicorn**，数据库与 ORM 按业务选用（如 SQLAlchemy 2.x + Alembic 迁移）。

选用 Django 或 Flask 时，仍可沿用本文档中的「分层思想」与「API 版本化」原则，仅实现细节不同。

## 工程位置

`backend/`

## 分层建议

| 层 | 职责 |
|----|------|
| `api/` 或 `routers/` | HTTP 路由、依赖注入、请求/响应模型（Pydantic） |
| `services/` | 用例与业务流程 |
| `repositories/` 或 `crud/` | 数据访问 |
| `models/` | ORM 模型或领域实体 |
| `core/` | 配置、安全（JWT/密码）、日志 |

## API 约定

- 版本前缀：如 `/api/v1/...`，便于演进。
- 用户端与管理端：可用不同路由前缀或不同应用挂载，鉴权策略分离。
- 文档：FastAPI 自带 OpenAPI，可导出 `openapi.json` 供前端生成类型（可选）。

## 配置与安全

- 使用 `pydantic-settings` 或等价方式读取环境变量；提供 `.env.example`。
- 密钥、数据库 URL、第三方 Client Secret 禁止提交到 Git。

## 相关文档

- [06-development-guide.md](06-development-guide.md) — 虚拟环境、运行方式
