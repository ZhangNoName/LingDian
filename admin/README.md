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
- `/users`：全平台用户、角色、门店范围和账号状态管理。
- `/system/logs`：系统日志查询与详情。
- `/profile`：当前管理员个人设置。
- `/password-change`：临时密码强制修改。

菜单与路由使用同一套角色权限规则。隐藏菜单不代表授权，路由守卫和后端 Guard 会分别执行访问检查。

## 主题

顶栏支持浅色、深色和跟随系统三种模式。选择保存在 `localStorage` 的 `lingdian-admin-theme` 项中；跟随系统模式会实时响应系统配色变化。
