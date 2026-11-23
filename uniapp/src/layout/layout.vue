<template>
  <view class="layout">
    <view class="page-frame" :inert="backgroundInactive" :aria-hidden="backgroundInactive ? 'true' : undefined">
      <view class="page-header">
        <slot name="header" />
      </view>
      <scroll-view v-if="scrollContent" class="page-content" scroll-y :scroll-into-view="scrollTarget">
        <slot />
      </scroll-view>
      <view v-else class="page-content page-content--static">
        <slot />
      </view>
      <view class="page-footer">
        <slot name="footer" />
        <AppTabBar v-if="showTabBar" :active="active" @change="handleTabChange" />
      </view>
    </view>
    <slot name="overlay" />
    <CustomerLoginDrawer
      v-if="Boolean(loginRequest)"
      :key="loginRequest?.id"
      @signed-in="finishLogin(true)"
      @cancel="finishLogin(false)"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import AppTabBar from "@/components/app/AppTabBar.vue";
import CustomerLoginDrawer from "@/components/auth/CustomerLoginDrawer.vue";
import { isProtectedCustomerRoute, requireCustomerAuth } from "@/services/auth-navigation";
import { currentCustomerPage, customerLoginForPage } from "@/services/customer-login";

type AppTabKey = "home" | "menu" | "orders" | "profile";

const props = withDefaults(
  defineProps<{
    active?: AppTabKey;
    showTabBar?: boolean;
    scrollContent?: boolean;
    scrollIntoView?: string;
    contentInert?: boolean;
  }>(),
  {
    active: "home",
    showTabBar: true,
    scrollContent: true,
  },
);

const routes: Record<AppTabKey, string> = {
  home: "/pages/home/home",
  menu: "/pages/order/order",
  orders: "/pages/his/his",
  profile: "/pages/user/user",
};

const page = shallowRef<ReturnType<typeof currentCustomerPage>>();
const loginRequest = computed(() => customerLoginForPage(page.value));
const backgroundInactive = computed(() => Boolean(loginRequest.value) || Boolean(props.contentInert));
const scrollTarget = ref("");
watch(() => props.scrollIntoView, () => {
  void nextTick(() => { scrollTarget.value = props.scrollIntoView ?? ""; });
});
onMounted(() => { page.value = currentCustomerPage(); });
onBeforeUnmount(() => finishLogin(false));

function finishLogin(signedIn: boolean) {
  loginRequest.value?.finish(signedIn);
}

async function handleTabChange(key: AppTabKey) {
  if (key === props.active) return;
  const target = routes[key];
  if (isProtectedCustomerRoute(target) && !(await requireCustomerAuth())) return;
  uni.redirectTo({ url: target });
}
</script>

<style scoped>
.layout {
  box-sizing: border-box;
  height: 100vh;
  overflow: hidden;
  padding-top: var(--status-bar-height, 0px);
  background: var(--ld-mini-bg);
}

.page-frame {
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
}

.page-header,
.page-footer {
  flex: none;
}

.page-content {
  flex: 1;
  height: 0;
  min-height: 0;
}

.page-content--static {
  overflow: hidden;
}
</style>
