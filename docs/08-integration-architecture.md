# 收银、打印与第三方平台集成架构

## 设计目标

- 所有集成默认关闭，可按部署和门店两级启停。
- 第三方故障不能阻塞顾客下单，也不能造成订单事务成功但事件永久丢失。
- 订单核心不依赖美团、京东、某个 POS 或打印机厂商的 SDK。
- 重试使用同一个 `event_id`，connector 必须据此实现幂等。
- 平台凭据、证书和 access token 只存在 connector 或后端密钥系统。

## 组件关系

```text
OrdersService
  └─ 同一事务 ─> integration_outbox
                       │
                 Outbox Worker
                       │ HMAC + schema_version + event_id
          ┌────────────┼──────────────┬──────────────┐
       收银 connector  打印 connector  美团 connector  京东 connector
          │             │               │             │
        POS/ERP      门店打印网关      官方开放平台    官方开放平台
```

直接连接热敏打印机通常要求门店局域网或本地代理，因此服务端实现的是“小票打印网关”连接器，而不是假设云端可以访问 USB/LAN 打印机。美团和京东的正式适配也由 connector 持有官方 SDK、签名规则、证书与审核资质；核心仓库不伪造平台协议。

## 启用条件

每个 provider 同时满足以下条件才会接收事件：

1. 部署环境 `INTEGRATION_<PROVIDER>_ENABLED=true`；
2. connector URL 与至少 32 字符签名密钥已配置；
3. 商家通过 `PATCH /api/merchant/stores/:storeId/integrations/:provider` 为该门店启用；
4. 当前请求用户的 merchant token 包含该门店范围。

支持的 provider：`CASHIER`、`RECEIPT_PRINTER`、`MEITUAN_WAIMAI`、`JD_DAOJIA`。生产 URL 强制 HTTPS。查看能力使用 `GET /api/merchant/stores/:storeId/integrations`。

## 可靠性与安全

- 订单和 outbox 行在一个事务提交；没有启用集成时不写额外事件。
- worker 以条件更新原子认领，支持多实例；进程异常后会回收超过 5 分钟的 claim。
- 失败按 5 秒起步指数退避，最长 1 小时，8 次后进入 `DEAD_LETTER`。
- 签名原文为 `<unix timestamp>.<raw JSON body>`，算法 HMAC-SHA256。
- connector 应校验时间窗、签名、provider、schema version，并以 event ID 去重。
- 错误记录只保存截断后的错误摘要，绝不保存第三方响应正文。

## 协议演进

事件契约位于 `packages/contracts/src/integration.ts`。兼容新增字段可保持版本 1；删除字段、改变含义或类型必须提升 `schema_version`，connector 应在灰度期同时支持新旧版本。支付回调、接单/拒单、配送状态和打印结果属于下一组独立事件，不应复用 `order.created` 的语义。
