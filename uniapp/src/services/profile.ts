import type { ApiEnvelope, CustomerProfile, UpdateNicknameRequest } from "@lingdian/contracts";
import { API_BASE } from "@/config/api";
import { customerAuth } from "./auth";
import { request } from "./request";

class AvatarUploadError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
  }
}

function uploadAvatarOnce(filePath: string): Promise<CustomerProfile> {
  return new Promise((resolve, reject) => {
    const token = customerAuth.getAccessToken();
    if (!token) {
      reject(new AvatarUploadError("登录状态已失效，请重新登录。", 401));
      return;
    }
    uni.uploadFile({
      url: `${API_BASE}/auth/profile/avatar`,
      filePath,
      name: "avatar",
      header: { Authorization: `Bearer ${token}` },
      success(response) {
        let envelope: ApiEnvelope<CustomerProfile> | undefined;
        try {
          envelope = JSON.parse(response.data) as ApiEnvelope<CustomerProfile>;
        } catch {
          reject(new AvatarUploadError("头像上传失败，请稍后重试。", response.statusCode));
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300 && envelope.code === 0) {
          resolve(envelope.data);
          return;
        }
        reject(new AvatarUploadError(
          response.statusCode === 401 ? "登录状态已失效，请重新登录。" : "头像上传失败，请稍后重试。",
          response.statusCode,
        ));
      },
      fail(error) {
        reject(new AvatarUploadError(error.errMsg || "头像上传失败，请稍后重试。"));
      },
    });
  });
}

export const profile = {
  get(): Promise<CustomerProfile> {
    return request("/auth/profile");
  },

  updateNickname(nickname: string): Promise<{ nickname: string }> {
    const data: UpdateNicknameRequest = { nickname };
    return request("/auth/profile/nickname", { method: "PATCH", data });
  },

  async uploadAvatar(filePath: string): Promise<CustomerProfile> {
    try {
      return await uploadAvatarOnce(filePath);
    } catch (error) {
      if (!(error instanceof AvatarUploadError) || error.statusCode !== 401 || !(await customerAuth.refresh())) {
        throw error;
      }
      return uploadAvatarOnce(filePath);
    }
  },
};
