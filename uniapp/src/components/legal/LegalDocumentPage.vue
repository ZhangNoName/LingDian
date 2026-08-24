<template>
  <view class="legal-page">
    <view class="legal-header">
      <AppNavBar :title="document.title" show-back @back="handleBack" />
    </view>

    <scroll-view class="legal-scroll" scroll-y>
      <view class="legal-content">
        <view class="legal-card">
          <text class="document-title">{{ document.title }}</text>
          <view class="document-meta">
            <text class="meta-text">版本：{{ document.version }}</text>
            <text class="meta-text">生效日期：{{ document.effectiveDate }}</text>
            <text class="meta-text">运营主体：{{ document.operatorName }}</text>
          </view>

          <view class="introduction">
            <text v-for="paragraph in document.introduction" :key="paragraph" class="legal-paragraph">{{ paragraph }}</text>
          </view>

          <view v-for="(section, sectionIndex) in document.sections" :key="section.title" class="legal-section">
            <text class="section-title">{{ sectionIndex + 1 }}. {{ section.title }}</text>
            <text v-for="paragraph in section.paragraphs" :key="paragraph" class="legal-paragraph">{{ paragraph }}</text>
            <view v-if="section.bullets?.length" class="bullet-list">
              <view v-for="bullet in section.bullets" :key="bullet" class="bullet-row">
                <text class="bullet-mark">•</text>
                <text class="legal-bullet">{{ bullet }}</text>
              </view>
            </view>
          </view>

          <view class="legal-notice">
            <text class="notice-text">本页面用于阅读协议，不在此处完成同意操作。请返回登录页后根据提示作出选择。</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import AppNavBar from "@/components/app/AppNavBar.vue";
import type { LegalDocument } from "@/legal/legal-documents";

defineProps<{
  document: LegalDocument;
}>();

function handleBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack();
    return;
  }

  uni.reLaunch({ url: "/pages/auth/login" });
}
</script>

<style scoped>
.legal-page {
  display: flex;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: var(--ld-mini-bg);
}

.legal-header {
  flex-shrink: 0;
  padding-top: var(--status-bar-height, 0px);
  background: var(--ld-mini-surface);
}

.legal-scroll {
  min-height: 0;
  flex: 1;
  background: var(--ld-mini-bg);
}

.legal-content {
  padding: 24rpx var(--ld-page-padding, 24rpx) calc(40rpx + env(safe-area-inset-bottom));
}

.legal-card {
  max-width: 702rpx;
  margin: 0 auto;
  padding: 36rpx 32rpx 40rpx;
  border: var(--ld-card-border);
  border-radius: var(--ld-radius-16, 16px);
  background: var(--ld-mini-surface);
  box-shadow: var(--ld-mini-shadow-card);
}

.document-title {
  display: block;
  color: var(--ld-mini-text);
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.4;
  text-align: center;
}

.document-meta {
  display: flex;
  margin-top: 20rpx;
  flex-direction: column;
  gap: 8rpx;
  padding-bottom: 24rpx;
  border-bottom: var(--ld-card-border);
}

.meta-text {
  display: block;
  color: var(--ld-mini-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

.introduction {
  margin-top: 28rpx;
}

.legal-section {
  margin-top: 36rpx;
}

.section-title {
  display: block;
  margin-bottom: 14rpx;
  color: var(--ld-mini-text);
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.55;
}

.legal-paragraph {
  display: block;
  margin-top: 14rpx;
  color: var(--ld-mini-text);
  font-size: 26rpx;
  line-height: 1.75;
  text-align: justify;
}

.bullet-list {
  margin-top: 12rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: var(--ld-mini-bg);
}

.bullet-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 8rpx;
}

.bullet-mark {
  flex-shrink: 0;
  color: var(--ld-mini-primary);
  font-size: 26rpx;
  line-height: 1.75;
}

.legal-bullet {
  min-width: 0;
  flex: 1;
  color: var(--ld-mini-text);
  font-size: 26rpx;
  line-height: 1.75;
  text-align: justify;
}

.legal-notice {
  margin-top: 40rpx;
  padding: 20rpx 24rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: var(--ld-mini-primary-soft);
}

.notice-text {
  display: block;
  color: var(--ld-mini-brand-dark);
  font-size: 24rpx;
  line-height: 1.65;
  text-align: center;
}
</style>
