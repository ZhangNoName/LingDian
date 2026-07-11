<template>
  <Layout active="profile">
    <view class="page">
      <AppNavBar />
      <ProfileHeader :user="userProfile" :member="member" />
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
import AppNavBar from "@/components/app/AppNavBar.vue";
import ManageGrid from "@/components/profile/ManageGrid.vue";
import MemberBenefitCard from "@/components/profile/MemberBenefitCard.vue";
import ProfileHeader from "@/components/profile/ProfileHeader.vue";
import { manageEntries, member, memberAssets, userProfile } from "@/data/mock";
import Layout from "@/layout/layout.vue";

const servicePhone = "400-888-0123";

function showServicePhone() {
  uni.showModal({
    title: "联系客服",
    content: `客服电话：${servicePhone}`,
    showCancel: false,
    confirmText: "知道了",
  });
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
