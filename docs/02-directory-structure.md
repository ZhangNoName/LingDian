# 目录与职责

```text
LingDian/
├── admin/                  # 平台管理端
├── backend/                # NestJS API
│   └── src/modules/        # 按业务能力组织的 Nest 模块
├── common/                 # 通用响应码和无状态工具
├── packages/
│   ├── contracts/          # 跨端 API/事件契约
│   ├── db/                 # Prisma schema、迁移、Client
│   ├── icons/              # 跨端图标边界
│   └── observability/      # 客户端日志协议
├── theme/                  # 设计令牌单一来源
├── uniapp/                 # 消费者小程序/H5
│   └── src/infra/http/     # 可替换传输与 API envelope 协议
├── web/                    # 商家经营工作台
├── scripts/                # 仓库级结构与部署验证
└── docs/                   # 产品、架构、联调与运维文档
```

## 放置规则

| 内容 | 位置 | 禁止做法 |
| --- | --- | --- |
| 页面 ViewModel、交互状态 | 对应前端工程 | 放入共享 API contracts |
| API 请求/响应和跨进程事件 | `packages/contracts/` | 直接把 Prisma 类型暴露给前端 |
| 数据表与迁移 | `packages/db/prisma/` | 在业务模块内散落 SQL |
| 领域用例 | `backend/src/modules/<domain>/` | controller 直接操作 Prisma |
| 外部协议 | connector 或 `integrations` adapter | 在订单 service 中写平台判断分支 |
| 颜色与语义令牌 | `theme/` | 页面继续增加重复的品牌色常量 |
| 密钥 | 部署密钥系统/后端环境变量 | 提交 `.env` 或写入前端变量 |

## 后端模块结构约定

模块较小时可保持 controller/service/dto 扁平结构；超过约 500 行或同时包含查询、命令、映射、外部 IO 时，拆为 `application/`、`domain/`、`ports/`、`adapters/`。`integrations` 已按端口与 adapter 边界组织；`products.service.ts` 仍偏大，后续新增库存或价格规则前应优先拆为 catalog query、product command、configuration 三个应用服务。

## 生成物

`node_modules/`、`dist/`、`build/`、覆盖率、真实 `.env` 都是生成物或本地状态，必须保持忽略。数据库结构变更必须同时提交 Prisma schema 与迁移文件。
