<template>
  <Layout active="home">
    <view class="page">
      <MemberStrip :member="member" />
      <view class="content">
        <ServiceModeCards :modes="homeServiceModes" @select="goMenu" />
        <RecommendSection :products="products" @select="goSpec" />
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import Layout from "@/layout/layout.vue";
import MemberStrip from "@/components/home/MemberStrip.vue";
import RecommendSection from "@/components/home/RecommendSection.vue";
import ServiceModeCards from "@/components/home/ServiceModeCards.vue";
import { homeServiceModes, member, products } from "@/data/mock";
import type { ServiceMode } from "@/types/store";

function goMenu(_mode: ServiceMode) {
  uni.redirectTo({ url: "/pages/order/order" });
}

function goSpec(_productId: string) {
  uni.navigateTo({ url: "/pages/spec/spec" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--ld-mini-bg);
  padding-top: 24rpx;
}

.content {
  padding: 24rpx;
}

.content :deep(.recommend) {
  margin-top: 28rpx;
}

</style>
