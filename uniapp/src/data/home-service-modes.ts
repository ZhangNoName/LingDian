import type { HomeServiceMode } from "@/types/store";

/**
 * Display metadata only. Availability is filtered with the live store contract
 * before these entries are rendered.
 */
export const homeServiceModes: HomeServiceMode[] = [
  { key: "dineIn", title: "到店堂食" },
  { key: "takeaway", title: "门店自取" },
  { key: "delivery", title: "外卖到家" },
];
