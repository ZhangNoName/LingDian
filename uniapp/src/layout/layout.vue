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
          <view class="tab-icon" aria-hidden="true">
            <view v-if="item.key === 'home'" class="ico ico-home" />
            <view v-else-if="item.key === 'order'" class="ico ico-order" />
            <view v-else class="ico ico-user" />
          </view>
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
  { key: "home" as const, label: "首页", path: "/pages/home/home" },
  { key: "order" as const, label: "点餐", path: "/pages/order/order" },
  { key: "user" as const, label: "我的", path: "/pages/user/user" },
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
  padding-top: 12rpx;
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

.tab-item--active .ico-home::before {
  border-color: #e02020;
}
.tab-item--active .ico-home::after {
  border-bottom-color: #e02020;
}
.tab-item--active .ico-order::before {
  background-color: #e02020;
  box-shadow:
    0 10rpx 0 #e02020,
    0 20rpx 0 #e02020;
}
.tab-item--active .ico-user::before,
.tab-item--active .ico-user::after {
  border-color: #e02020;
}

.tab-icon {
  width: 48rpx;
  height: 48rpx;
  position: relative;
}

/* 简易 CSS 图标：未选中灰色，选中由父级改色 */
.ico {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.ico-home {
  width: 36rpx;
  height: 32rpx;
}
.ico-home::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 28rpx;
  height: 20rpx;
  border: 3rpx solid #bdbdbd;
  border-top: none;
  border-radius: 0 0 6rpx 6rpx;
  box-sizing: border-box;
}
.ico-home::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 16rpx solid transparent;
  border-right: 16rpx solid transparent;
  border-bottom: 12rpx solid #bdbdbd;
}

.ico-order {
  width: 32rpx;
  height: 36rpx;
}
.ico-order::before {
  content: "";
  position: absolute;
  left: 0;
  top: 6rpx;
  width: 100%;
  height: 4rpx;
  border-radius: 2rpx;
  background-color: #bdbdbd;
  box-shadow:
    0 10rpx 0 #bdbdbd,
    0 20rpx 0 #bdbdbd;
}

.ico-user {
  width: 28rpx;
  height: 32rpx;
}
.ico-user::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  width: 14rpx;
  height: 14rpx;
  border: 3rpx solid #bdbdbd;
  border-radius: 50%;
  box-sizing: border-box;
}
.ico-user::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 24rpx;
  height: 14rpx;
  border: 3rpx solid #bdbdbd;
  border-bottom: none;
  border-radius: 14rpx 14rpx 0 0;
  box-sizing: border-box;
}
</style>
