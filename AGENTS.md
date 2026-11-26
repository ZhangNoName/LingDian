# 本地启动与数据库

- “本地启动”指在本机运行 LingDian 应用服务。每次启动或重启本地 API，都必须连接唯一指定的远程 MySQL 库 `lingdian_cf_preview`，沿用 `backend/.env` 中的 `DATABASE_URL`。
- 启动前检查 `127.0.0.1:43306` 是否已通过 SSH 转发到腾讯云 Lighthouse（`lighthouse@81.70.43.189`）的 `127.0.0.1:3306`。转发未运行时先恢复，再验证实际数据库名和 API readiness。端口指向其他实例或远程库暂时不可达时，先排查连接并汇报阻塞，不启动或切换到本地库、演示库或其他远程库。
- 启动流程不对远程库执行 `db:push`、迁移、seed、账号初始化或数据重置。数据库凭据仅从现有本地配置读取，不写入仓库或输出到日志。

# 管理端组件规范

- 修改或审查 `web/`、`admin/` 或 `packages/console-ui/` 的界面时，使用项目 skill [$lingdian-console-ui](.codex/skills/lingdian-console-ui/SKILL.md)。

- 商家端 `web/` 和平台后台 `admin/` 共用 `@lingdian/console-ui`。shadcn-vue 组件源码和配置纳入版本控制，位于 `packages/console-ui/`。
- 两端统一使用 shadcn-vue New York v4。添加基础组件时，从共享包 `components.json` 指定的 `new-york-v4` registry 引入源码，改用包内相对导入和共享图标。
- 页面通过 `@lingdian/console-ui/<组件目录>` 使用基础组件。通用封装基于 New York v4 组件或其 Reka UI 原语，复用 `theme/console.css` 的样式变量。业务封装留在所属应用。
- 管理端不引入其它 UI 组件库。补充跨端 UI 时，复用共享包及现有的 `@lingdian/icons` 图标。

## 管理端滚动规范

- 页面由主内容区承担纵向滚动，侧栏和页头保持可见。主内容区可收缩，仅在内容溢出时滚动。
- 弹窗和抽屉按动态视口高度（`dvh`）限制外框尺寸，标题栏、关闭入口和公共底部按钮保持可见。长内容只滚动正文，正文设置 `min-h-0`、`overflow-y-auto` 和 `overscroll-contain`。打开模态弹窗时锁定背景滚动。
- 宽表横向滚动、长表纵向滚动均由表格容器承担。表格纵向滚动时保持表头可见，筛选、工具栏和分页放在表格滚动区外。避免同一块内容出现两层同方向滚动。
- 验收覆盖长短内容、手机窄屏和低高度视口。检查鼠标滚轮、触摸和键盘能滚到正文末尾，固定区域不遮挡内容和焦点，关闭弹窗后焦点回到触发入口。

## 商家端界面规范

- 页面直接呈现操作所需的信息。省去统计口径、数据来源、导出范围等单独的说明入口。保留字段标签、业务数据、状态、校验和确认提示。收货明细与更多指标等可展开数据使用共享 `Disclosure`。
- 刷新、重试和导出使用 `web/src/components/DataActionButton.vue`。标签用原有业务文案，须能区分当前页、完整报表和完整快照。表格行内操作使用 `TableAction`，其他图标按钮使用共享 `IconButton`。图标按钮提供悬停提示和无障碍名称。
- 表格使用共享 `Table`，分页使用 `TablePagination`。宽表和长表在容器内滚动。调整样式时检查键盘操作、禁用状态、现有筛选和导出范围。
- 商家端日期字段使用 `MerchantDatePicker`，由共享 New York v4 的 `Calendar` 和 `Popover` 组成。表单继续使用 `YYYY-MM-DD` 日期值，时区与查询边界由业务页面处理。
- 商家端基础控件沿用 shadcn-vue New York v4 的圆角和阴影，使用中性底色与零点紫色主色。主题变量在 `theme/console.css` 和 `web/src/style.css` 中管理。页面优先使用布局、分隔线和背景区分层次，圆角交由组件处理。

## App 界面文案

- `mobile/` 的页面和弹窗直接呈现操作所需的信息。省去重复标题、统计口径和实现方式说明。保留字段标签、业务数据、状态、校验、错误恢复和必要的确认提示。
- 商品列表、详情和编辑统一过滤历史 AI 图片示意文案，保留真实商品说明。
