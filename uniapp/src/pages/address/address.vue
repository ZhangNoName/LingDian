<template>
  <Layout :show-tab-bar="false" :scroll-into-view="creating ? 'address-form' : 'address-list'">
    <template #header>
      <AppNavBar :title="title" show-back @back="goBack" />
    </template>
    <view :id="creating ? 'address-form' : 'address-list'" class="address-content" :class="{ 'address-form-content': creating }">
      <AddressForm v-if="creating" :saving="saving" :error="saveError" @save="saveAddress" />
      <template v-else>
        <view v-if="loading" class="state-card"><text>正在加载地址…</text></view>
        <view v-else-if="loadError" class="state-card empty-card">
          <text class="state-title">{{ loadError }}</text>
          <AppActionButton size="small" variant="outline" @activate="loadAddresses">重试</AppActionButton>
        </view>
        <view v-else-if="addressList.length === 0" class="state-card empty-card">
          <text class="state-title">还没有收货地址</text>
        </view>
        <view v-if="!loading && addressList.length" class="address-list">
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
              <AppActionButton v-if="selecting" @activate="selectAddress(item.id)">使用此地址</AppActionButton>
              <template v-else>
                <AppActionButton v-if="!item.isDefault" size="small" variant="outline" :disabled="!!busyId" @activate="setDefault(item.id)">设为默认</AppActionButton>
                <AppActionButton size="small" variant="danger" :disabled="!!busyId" @activate="removeAddress(item.id)">删除</AppActionButton>
              </template>
            </view>
          </view>
        </view>

      </template>
    </view>
    <template #footer>
      <view v-if="!creating" class="bottom-action">
        <AppActionButton size="large" :disabled="loading || !!busyId" @activate="startCreating">新建收货地址</AppActionButton>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import type { CreateUserAddressRequest, UserAddress } from "@lingdian/contracts";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import AddressForm from "@/components/address/AddressForm.vue";
import Layout from "@/layout/layout.vue";
import { addresses, formatAddress } from "@/services/addresses";
import { navigateBackOrRedirect, requireCustomerAuth } from "@/services/auth-navigation";

const addressList = ref<UserAddress[]>([]);
const loading = ref(true);
const selecting = ref(false);
const loadError = ref("");
const creating = ref(false);
const saving = ref(false);
const saveError = ref("");
const busyId = ref("");
const title = computed(() => creating.value ? "新建收货地址" : selecting.value ? "选择收货地址" : "收货地址");

onLoad((query) => { selecting.value = query?.select === "1"; });

onShow(async () => {
  if (!(await requireCustomerAuth())) return;
  await loadAddresses();
});

async function loadAddresses() {
  loading.value = true;
  loadError.value = "";
  try {
    addressList.value = await addresses.list();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "地址加载失败";
  } finally {
    loading.value = false;
  }
}

function selectAddress(id: string) {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as { getOpenerEventChannel?: () => { emit: (name: string, value: string) => void } };
  page?.getOpenerEventChannel?.()?.emit("addressSelected", id);
  goBack();
}

function startCreating() {
  saveError.value = "";
  creating.value = true;
}

async function saveAddress(address: CreateUserAddressRequest) {
  if (saving.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    const saved = await addresses.create(address);
    addressList.value = [saved, ...addressList.value.filter(({ id }) => id !== saved.id)]
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
    creating.value = false;
    uni.showToast({ title: "地址已保存", icon: "success" });
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : "地址保存失败，请重试";
  } finally {
    saving.value = false;
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

function goBack() {
  if (saving.value) return;
  if (creating.value) {
    creating.value = false;
    return;
  }
  navigateBackOrRedirect("/pages/user/user");
}
</script>

<style scoped>
.address-content {
  padding: var(--ld-page-padding, 24rpx) 0 12rpx;
}

.address-form-content {
  padding-bottom: var(--ld-page-bottom-safe);
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
  display: grid;
  justify-items: center;
  gap: 12rpx;
  padding: 72rpx 32rpx;
  text-align: center;
}

.state-title {
  display: block;
  color: var(--ld-mini-text);
  font-size: 30rpx;
  font-weight: 900;
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
  flex-wrap: wrap;
  min-width: 0;
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

.bottom-action {
  padding: 18rpx var(--ld-page-padding, 24rpx) calc(18rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: var(--ld-card-border);
}

</style>
