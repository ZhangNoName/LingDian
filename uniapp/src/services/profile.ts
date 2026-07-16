import type { UpdateNicknameRequest } from "@lingdian/contracts";
import { request } from "./request";

export const profile = {
  updateNickname(nickname: string): Promise<{ nickname: string }> {
    const data: UpdateNicknameRequest = { nickname };
    return request("/auth/profile/nickname", { method: "PATCH", data });
  },
};
