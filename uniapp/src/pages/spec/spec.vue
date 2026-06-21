<template>
  <view class="page">
    <AppNavBar show-back @back="goBack" />
    <ProductHero :product="productDetail" />
    <view class="info">
      <view>
        <text class="name">招牌随心3拼</text>
        <text class="tag">超值自选</text>
      </view>
      <QuantityStepper v-model="quantity" />
    </view>
    <OptionGroup
      v-for="group in productDetail.optionGroups"
      :key="group.id"
      :group="group"
      :selected-id="selected[group.id]"
      @select="selectOption"
    />
    <SpecActionBar :selected-options="selectedOptions" @buy="goCheckout" @add="goMenu" />
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import OptionGroup from "@/components/spec/OptionGroup.vue";
import ProductHero from "@/components/spec/ProductHero.vue";
import QuantityStepper from "@/components/spec/QuantityStepper.vue";
import SpecActionBar from "@/components/spec/SpecActionBar.vue";
import { productDetail } from "@/data/mock";
import type { SelectedOption } from "@/types/menu";

const quantity = ref(1);
const selected = reactive<Record<string, string>>({
  [productDetail.optionGroups[0].id]: productDetail.optionGroups[0].options[0].id,
});

const selectedOptions = computed<SelectedOption[]>(() => {
  return productDetail.optionGroups.flatMap((group) => {
    const optionId = selected[group.id];
    const option = group.options.find((item) => item.id === optionId);
    return option ? [{ groupId: group.id, optionId: option.id, name: option.name, imageUrl: option.imageUrl }] : [];
  });
});

function selectOption(groupId: string, optionId: string) {
  selected[groupId] = optionId;
}

function goBack() {
  uni.navigateBack();
}

function goCheckout() {
  uni.navigateTo({ url: "/pages/checkout/checkout" });
}

function goMenu() {
  uni.redirectTo({ url: "/pages/order/order" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: 260rpx;
  background: #ffffff;
}

.info {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 36rpx 32rpx 44rpx;
}

.name {
  display: block;
  margin-bottom: 18rpx;
  color: var(--ld-mini-text);
  font-size: 44rpx;
  font-weight: 900;
}

.tag {
  display: inline-flex;
  padding: 4rpx 10rpx;
  border: 1rpx solid #f3a1a6;
  color: var(--ld-mini-primary);
  font-size: 24rpx;
}
</style>
