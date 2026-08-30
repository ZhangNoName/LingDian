import type { HomeServiceMode } from "@/types/store";

/**
 * Display metadata only. Availability is filtered with the live store contract
 * before these entries are rendered.
 */
export const homeServiceModes: HomeServiceMode[] = [
  { key: "dineIn", title: "到店堂食", subtitle: "店内就餐" },
  { key: "takeaway", title: "门店自取", subtitle: "到店取餐" },
  { key: "delivery", title: "外卖到家", subtitle: "配送到家" },
];
