# 管理端组件规范

- 商家端 `web/` 和平台后台 `admin/` 共用 `@lingdian/console-ui`。shadcn-vue 组件源码和配置纳入版本控制，位于 `packages/console-ui/`。
- 两端统一使用 shadcn-vue New York v4。添加基础组件时，从共享包 `components.json` 指定的 `new-york-v4` registry 引入源码，改用包内相对导入和共享图标。
- 页面通过 `@lingdian/console-ui/<组件目录>` 使用基础组件。通用封装基于 New York v4 组件或其 Reka UI 原语，复用 `theme/console.css` 的样式变量。业务封装留在所属应用。
- 管理端不引入其它 UI 组件库。补充跨端 UI 时，复用共享包及现有的 `@lingdian/icons` 图标。
