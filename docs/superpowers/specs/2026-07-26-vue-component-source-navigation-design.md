# Vue 组件源码快捷跳转设计

## 目标

在 `admin` 和 `web` 的本地开发环境中，开发者按住 `Alt` 并左键点击页面元素后，使用 VS Code 打开负责渲染该元素的 Vue 单文件组件，并尽可能定位到对应源码行列。

`uniapp` 不在本次范围内，因为它当前使用 Vite 5，而所选插件的当前版本要求 Vite 6 或更高版本。

## 方案

使用 `vite-plugin-vue-inspector` 7.x。该版本支持项目现有的 Vue 3.5 和 Vite 8，且相比专门的 `vue-click-to-component` 具有更活跃的维护和更广泛的使用。

在 `admin/vite.config.ts` 和 `web/vite.config.ts` 中，将 inspector 放在 Vue 插件之后，并采用以下行为配置：

- `toggleComboKey: 'alt'`：按下 Alt 激活或切换组件检查模式。
- `toggleButtonVisibility: 'never'`：不在业务页面上显示额外的悬浮按钮。
- `disableInspectorOnEditorOpen: true`：完成一次跳转后自动退出检查模式，避免普通点击被持续拦截。
- `launchEditor: 'code'`：明确使用 VS Code 打开源码。
- `viteDevtools: false`：只启用组件源码检查能力，不增加完整 DevTools 面板。

插件仅在 Vite 开发服务器中运行，不进入生产构建。

## 文件与依赖变化

- `admin/package.json`：增加 `vite-plugin-vue-inspector` 开发依赖。
- `web/package.json`：增加同一开发依赖。
- `admin/vite.config.ts`：注册并配置 inspector。
- `web/vite.config.ts`：注册并配置 inspector。
- `pnpm-lock.yaml`：由项目声明的 pnpm 版本更新锁文件。

不修改 Vue 组件、路由或业务运行时入口。

## 交互流程

1. 开发者启动 `admin` 或 `web` 的 Vite 开发服务器。
2. 在页面中按下 Alt，组件检查覆盖层被激活。
3. 光标悬停时显示当前元素对应的 Vue 源码位置。
4. 左键点击后，由本地 Vite 服务调用 VS Code 打开对应文件。
5. 插件自动退出检查模式，页面恢复正常交互。

如果只按 Alt 而未点击，检查模式可能保持开启；再次按 Alt 可关闭。这是插件的切换键语义。

## 错误处理与限制

- VS Code 的 `code` 命令必须能被系统调用；如果无法打开编辑器，应先在 VS Code 中安装 Shell Command 或修复 PATH。
- Element Plus 等来自 `node_modules` 的第三方组件不保证能定位到项目内源码；主要成功路径是项目自己的 `.vue` 组件。
- 浏览器或操作系统可能占用某些 Alt 组合行为。若单独 Alt 与当前环境冲突，可后续改为 `alt-shift`，但本次以用户指定的 Alt 为准。

## 验证

- 使用 `corepack pnpm` 安装依赖，确保遵循仓库声明的 pnpm 版本。
- 分别运行 `admin` 和 `web` 的生产构建，验证 Vite 配置、TypeScript 类型检查及生产打包正常。
- 分别启动开发服务器，确认插件成功加载且终端无配置错误。
- 在浏览器中人工验证：按 Alt、悬停项目组件、左键点击，VS Code 打开对应 `.vue` 文件；随后页面普通点击恢复正常。
