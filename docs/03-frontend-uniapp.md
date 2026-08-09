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

## 微信原生用户能力联调

### 服务端配置

API 部署环境必须配置与 `uniapp/src/manifest.json` 中小程序 AppID 一致的凭据：

```dotenv
WECHAT_MINI_APP_ID=wxxxxxxxxxxxxxxxxx
WECHAT_MINI_APP_SECRET=<仅保存在服务端密钥系统>
```

不要把 AppSecret、微信 access token、openid 或 unionid 写入小程序包、浏览器环境变量或可读日志。生产部署先执行：

```bash
corepack pnpm run db:migrate:deploy
```

迁移会增加用户头像字段、`user_addresses` 地址表和订单 `deliveryAddress` 快照字段。头像只接受 JPEG、PNG、WebP，最大 512 KiB。

### 微信公众平台配置

在小程序管理后台维护与实际代码一致的《用户隐私保护指引》，说明以下数据的用途：

- 手机号：快捷登录、账号合并和配送联系；
- 昵称与头像：用户资料展示；
- 收货人、电话和收货地址：地址簿与配送履约。

代码不会代替运营方完成平台侧隐私声明，也不会在用户拒绝后循环请求授权。拒绝微信手机号时仍可使用短信验证码登录；拒绝地址选择时仍可使用门店自取。

### 构建与验收

```bash
corepack pnpm --filter @lingdian/uniapp test
corepack pnpm --filter @lingdian/uniapp type-check
corepack pnpm --filter @lingdian/uniapp build:mp-weixin
```

将 `uniapp/dist/build/mp-weixin` 导入微信开发者工具，并使用真实开发者或体验账号验收：

1. 同意微信手机号后可直接登录，取消后短信登录仍可用；
2. `chooseAvatar` 选择的头像和 `nickname` 输入的昵称刷新后仍保留；
3. `chooseAddress` 可导入地址，首个地址自动为默认地址，可切换默认与删除；
4. 自取订单不要求地址，配送订单没有地址时不能提交；
5. 配送订单成功后，历史订单地址不随地址簿删除或修改而变化。

开发者工具不能完整替代真机授权与隐私弹窗验证，上线前至少完成一次体验版真机回归。

## 相关文档

- [06-development-guide.md](06-development-guide.md) — 环境变量与联调顺序
