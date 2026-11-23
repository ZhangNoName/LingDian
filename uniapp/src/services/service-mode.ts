import type { ServiceMode } from "@/types/store";

const SERVICE_MODES = new Set<ServiceMode>(["dineIn", "takeaway", "delivery"]);

export function parseServiceMode(value: unknown): ServiceMode | undefined {
  return typeof value === "string" && SERVICE_MODES.has(value as ServiceMode)
    ? value as ServiceMode
    : undefined;
}

export function buildServiceModeUrl(
  path: string,
  mode: ServiceMode,
  parameters: Record<string, string> = {},
): string {
  const query = { ...parameters, mode };
  return `${path}?${Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")}`;
}
