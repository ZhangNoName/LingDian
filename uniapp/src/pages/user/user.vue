<template>
  <Layout active="profile">
    <view class="page">
      <AppNavBar />
      <ProfileHeader
        :presentation="customerPresentation"
        :avatar-url="customerProfile?.avatar_data_url"
        @choose-avatar="chooseAvatar"
      />
      <view class="nickname-card">
        <view>
          <text class="nickname-label">昵称</text>
        </view>
        <input v-model="nickname" class="nickname-input" type="nickname" maxlength="32" placeholder="设置昵称" aria-label="昵称" />
        <AppActionButton size="small" :loading="savingNickname" @activate="saveNickname">保存</AppActionButton>
      </view>
      <ManageGrid :entries="manageEntries" @select="handleManageEntry" />
    </view>
  </Layout>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import type { AuthenticatedUser, CustomerProfile } from "@lingdian/contracts";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import ManageGrid from "@/components/profile/ManageGrid.vue";
import ProfileHeader from "@/components/profile/ProfileHeader.vue";
import Layout from "@/layout/layout.vue";
import { customerAuth } from "@/services/auth";
import { requireCustomerAuth } from "@/services/auth-navigation";
import { buildCustomerPresentation } from "@/services/customer-presentation";
import { profile } from "@/services/profile";
import type { ManageEntry } from "@/types/member";

const nickname = ref("");
const savingNickname = ref(false);
const uploadingAvatar = ref(false);
const currentUser = ref<AuthenticatedUser | undefined>(customerAuth.getUser());
const customerProfile = ref<CustomerProfile>();
const customerPresentation = computed(() => buildCustomerPresentation(currentUser.value, customerProfile.value));
const manageEntries: ManageEntry[] = [
  { key: "orders", label: "我的订单", route: "/pages/his/his" },
  { key: "address", label: "地址管理", route: "/pages/address/address" },
];

onShow(async () => {
  if (!(await requireCustomerAuth("/pages/user/user"))) return;
  currentUser.value = customerAuth.getUser();
  try {
    customerProfile.value = await profile.get();
    nickname.value = customerProfile.value.nickname ?? "";
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "资料加载失败", icon: "none" });
  }
});

function handleManageEntry(entry: ManageEntry) {
  if (entry.key === "address") uni.navigateTo({ url: entry.route });
  else uni.redirectTo({ url: entry.route });
}

async function saveNickname() {
  if (!nickname.value.trim()) {
    uni.showToast({ title: "请输入昵称", icon: "none" });
    return;
  }
  savingNickname.value = true;
  try {
    const updated = await profile.updateNickname(nickname.value);
    nickname.value = updated.nickname;
    customerProfile.value = {
      nickname: updated.nickname,
      avatar_data_url: customerProfile.value?.avatar_data_url ?? null,
    };
    uni.showToast({ title: "昵称已保存", icon: "success" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "昵称保存失败", icon: "none" });
  } finally {
    savingNickname.value = false;
  }
}

async function chooseAvatar(event: unknown) {
  if (uploadingAvatar.value) return;
  const avatarUrl = (event as { detail?: { avatarUrl?: string } })?.detail?.avatarUrl;
  if (!avatarUrl) return;
  uploadingAvatar.value = true;
  try {
    customerProfile.value = await profile.uploadAvatar(avatarUrl);
    nickname.value = customerProfile.value.nickname ?? nickname.value;
    uni.showToast({ title: "头像已更新", icon: "success" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "头像上传失败", icon: "none" });
  } finally {
    uploadingAvatar.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100%;
  background: var(--ld-mini-bg);
}

.nickname-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 0 var(--ld-page-padding, 24rpx) 20rpx;
  padding: 20rpx;
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.nickname-label {
  display: block;
}

.nickname-label {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
}

.nickname-input {
  min-width: 0;
  flex: 1;
  padding: 10rpx 12rpx;
  border-radius: 12rpx;
  background: #f7f7f7;
  color: var(--ld-mini-text);
  font-size: 24rpx;
}
</style>
