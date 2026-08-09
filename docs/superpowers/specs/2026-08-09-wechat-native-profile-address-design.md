# 微信原生登录、用户资料与收货地址设计

## 目标

在现有 uni-app 微信小程序和 NestJS API 上补齐一条可上线的微信原生用户链路：用户可用微信授权手机号一键登录，填写微信昵称与选择头像，导入并管理微信收货地址，并在结算时选择自取或配送地址。用户拒绝微信授权时，现有手机号验证码登录和门店自取仍可使用。

## 现状与约束

- 小程序已配置 AppID，并已有 `uni.login` → 服务端 `jscode2session` → 手机号短信绑定的微信身份链路。
- 用户表只有昵称；“地址管理”仍不可用；结算固定提交 `pickup` 订单。
- 微信当前头像昵称能力要求使用 `button open-type="chooseAvatar"` 和 `input type="nickname"`，不使用旧式静默用户资料接口。
- `getPhoneNumber` 回调的动态 code 与 `wx.login` code 不同，均为一次性凭证；手机号 code 由服务端消费。
- `wx.chooseAddress` 只能由明确的用户点击触发；取消或拒绝不应被当作系统错误。
- 所有微信 AppSecret 与 access token 只存在于服务端，不下发到小程序。
- 收货地址和手机号属于敏感信息，只采集实现登录、资料展示和配送所需的最小字段。

## 方案比较

### 方案 A：仅在小程序本地调用微信 API

直接把微信资料和地址写入本地缓存。开发量最小，但换设备会丢失，无法校验地址归属，也无法形成可靠订单快照，因此不采用。

### 方案 B：服务端保存资料与地址，但结算仍只支持自取

能完成个人中心能力，风险较低，但“收货地址”与真实业务没有闭环，用户导入地址后无法使用，因此不采用。

### 方案 C：微信一键登录 + 资料持久化 + 地址管理 + 配送结算

完整打通微信手机号、微信身份、用户资料、地址和订单快照。改动覆盖契约、数据库、API 和小程序，但每部分边界清晰，且能保留现有短信登录和自取路径。采用此方案。

## 交互设计

### 登录

1. 微信小程序登录页首屏显示“微信手机号快捷登录”主按钮，按钮使用 `open-type="getPhoneNumber"`。
2. 用户同意后，小程序取得手机号动态 code，再调用 `uni.login` 获取微信登录 code，一次提交给服务端。
3. 服务端分别向微信换取手机号和 `openid/unionid`，按已验证手机号查找或创建用户，再原子绑定微信身份并签发当前会话。
4. 用户取消、拒绝或微信接口不可用时，页面保留现有手机号 + 短信验证码表单。拒绝只显示中性提示，不循环弹窗。
5. 重复提交由按钮 loading 状态阻止；一次性 code 消费失败时允许用户重新点击获取新 code。

### 用户资料

1. “我的”页加载服务端资料，展示已保存昵称和头像。
2. 微信端昵称输入使用 `type="nickname"`，用户可以选择微信建议昵称，也可以手工输入；保存仍走现有昵称 API。
3. 头像按钮使用 `open-type="chooseAvatar"`。选择后立即上传，服务端只接受 JPEG/PNG/WebP 且最大 512 KiB；头像二进制保存在用户记录中，资料接口返回可直接展示的数据 URL。
4. 未设置头像时继续展示现有占位样式。上传失败不影响昵称和其他页面。

### 地址管理

1. “我的”页启用“地址管理”，进入地址列表页。
2. “从微信导入地址”由用户点击触发 `uni.chooseAddress`（微信端编译为 `wx.chooseAddress`）。
3. 导入结果映射为收货人、手机号、省/市/区/街道、详细地址、邮编和国家码后提交服务端。
4. 首个地址自动设为默认；后续地址可设为默认或删除。同一用户导入完全相同的地址时返回既有记录，不重复创建。
5. 每个用户最多保存 20 个地址。删除默认地址后，按最近更新时间选择新的默认地址。
6. 用户取消微信地址选择时不提示错误；其他失败显示可重试提示。H5 等非微信平台保留页面，但隐藏微信导入按钮并提示当前平台不支持。

### 结算与订单

1. 结算页提供“门店自取 / 配送到家”切换，默认仍为门店自取，避免改变现有用户路径。
2. 选择配送时加载默认地址；没有地址时引导进入地址管理或直接从微信导入。
3. 配送提交必须携带 `addressId`。服务端验证地址属于当前用户，使用地址中的收货人和手机号，并把完整地址文本写入订单快照。
4. 自取继续提交 `pickup`；配送提交 `takeout`。删除或修改地址不会改变历史订单上的地址快照。
5. 未选择配送地址时禁用提交并给出明确提示；网络或微信授权失败时购物车不清空。

## 架构与数据流

- `packages/contracts` 定义微信手机号登录、用户资料、用户地址和订单配送字段，前后端共享。
- `WechatOAuthProvider` 负责 `jscode2session`、稳定 access token 获取与手机号动态 code 消费；`OAuthService` 负责用户查找、身份绑定和事务一致性。
- `ProfileService` 负责昵称、头像格式/大小校验和资料读取。
- 新的 `UserAddressService` 负责地址归属、去重、默认地址不变量和数量限制。
- `OrderService` 只通过 `addressId` 读取当前用户地址，并生成不可变配送快照。
- 小程序服务层隔离微信 API、HTTP 请求和错误归类；页面只维护 loading、空态、选择态和导航。

## 数据模型

### User 扩展

- `avatarData Bytes?`：头像二进制，数据库使用长二进制字段。
- `avatarMimeType String?`：限定 `image/jpeg`、`image/png`、`image/webp`。
- 与 `UserAddress` 建立一对多关系。

### UserAddress

- `id`, `userId`
- `recipientName`, `phoneNumber`
- `provinceName`, `cityName`, `countyName`, `streetName`
- `detailInfo`, `postalCode`, `nationalCode`
- `isDefault`, `createdAt`, `updatedAt`
- 索引：`userId, isDefault` 和 `userId, updatedAt`

### Order 扩展

- `deliveryAddress String?`：创建配送订单时写入格式化后的完整地址快照。

## API

- `POST /auth/wechat/miniapp/phone-login`：输入 `loginCode`、`phoneCode`、`audience=user-api`，返回现有 `AuthTokens` 并设置刷新 cookie。
- `GET /auth/profile`：返回 `{ nickname, avatar_data_url }`。
- `POST /auth/profile/avatar`：multipart 字段 `avatar`，返回更新后的资料。
- `GET /addresses`：返回当前用户地址，默认地址优先。
- `POST /addresses`：导入/创建地址；完全相同则返回既有地址。
- `PATCH /addresses/:id/default`：原子切换默认地址。
- `DELETE /addresses/:id`：删除自己的地址并修复默认地址。
- `POST /order/create`：配送订单新增可选 `addressId`；`takeout` 时必填并校验。

所有资料、地址和配送订单 API 使用现有 access-token guard 与 user-api guard。头像接口额外执行 MIME、文件大小和空文件校验。

## 错误与隐私处理

- 将微信用户主动取消和拒绝归为 `cancelled`，不记录为故障、不反复提示授权。
- 微信服务端返回错误时不向客户端透传 AppSecret、access token、openid、unionid 或原始响应；日志只记录错误码和操作类型。
- access token 在进程内按过期时间缓存，并预留 5 分钟刷新余量；微信明确提示 token 失效时强制刷新一次后重试。
- 地址接口永远按当前 `userId` 查询，禁止通过地址 ID 越权读取、修改或用于下单。
- 页面文案说明用途；小程序后台仍需由运营方配置与实际字段一致的《用户隐私保护指引》。代码不伪造用户同意。

## 测试与验收

- 后端单元测试覆盖：手机号 code 交换、微信身份与手机号合并、并发/重复绑定、资料头像校验、地址去重/默认切换/删除、地址越权、配送订单快照。
- 小程序单元测试覆盖：微信手机号事件分类、地址结果映射、取消不报错、地址 API 请求、结算模式和无地址拦截。
- 回归运行 contracts/db 构建、后端测试与构建、uni-app 测试、类型检查和微信小程序构建。
- 手工验收清单：拒绝微信手机号后短信登录可用；选择昵称头像可刷新后保留；微信地址可导入、设默认、删除；自取无需地址；配送必须选择自己的地址；历史订单地址不随地址簿变化。

## 官方依据

- [头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)
- [手机号快速验证组件](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html)
- [获取手机号服务端接口](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/phone-number/getPhoneNumber.html)
- [wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)
- [wx.chooseAddress](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/address/wx.chooseAddress.html)

