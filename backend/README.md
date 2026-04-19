# Backend

后端已切换为 `Node.js + NestJS`，用于承载点餐、菜单、门店、订单、会员、支付和营销等服务能力。

## 本地开发

```bash
cd backend
npm install
npm run start:dev
```

默认启动后访问：

- `GET /api/health`
- `GET /api/stores/current`
- `GET /api/menu/current`
- `POST /api/orders`

## Prisma

当前后端已经接入 `Prisma`，默认使用 `MySQL`。

### 方式一：从你的 `local.yml` 生成本地 `.env`

```bash
cd backend
npm run db:sync-local-config -- --config "E:\\私人\\local.yml"
```

### 方式二：手动配置 `.env`

```env
DATABASE_URL=mysql://username:password@host:3306/database
```

### 常用命令

```bash
npm run prisma:generate
npm run db:push
npm run prisma:studio
```

## 目录说明

| 路径 | 说明 |
| --- | --- |
| `src/main.ts` | Nest 启动入口 |
| `src/app.module.ts` | 根模块 |
| `src/config/` | 环境变量与应用配置 |
| `src/modules/health/` | 健康检查 |
| `src/modules/stores/` | 门店上下文 |
| `src/modules/menu/` | 菜单与分类 |
| `src/modules/orders/` | 下单能力 |
| `src/prisma/` | Prisma 模块与客户端服务 |
| `prisma/schema.prisma` | 数据模型定义 |

## 环境变量

参考 `.env.example`：

```env
PORT=3000
API_PREFIX=api
NODE_ENV=development
```
