<template>
  <Layout :show-tab-bar="false">
    <view class="page">
      <AppNavBar title="收货地址" show-back @back="goBack" />

      <view v-if="loading" class="state-card"><text>正在加载地址…</text></view>
      <view v-else-if="addressList.length === 0" class="state-card empty-card">
        <text class="state-title">还没有收货地址</text>
        <text class="state-hint">从微信选择已有地址，配送下单时可以直接使用。</text>
      </view>

      <view v-else class="address-list">
        <view v-for="item in addressList" :key="item.id" class="address-card">
          <view class="address-heading">
            <view class="recipient-row">
              <text class="recipient">{{ item.recipientName }}</text>
              <text class="phone">{{ item.phoneNumber }}</text>
            </view>
            <text v-if="item.isDefault" class="default-badge">默认</text>
          </view>
          <text class="address-text">{{ formatAddress(item) }}</text>
          <view class="address-actions">
            <button v-if="!item.isDefault" class="action-button" :disabled="busyId === item.id" @tap="setDefault(item.id)">设为默认</button>
            <button class="action-button danger" :disabled="busyId === item.id" @tap="removeAddress(item.id)">删除</button>
          </view>
        </view>
      </view>

      <view class="bottom-action">
        <button v-if="wechatImportSupported" class="import-button" :loading="importing" :disabled="importing" @tap="importFromWechat">从微信导入地址</button>
        <text v-else class="unsupported-hint">当前平台不支持微信地址导入</text>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import type { UserAddress } from "@lingdian/contracts";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import Layout from "@/layout/layout.vue";
import { addresses } from "@/services/addresses";
import { requireCustomerAuth } from "@/services/auth-navigation";
import { chooseWechatAddress } from "@/services/wechat-capabilities";

const addressList = ref<UserAddress[]>([]);
const loading = ref(true);
const importing = ref(false);
const busyId = ref("");
const wechatImportSupported = computed(() => typeof uni.chooseAddress === "function");

onShow(async () => {
  if (!(await requireCustomerAuth("/pages/address/address"))) return;
  await loadAddresses();
});

async function loadAddresses() {
  loading.value = true;
  try {
    addressList.value = await addresses.list();
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "地址加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function importFromWechat() {
  importing.value = true;
  try {
    const selected = await chooseWechatAddress();
    if (selected.status === "cancelled") return;
    await addresses.create(selected.address);
    await loadAddresses();
    uni.showToast({ title: "地址已导入", icon: "success" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "地址导入失败", icon: "none" });
  } finally {
    importing.value = false;
  }
}

async function setDefault(addressId: string) {
  busyId.value = addressId;
  try {
    await addresses.setDefault(addressId);
    await loadAddresses();
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "默认地址设置失败", icon: "none" });
  } finally {
    busyId.value = "";
  }
}

async function removeAddress(addressId: string) {
  if (!(await confirmDelete())) return;
  busyId.value = addressId;
  try {
    await addresses.remove(addressId);
    await loadAddresses();
    uni.showToast({ title: "地址已删除", icon: "success" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "地址删除失败", icon: "none" });
  } finally {
    busyId.value = "";
  }
}

function confirmDelete(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: "删除地址",
      content: "确认删除这个收货地址？",
      confirmText: "删除",
      confirmColor: "#d93025",
      success(result) { resolve(result.confirm); },
      fail() { resolve(false); },
    });
  });
}

function formatAddress(address: UserAddress): string {
  return `${address.provinceName}${address.cityName}${address.countyName}${address.streetName}${address.detailInfo}`;
}

function goBack() {
  uni.navigateBack();
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: calc(132rpx + env(safe-area-inset-bottom));
  background: var(--ld-mini-bg);
}

.state-card,
.address-card {
  margin: 0 var(--ld-page-padding, 24rpx) 20rpx;
  padding: 28rpx;
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.empty-card {
  padding: 72rpx 32rpx;
  text-align: center;
}

.state-title,
.state-hint {
  display: block;
}

.state-title {
  color: var(--ld-mini-text);
  font-size: 30rpx;
  font-weight: 900;
}

.state-hint {
  margin-top: 14rpx;
  color: #777777;
  font-size: 24rpx;
  line-height: 1.5;
}

.address-heading,
.recipient-row,
.address-actions {
  display: flex;
  align-items: center;
}

.address-heading {
  justify-content: space-between;
  gap: 20rpx;
}

.recipient-row {
  gap: 18rpx;
}

.recipient {
  color: var(--ld-mini-text);
  font-size: 30rpx;
  font-weight: 900;
}

.phone {
  color: #555555;
  font-size: 26rpx;
}

.default-badge {
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: var(--ld-mini-primary-soft);
  color: var(--ld-mini-primary);
  font-size: 22rpx;
  font-weight: 800;
}

.address-text {
  display: block;
  margin-top: 18rpx;
  color: #555555;
  font-size: 26rpx;
  line-height: 1.55;
}

.address-actions {
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eeeeee;
}

.action-button {
  height: 56rpx;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 28rpx;
  background: #f4f4f4;
  color: #444444;
  font-size: 22rpx;
  line-height: 56rpx;
}

.action-button.danger {
  color: #c62828;
}

.action-button::after,
.import-button::after {
  border: 0;
}

.bottom-action {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 18rpx var(--ld-page-padding, 24rpx) calc(18rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  box-shadow: 0 -8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.import-button {
  width: 100%;
  height: 84rpx;
  margin: 0;
  border-radius: 42rpx;
  background: #07c160;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 84rpx;
}

.unsupported-hint {
  display: block;
  color: #777777;
  font-size: 24rpx;
  text-align: center;
}
</style>
