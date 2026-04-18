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

## 环境变量

参考 `.env.example`：

```env
PORT=3000
API_PREFIX=api
NODE_ENV=development
```
