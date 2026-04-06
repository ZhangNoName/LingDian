<!-- 基础布局：快餐类小程序常见结构（底部 Tab + 内容区），风格参考华莱士类红白主色 -->
<template>
  <view class="app-layout">
    <scroll-view
      class="layout-body"
      scroll-y
      :enable-back-to-top="true"
      :show-scrollbar="false"
    >
      <slot />
    </scroll-view>

    <view class="tabbar-wrap safe-bottom">
      <view class="tabbar">
        <view
          v-for="item in tabs"
          :key="item.key"
          class="tab-item"
          :class="{ 'tab-item--active': activeTab === item.key }"
          @tap="onTabTap(item)"
        >
          <uni-icons
            :type="item.icon"
            :size="22"
            :color="activeTab === item.key ? '#e02020' : '#9e9e9e'"
          />
          <text class="tab-label">{{ item.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
export type TabKey = "home" | "order" | "user";

const props = withDefaults(
  defineProps<{
    /** 当前选中的 Tab，与子页面路由对应 */
    activeTab?: TabKey;
    /** 为 true 时点击 Tab 会 reLaunch 到对应页面（需在 pages.json 注册路径） */
    navigateOnTap?: boolean;
  }>(),
  {
    activeTab: "home",
    navigateOnTap: true,
  },
);

const emit = defineEmits<{
  (e: "change", key: TabKey): void;
}>();

const tabs = [
  { key: "home" as const, label: "首页", path: "/pages/home/home", icon: "home" },
  { key: "order" as const, label: "点餐", path: "/pages/order/order", icon: "cart" },
  { key: "user" as const, label: "我的", path: "/pages/user/user", icon: "person" },
];

function onTabTap(item: (typeof tabs)[number]) {
  emit("change", item.key);
  if (!props.navigateOnTap || props.activeTab === item.key) return;
  uni.reLaunch({ url: item.path });
}
</script>

<style scoped>
/* 华莱士类品牌色：主红 + 浅灰底 */
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f6f6f6;
  box-sizing: border-box;
  padding-top: calc(var(--status-bar-height) + 20rpx);
}

.layout-body {
  flex: 1;
  min-height: 0;
  height: 0;
  box-sizing: border-box;
}

.tabbar-wrap {
  flex-shrink: 0;
  background: #ffffff;
  border-top: 1rpx solid #eeeeee;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.safe-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.tabbar {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  justify-content: space-around;
  height: 100rpx;
  padding: 0 8rpx;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9e9e9e;
}

.tab-item--active {
  color: #e02020;
}

.tab-label {
  margin-top: 4rpx;
  font-size: 20rpx;
  line-height: 1.2;
}
</style>
