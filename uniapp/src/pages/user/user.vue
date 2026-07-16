<template>
  <Layout active="profile">
    <view class="page">
      <AppNavBar />
      <ProfileHeader :user="userProfile" :member="member" />
      <view class="nickname-card">
        <view>
          <text class="nickname-label">昵称</text>
          <text class="nickname-hint">昵称可重复，用于向商家展示</text>
        </view>
        <input v-model="nickname" class="nickname-input" maxlength="32" placeholder="设置昵称" />
        <button class="nickname-save" @tap="saveNickname">保存</button>
      </view>
      <MemberBenefitCard :assets="memberAssets" />
      <ManageGrid :entries="manageEntries" />
      <button class="service-btn" @tap="showServicePhone">
        <text class="service-icon">{{ HelpIcon }}</text>
        <text>联系客服</text>
      </button>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { HelpIcon } from "@lingdian/icons/miniapp";
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import ManageGrid from "@/components/profile/ManageGrid.vue";
import MemberBenefitCard from "@/components/profile/MemberBenefitCard.vue";
import ProfileHeader from "@/components/profile/ProfileHeader.vue";
import { manageEntries, member, memberAssets, userProfile } from "@/data/mock";
import Layout from "@/layout/layout.vue";
import { customerAuth } from "@/services/auth";
import { profile } from "@/services/profile";

const servicePhone = "400-888-0123";
const nickname = ref("");

onShow(async () => {
  if (customerAuth.isSignedIn() || (await customerAuth.refresh())) return;
  uni.redirectTo({ url: "/pages/auth/login" });
});

function showServicePhone() {
  uni.showModal({
    title: "联系客服",
    content: `客服电话：${servicePhone}`,
    showCancel: false,
    confirmText: "知道了",
  });
}

async function saveNickname() {
  try {
    const updated = await profile.updateNickname(nickname.value);
    nickname.value = updated.nickname;
    uni.showToast({ title: "昵称已保存", icon: "success" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "昵称保存失败", icon: "none" });
  }
}
</script>

<style scoped>
.page {
  min-height: 100%;
  background: var(--ld-mini-bg);
}

.service-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 72rpx;
  margin: var(--ld-page-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
  line-height: 72rpx;
  box-shadow: var(--ld-mini-shadow-card);
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

.nickname-label,
.nickname-hint {
  display: block;
}

.nickname-label {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
}

.nickname-hint {
  margin-top: 6rpx;
  color: #777777;
  font-size: 22rpx;
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

.nickname-save {
  margin: 0;
  padding: 0 18rpx;
  border-radius: 28rpx;
  background: var(--ld-mini-primary, #ff6b35);
  color: #ffffff;
  font-size: 22rpx;
  line-height: 56rpx;
}

.nickname-save::after {
  border: 0;
}

.service-icon {
  display: block;
  width: 30rpx;
  height: 30rpx;
  font-size: 30rpx;
  line-height: 30rpx;
}

.service-btn::after {
  border: 0;
}
</style>
