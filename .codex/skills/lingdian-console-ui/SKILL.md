---
name: lingdian-console-ui
description: 在 LingDian 仓库实现或审查商家端 web、平台后台 admin 和共享 console-ui 的界面。适用于组件来源、原生控件替换、日期选择、筛选、表格分页、图标操作、说明入口和圆角样式的修改或全局排查。
---

# LingDian 管理端组件规范

先读 [项目组件规范](../../../AGENTS.md)，确定任务涉及商家端、平台后台还是共享组件。通过共享组件修改界面时，检查另一端的默认样式和依赖是否受影响。

## 组件来源

- 两端共用 `packages/console-ui`。新增基础组件时，从 [components.json](../../../packages/console-ui/components.json) 指定的 shadcn-vue New York v4 registry 引入源码，调整为包内相对导入，图标使用 `@lingdian/icons`。通用封装放共享包，业务封装留在所属应用。
- 商家端纯日期字段一律使用 [MerchantDatePicker](../../../web/src/components/MerchantDatePicker.vue)。它组合共享的 [DatePicker](../../../packages/console-ui/src/date-picker/DatePicker.vue)、`Calendar` 和 `Popover`。排查时同时检查共享 `Input` 的 `type="date"` 写法，浏览器日历也从这里弹出。
- 日期迁移保留 `YYYY-MM-DD` 模型、空值、手输、必填和最小日期。时区、开始与结束边界、快捷日期和查询参数在原业务页面处理。弹窗内的日历要验证键盘焦点能进入日历并返回触发按钮。
- 下拉选择使用共享 `Select` 或 `SelectField`。表格和分页使用共享 `Table` 与商家端 `TablePagination`，将宽表和长表的滚动留在表格容器内。

## 商家端界面

- 刷新、重试和导出使用 [DataActionButton](../../../web/src/components/DataActionButton.vue)。表格行内操作使用 `TableAction`，通用图标按钮使用 `IconButton`。保留原有标签、禁用条件、点击事件和导出范围，提供可访问名称和悬停提示。
- 清理仅用于解释统计口径、数据来源、计算方式或导出范围的独立入口。保留实际可展开的业务数据、字段标签、校验、错误反馈和确认提示。业务数据展开使用共享 `Disclosure`。
- 圆角沿用 [共享主题变量](../../../theme/console.css) 和 [商家端变量](../../../web/src/style.css)。导航、下拉框、表格行和内嵌信息区使用直角。由共享组件为常规控件、表框、浮层和卡片应用相应圆角。页面采用分隔线、留白和背景区分层次。

## 审查与验证

- 用户要求全局排查时，搜索整个目标应用的页面、弹窗和子组件。检查原生控件写法、现有共享包装、同类操作和局部圆角覆盖，包括窄屏下才出现的入口。
- 用受影响页面的正常入口验收。日期改动至少检查日历选择、手输、必填、日期范围和原查询结果。有弹窗时检查关闭和焦点回位。表格改动检查表内滚动、分页、行内操作和导出范围。
- 商家端运行 `pnpm run build:web` 和 `pnpm --filter @lingdian/web test`。共享组件修改影响平台后台时运行 `pnpm run build:admin`。
