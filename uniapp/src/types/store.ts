export type ServiceMode = "dineIn" | "takeaway" | "delivery";

export type StoreSummary = {
  id: string;
  name: string;
  businessText: string;
  distanceText: string;
  businessStatus: "open" | "closed" | "busy";
  supportModes: ServiceMode[];
};

export type HomeServiceMode = {
  key: ServiceMode;
  title: string;
  subtitle: string;
};
