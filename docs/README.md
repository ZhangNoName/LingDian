# 文档中心

本目录存放 LingDian 的设计说明与开发约定，按阅读顺序编号。

| 文档 | 内容 |
|------|------|
| [01-overview.md](01-overview.md) | 目标、技术选型、系统边界 |
| [02-directory-structure.md](02-directory-structure.md) | 仓库目录约定与模块职责 |
| [03-frontend-uniapp.md](03-frontend-uniapp.md) | uni-app 前台约定（工程目录 `uniapp/`） |
| [04-frontend-admin.md](04-frontend-admin.md) | 管理后台前端约定 |
| [05-backend-python.md](05-backend-python.md) | Python 后端分层与 API 约定 |
| [06-development-guide.md](06-development-guide.md) | 环境、启动顺序、联调与发布 |

接口契约建议以 OpenAPI（Swagger）为单一事实来源，生成物可放在 `docs/api/`（由后端导出后提交，或 CI 生成）。
