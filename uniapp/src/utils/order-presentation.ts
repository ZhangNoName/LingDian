import type { OrderSource } from "@/types/order";

const orderSourceLabels: Record<OrderSource, string> = {
  MINIAPP: "小程序",
  MEITUAN_WAIMAI: "美团外卖",
  JD_DAOJIA: "京东到家",
  POS: "收银台",
  MANUAL: "人工录单",
};

export function formatOrderSource(source: OrderSource | string | null | undefined): string {
  if (!source) return "历史订单";
  return orderSourceLabels[source as OrderSource] ?? source;
}

export function resolvePickupCode(orderNo: string, pickupCode: string | null | undefined): string {
  return pickupCode?.trim() || orderNo;
}
