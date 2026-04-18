# 文档中心

当前仓库以 `docs/00-prd.md` 作为第一优先级产品文档，建议研发、设计、测试都先从这份 PRD 开始对齐。

## 推荐阅读顺序

| 文档 | 说明 |
| --- | --- |
| [00-prd.md](./00-prd.md) | 点餐一体化项目详细 PRD，覆盖目标、流程、模块、排期 |
| [07-web-prd.md](./07-web-prd.md) | Web 管理后台页面体系与模块级 PRD |
| [../README.md](../README.md) | 仓库说明与启动方式 |
| [../backend/README.md](../backend/README.md) | 后端 NestJS 工程说明 |

## 当前约定

- 用户端优先建设 `uni-app` 小程序/H5
- `web/` 作为 Web 门户与运营端基础壳
- `backend/` 统一使用 `NestJS`
- `theme/` 作为 Web 与 uni-app 的颜色单一来源

后续如果你需要，我可以继续把这里拆成：

- 信息架构文档
- 接口清单文档
- 数据库设计文档
- 测试用例清单
- 里程碑与排期文档
