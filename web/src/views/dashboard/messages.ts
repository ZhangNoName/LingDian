export const zh = {
  filters: '日期筛选',
  reset: '重置',
  title: '经营概览', from: '开始日期', to: '结束日期', today: '今天', week: '近 7 天', month: '近 30 天', apply: '查询', refresh: '刷新', language: '语言',
  period: '下单期间', generated: '快照时间', timeZone: '日期时区', export: '导出汇总快照 · CSV', dirty: '日期已更改，请查询后查看和导出。', loading: '正在加载经营数据…', failure: '经营数据加载失败，请重试。', invalid: '请选择有效日期范围，跨度不超过 366 天。', tooLarge: '汇总数量超出安全精度范围，请缩小日期范围。',
  paidAmount: '有效成交额', paid: '有效成交订单', total: '下单数', pending: '待付款订单', operations: '当前待办', openAlerts: '预警待跟进', acknowledgedAlerts: '预警跟进中', outOfStockMaterials: '缺货原料', lowStockMaterials: '低库存原料', pendingFulfillmentOrders: '待履约订单', expiredStockHoldOrders: '到期原料占用',
  variant: '规格',
  top: '成交规格 · 前 10', product: '商品 / 规格', quantity: '售出份数', orderCount: '关联订单数', noSales: '期间没有有效成交订单', byType: '服务方式', orders: '订单数', status: '订单状态', source: '统计口径', cohortHint: '按下单时间归入期间，采用当前状态。有效成交含已付款、备餐中、待取餐、已完成；退款中、已退款、取消和失败不计入成交额。', moneyHint: '金额为 CNY 订单应付金额汇总，不代表现金实收、利润或财务对账。旧名称按订单快照分组；排行只展示前 10 个规格快照。', viewOrders: '查看订单', viewStock: '库存管理', viewAlerts: '预警中心', viewHolds: '查看占用', store: '门店', snapshot: '汇总快照', scope: '范围', current: '当前待办（不限下单日期）',
  DINE_IN: '堂食', TAKEOUT: '配送', PICKUP: '自取', CREATING: '创建中', PENDING_PAYMENT: '待付款', PAID: '已付款', PREPARING: '备餐中', READY: '待取餐', COMPLETED: '已完成', TIMED_OUT: '已超时', REFUNDING: '退款中', REFUNDED: '已退款', CANCELLED: '已取消', FAILED: '失败', DELETED: '已删除',
} as const
export type Key = keyof typeof zh
export const en: Record<Key, string> = {
  filters: 'Date filters',
  reset: 'Reset',
  title: 'Business overview', from: 'Start date', to: 'End date', today: 'Today', week: 'Last 7 days', month: 'Last 30 days', apply: 'Apply', refresh: 'Refresh', language: 'Language',
  period: 'Orders placed during', generated: 'Snapshot time', timeZone: 'Date timezone', export: 'Export summary snapshot · CSV', dirty: 'Dates have changed. Apply them before viewing or exporting.', loading: 'Loading business data…', failure: 'Could not load business data. Please retry.', invalid: 'Choose a valid date range of up to 366 days.', tooLarge: 'Totals exceed safe precision. Narrow the date range.',
  paidAmount: 'Eligible sales', paid: 'Eligible paid orders', total: 'Orders placed', pending: 'Awaiting payment', operations: 'Current tasks', openAlerts: 'Alerts needing follow-up', acknowledgedAlerts: 'Alerts in progress', outOfStockMaterials: 'Out-of-stock materials', lowStockMaterials: 'Low-stock materials', pendingFulfillmentOrders: 'Orders to fulfil', expiredStockHoldOrders: 'Expired ingredient holds',
  variant: 'Variant',
  top: 'Selling variants · top 10', product: 'Product / variant', quantity: 'Units sold', orderCount: 'Distinct orders', noSales: 'No eligible sales in this period', byType: 'Service type', orders: 'Orders', status: 'Order status', source: 'How this is calculated', cohortHint: 'Grouped by order creation time, using current status. Eligible sales include paid, preparing, ready and completed orders. Refunding, refunded, cancelled and failed orders are excluded.', moneyHint: 'CNY order amounts, not cash receipts, profit or financial reconciliation. Historical names remain separate snapshots. Ranking shows the top 10 variant snapshots only.', viewOrders: 'View orders', viewStock: 'Inventory', viewAlerts: 'Stock alerts', viewHolds: 'View holds', store: 'Store', snapshot: 'Summary snapshot', scope: 'Scope', current: 'Current tasks (all order dates)',
  DINE_IN: 'Dine-in', TAKEOUT: 'Delivery', PICKUP: 'Pickup', CREATING: 'Creating', PENDING_PAYMENT: 'Awaiting payment', PAID: 'Paid', PREPARING: 'Preparing', READY: 'Ready', COMPLETED: 'Completed', TIMED_OUT: 'Timed out', REFUNDING: 'Refunding', REFUNDED: 'Refunded', CANCELLED: 'Cancelled', FAILED: 'Failed', DELETED: 'Deleted',
}
