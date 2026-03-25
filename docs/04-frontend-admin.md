# 后台：管理前端

## 当前约定技术栈

**Vue 3 + Vite + TypeScript + Element Plus**

与 uni-app 同属 Vue 生态，组件与组合式 API 习惯一致；若团队指定 React / 其他 UI 库，可替换并同步修改本文档与根 `README.md` 表格。

## 工程位置

`frontend-admin/`

## 约定建议

1. **路由**：按业务模块拆分路由表；管理端路由与菜单可由后端返回（动态路由）或前端静态配置 + 权限码控制。
2. **权限**：按钮级权限建议统一指令或封装组件，与后端角色/权限接口对齐。
3. **状态**：Pinia 存放用户会话、字典缓存等；避免在组件中散落写死权限判断逻辑。
4. **API**：与前台共用同一后端时，注意区分 `/api/app/*` 与 `/api/admin/*`（路径仅为示例，以后端实际设计为准）。

## 初始化参考

在 `frontend-admin` 目录执行：

```bash
npm create vite@latest . -- --template vue-ts
```

再安装 Element Plus、Vue Router、Pinia 等依赖，按团队规范配置 ESLint / Prettier。

## 相关文档

- [05-backend-python.md](05-backend-python.md) — 管理端 API 与鉴权
- [06-development-guide.md](06-development-guide.md)
