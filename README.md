# LingDian

零点点餐一体化项目初始化仓库，面向餐饮门店的多端点餐与经营管理场景。

当前技术方向：

- `uniapp/`：用户端小程序/H5，后续可平滑扩展 App
- `web/`：Web 端门户/运营端基础前端
- `backend/`：Node.js + NestJS 服务端
- `theme/`：统一设计令牌，保证 Web 与 uni-app 颜色配置一致
- `docs/`：PRD、架构说明、开发约定

## 当前初始化目标

- 统一三端技术基线
- 建立可复用的品牌主题与颜色令牌
- 搭建点餐业务骨架
- 输出一份可直接推进研发排期的详细 PRD

## 目录说明

| 目录 | 说明 |
| --- | --- |
| `backend/` | NestJS API 服务、业务模块、接口契约 |
| `web/` | Web 前端基础工程，适合官网、门店展示、运营工作台扩展 |
| `uniapp/` | C 端点餐入口，默认面向微信小程序/H5 |
| `theme/` | 单一主题源，包含 `json/css/scss/ts` 四种消费形式 |
| `docs/` | 产品文档、PRD、研发协作文档 |

## 快速开始

### 1. 后端

```bash
cd backend
npm install
npm run start:dev
```

### 2. Web 端

```bash
cd web
pnpm install
pnpm run dev
```

如本机未安装 `pnpm`，也可以使用：

```bash
cd web
npm install
npm run dev
```

### 3. uni-app

```bash
cd uniapp
npm install
npm run dev:h5
```

### 4. Windows 一键启动

```powershell
.\start.ps1 backend
.\start.ps1 web
.\start.ps1 uniapp
.\start.ps1 all
```

## 文档入口

- [产品 PRD](./docs/00-prd.md)
- [文档索引](./docs/README.md)
- [后端说明](./backend/README.md)
