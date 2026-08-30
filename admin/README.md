# 零点平台管理后台

Vue 3、TypeScript、Vite 与 Element Plus 构建的经典后台管理系统。

## 本地开发

在仓库根目录执行：

```powershell
corepack pnpm --filter @lingdian/admin dev
```

默认通过 `/api` 代理访问本地后端。请同时启动 `@lingdian/api`。

## 验证

```powershell
corepack pnpm --filter @lingdian/admin test
corepack pnpm --filter @lingdian/admin build
```

## 路由

- `/login`：管理员登录。
- `/accounts/admins`：平台管理员账号、角色和账号状态管理。
- `/accounts/merchants`：商家账号、角色、门店范围和账号状态管理。
- `/accounts/users`：普通用户账号、角色和账号状态管理。
- `/users`：兼容旧链接，重定向至管理员账号列表。
- `/system/logs`：系统日志查询与详情。
- `/profile`：当前管理员个人设置。
- `/password-change`：临时密码强制修改。

菜单与路由使用同一套角色权限规则。隐藏菜单不代表授权，路由守卫和后端 Guard 会分别执行访问检查。

## 模块与依赖方向

```text
router / layout
       │
       ▼
views ─► services ─► auth/api-client ─► auth/session ─► backend /api
  │
  └────► schema-table / dictionaries / permissions
```

- `src/auth`：管理员会话、角色权限、令牌刷新和鉴权请求重试。登录只接受 `admin-api` 且包含 `ADMIN` 或 `SUPER_ADMIN` 角色的会话。
- `src/services`：平台账号和系统日志等业务接口；页面不直接使用无鉴权 `fetch`。
- `src/components/schema-table`：带搜索、字典、分页和异步格式化能力的通用列表页。
- `src/dictionaries`：稳定业务值到展示文案的独立映射，不反向依赖页面或服务。
- `src/views`：页面状态和交互编排；列表请求使用序号防止旧响应覆盖新筛选结果。

## 主题

顶栏支持浅色、深色和跟随系统三种模式。选择保存在 `localStorage` 的 `lingdian-admin-theme` 项中；跟随系统模式会实时响应系统配色变化。

## Schema 列表页

用户管理和系统日志使用 `src/components/schema-table` 中的通用列表组件。列表路由占满应用剩余高度，页面本身不滚动；纵向与横向滚动均由 Element Plus 表格内部处理，分页固定在列表底部，操作列固定在右侧。

最小用法：

```vue
<SchemaTablePage
  v-model:query="query"
  :columns="columns"
  :data="items"
  :pagination="{ page, pageSize, total }"
  @search="load"
  @reset="reset"
  @page-change="changePage"
  @page-size-change="changePageSize"
/>
```

`SchemaColumn` 支持 `dataIndex`、`key`、`width`、`minWidth`、`fixed`、`formatter`、兼容别名 `formater`、`slot`、`showOverflowTooltip`、`isSearch`、`queryKey`、`searchType`、`dictionaryCode` 和直接/异步 `options`。单元格 slot 命名为 `cell-{key}`，搜索控件 slot 命名为 `search-{key}`。自定义操作通过 `SchemaTableActions` 配置为图标按钮，每个按钮必须提供 Tooltip 文案和无障碍标签。

## 字典模块

全局字典位于 `src/dictionaries`，与表格、页面、路由、认证和业务 API 解耦。模块公开注册、查询、标签解析、缓存与失效接口；内置角色、用户状态、日志来源和日志级别字典。

```ts
dictionaryRegistry.register('order_status', [
  {
    value: 'PAID',
    labelKey: 'dict.orderStatus.paid',
    fallbackLabel: '已支付',
  },
])
```

`value` 必须保持稳定，`labelKey` 供未来 i18n 使用，未安装翻译器时显示 `fallbackLabel`。门店等业务动态数据应通过列的 `options` 提供，不应让字典模块反向依赖业务服务。
