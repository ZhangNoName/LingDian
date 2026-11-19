# 管理端组件规范

- 修改或审查 `web/`、`admin/` 或 `packages/console-ui/` 的界面时，使用项目 skill [$lingdian-console-ui](.codex/skills/lingdian-console-ui/SKILL.md)。

- 商家端 `web/` 和平台后台 `admin/` 共用 `@lingdian/console-ui`。shadcn-vue 组件源码和配置纳入版本控制，位于 `packages/console-ui/`。
- 两端统一使用 shadcn-vue New York v4。添加基础组件时，从共享包 `components.json` 指定的 `new-york-v4` registry 引入源码，改用包内相对导入和共享图标。
- 页面通过 `@lingdian/console-ui/<组件目录>` 使用基础组件。通用封装基于 New York v4 组件或其 Reka UI 原语，复用 `theme/console.css` 的样式变量。业务封装留在所属应用。
- 管理端不引入其它 UI 组件库。补充跨端 UI 时，复用共享包及现有的 `@lingdian/icons` 图标。

## 商家端界面规范

- 页面直接呈现操作所需的信息。省去统计口径、数据来源、导出范围等单独的说明入口。保留字段标签、业务数据、状态、校验和确认提示。收货明细与更多指标等可展开数据使用共享 `Disclosure`。
- 刷新、重试和导出使用 `web/src/components/DataActionButton.vue`。标签用原有业务文案，须能区分当前页、完整报表和完整快照。表格行内操作使用 `TableAction`，其他图标按钮使用共享 `IconButton`。图标按钮提供悬停提示和无障碍名称。
- 表格使用共享 `Table`，分页使用 `TablePagination`。宽表和长表在容器内滚动。调整样式时检查键盘操作、禁用状态、现有筛选和导出范围。
- 商家端日期字段使用 `MerchantDatePicker`，由共享 New York v4 的 `Calendar` 和 `Popover` 组成。表单继续使用 `YYYY-MM-DD` 日期值，时区与查询边界由业务页面处理。
- 圆角由 `theme/console.css` 的组件令牌统一管理，商家端的取值在 `web/src/style.css`。导航项、表格行、筛选区和内嵌信息区使用直角。下拉框使用直角，其他输入控件和表框使用 4px，卡片和浮层使用 6px，状态标签使用 2px。仅开关、单选等有控件语义的形状使用全圆角。页面优先使用布局、分隔线和背景区分层次，圆角交由组件处理。
