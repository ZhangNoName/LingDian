<template>
  <Layout active="profile">
    <view class="page">
      <AppNavBar />
      <ProfileHeader :user="userProfile" :member="member" />
      <MemberBenefitCard :member="member" />
      <AssetCards :assets="memberAssets" />
      <ManageGrid :entries="manageEntries" />
    </view>
  </Layout>
</template>

<script setup lang="ts">
import AppNavBar from "@/components/app/AppNavBar.vue";
import AssetCards from "@/components/profile/AssetCards.vue";
import ManageGrid from "@/components/profile/ManageGrid.vue";
import MemberBenefitCard from "@/components/profile/MemberBenefitCard.vue";
import ProfileHeader from "@/components/profile/ProfileHeader.vue";
import { manageEntries, member, memberAssets, userProfile } from "@/data/mock";
import Layout from "@/layout/layout.vue";
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--ld-mini-bg);
}
</style>
