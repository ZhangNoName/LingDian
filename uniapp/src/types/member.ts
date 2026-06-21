export type UserProfile = {
  id: string;
  avatarUrl?: string;
  maskedPhone: string;
  loggedIn: boolean;
};

export type MemberSummary = {
  levelName: string;
  points: number;
  couponCount: number;
  orderCount: number;
  consumptionAmount: number;
};

export type MemberAssets = {
  balance: number;
  couponCount: number;
};

export type ManageEntry = {
  key: string;
  label: string;
};
