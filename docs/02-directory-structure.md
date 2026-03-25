# 目录与职责

## 顶层布局

```
LingDian/
├── README.md
├── docs/                    # 项目文档（本目录）
├── uniapp/                  # uni-app 前台工程
├── frontend-admin/          # 管理后台 Web 工程
└── backend/                 # Python 后端工程
```

## 职责划分

| 路径 | 职责 | 不应包含 |
|------|------|----------|
| `uniapp/` | 页面、组件、前台路由、静态资源、各端构建配置 | 服务端密钥、数据库连接串 |
| `frontend-admin/` | 后台布局、菜单权限展示、运营类页面 | 同上 |
| `backend/` | 路由、领域逻辑、ORM/仓储、迁移脚本、配置模板 | 大型前端构建产物（可选仅部署静态到 CDN 时例外） |

## 共享约定

- **API 契约**：以后端 OpenAPI 为准；前端类型可用工具从 OpenAPI 生成（可选）。
- **环境变量**：各子项目独立 `.env.example`，真实密钥不入库。
- **版本号**：根目录 `README` 或 `CHANGELOG` 可记录整体发版；各子项目保留自身 `package.json` / `pyproject.toml` 版本字段。

## 可选扩展

若仓库增大，可增加：

- `packages/` — 前后端共享的 TypeScript 类型或常量（monorepo）
- `scripts/` — 一键安装、代码生成、部署脚本
- `infra/` — Docker Compose、K8s 清单、CI 配置片段
