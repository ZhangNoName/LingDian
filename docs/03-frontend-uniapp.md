# 前台：uni-app

本文档文件名沿用 `03-frontend-uniapp.md`；仓库内实际工程目录为 **`uniapp/`**。

## 工程位置

`uniapp/`（使用 HBuilderX 或 CLI 创建 uni-app 项目后，将代码置于此目录，或在此目录执行官方脚手架）。

## 约定建议

1. **目录**：按功能模块划分 `pages/`、`components/`、`stores/`（如用 Pinia）、`api/`（封装 HTTP）、`static/`。
2. **请求**：统一 baseURL，从环境变量或 `manifest` / 自定义配置读取；错误与 401 集中处理。
3. **多端差异**：条件编译（`#ifdef`）仅用于平台差异，业务逻辑尽量共用。
4. **与后端联调**：开发期可使用代理或直连后端开发机；生产域名与 HTTPS 在发布配置中区分。

## 初始化参考（CLI）

在 `uniapp` 内可使用官方文档推荐的 `vue-cli` 或 `Vite + uni-app` 模板创建项目，创建完成后将生成文件纳入本仓库。

## 相关文档

- [06-development-guide.md](06-development-guide.md) — 环境变量与联调顺序
