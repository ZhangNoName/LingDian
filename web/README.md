# 零点商家工作台

Vue 3、TypeScript、Vite、Element Plus 与 Tailwind CSS 构建的商家端。当前已经接入门店、商品、订单、账号安全和外部集成能力。

## 本地开发

在仓库根目录执行：

```powershell
corepack pnpm --filter @lingdian/web dev
```

默认通过 `/api` 访问本地后端。跨域或独立部署时可设置 `VITE_API_BASE`，业务服务必须通过 `src/config/api.ts` 生成请求地址，不应写死 `/api`。

## 验证

```powershell
corepack pnpm --filter @lingdian/web test
corepack pnpm --filter @lingdian/web build
```

## 架构与依赖方向

```text
router / layouts
       │
       ▼
views ──────────► feature helpers
  │                    │
  ▼                    ▼
services ───────► @lingdian/contracts
  │
  ▼
lib/api ─► auth/api-client ─► auth/session ─► backend /api
```

- `src/router`：公开页、登录守卫、强制改密和模块路由。
- `src/layouts`、`src/components/layout`：应用外壳、侧栏、顶栏与显式退出入口。
- `src/views`：页面编排；复杂数据转换和请求不直接堆在页面中。
- `src/services`：按业务域封装接口、查询参数和 URL 编码。
- `src/auth`：内存访问令牌、HttpOnly 刷新会话、单飞刷新、鉴权请求重试和安全回跳。
- `src/config`：API 根地址、生产功能开关、导航与快捷操作。
- `src/baseComponents`：无业务依赖的基础 UI。组件实现不应反向导入自己的 barrel 文件。
- `@lingdian/contracts`：前后端共享的订单、认证和集成类型。

页面只负责状态编排和交互；可测试的查询序列化、展示映射、草稿归一化与行内编辑状态放在 service 或同域 helper 中。异步列表与详情加载使用请求序号，避免旧响应覆盖新筛选结果。

## 已开放路由

- `/`：工作台，仅展示已经接入的能力和明确的数据空态。
- `/stores`：当前主门店信息与营业状态。
- `/products`：商品、SKU、选择组与价格库存维护。
- `/orders`：订单筛选、详情、状态流转与逻辑删除。
- `/settings`：外部集成配置。
- `/profile/nickname`、`/password/change`：账号资料与安全设置。

会员、营销、分析、仓库和财务页面仍是规划占位模块，默认不会注册路由或出现在导航。仅本地演示需要时可显式设置 `VITE_ENABLE_PLANNED_MODULES=true`；生产环境不应启用该开关。

## 认证与请求约束

- 访问令牌仅保存在内存中；刷新令牌由后端 HttpOnly Cookie 管理。
- 页面请求统一经过 `requestData`，401 时只执行一次共享刷新并重试原请求。
- 登录只接受 `merchant-api` 且包含 `MERCHANT` 角色的会话。
- 登录后的 `redirect` 必须是站内绝对路径，外链、协议相对路径和反斜杠路径会回退到 `/`。
- 在线支付的支付与退款状态只能由经过校验的支付回调推进；商家后台只允许现金订单手工确认收款或退款。
