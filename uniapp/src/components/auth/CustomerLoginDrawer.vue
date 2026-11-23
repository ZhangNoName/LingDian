<template>
  <view class="login-overlay">
    <view class="login-backdrop" aria-hidden="true" @tap="dismiss" @touchmove.stop.prevent />
    <view class="login-drawer" role="dialog" aria-modal="true" :aria-label="showProfile ? '设置头像和昵称' : '登录零点点餐'" @keydown.esc.stop="dismiss">
      <view v-if="!showProfile" class="drawer-header">
        <text class="drawer-title">登录零点点餐</text>
        <button class="drawer-close" aria-label="关闭登录" :disabled="submitting" @tap="dismiss" @keydown.enter="dismiss" @keydown.space.prevent="dismiss">×</button>
      </view>
      <scroll-view class="drawer-scroll" scroll-y>
        <FirstLoginProfile v-if="showProfile" @done="emit('signed-in')" />
        <view v-else-if="supportsWechatQuickLogin" class="auth-actions">
          <view class="legal-row">
            <checkbox-group @change="updateLegalConsent">
              <label class="legal-checkbox-control">
                <checkbox class="legal-checkbox" value="accepted" :checked="legalAccepted" :disabled="submitting" color="#ca1726" />
                <text>我已阅读并同意</text>
              </label>
            </checkbox-group>
            <view class="legal-links">
              <text class="legal-link" role="link" tabindex="0" @keydown.enter="openLegalDocument('user-agreement')" @tap="openLegalDocument('user-agreement')">《用户服务协议》</text>
              <text>和</text>
              <text class="legal-link" role="link" tabindex="0" @keydown.enter="openLegalDocument('privacy-policy')" @tap="openLegalDocument('privacy-policy')">《隐私政策》</text>
            </view>
          </view>
          <button
            v-if="legalAccepted"
            :class="['phone-login-button', { 'is-disabled': submitting }]"
            open-type="getPhoneNumber"
            :loading="submitting"
            :disabled="submitting"
            @getphonenumber="wechatPhoneLogin"
          >手机号快捷登录</button>
          <button v-else class="phone-login-button" @tap="showConsentRequired" @keydown.enter="showConsentRequired">手机号快捷登录</button>
        </view>
        <text v-else class="platform-hint">当前环境暂不支持手机号快捷登录</text>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import FirstLoginProfile from "@/components/profile/FirstLoginProfile.vue";
import { miniProgramAuthProvider } from "@/config/platform";
import { createLoginLegalConsentActions } from "@/legal/legal-consent";
import { customerAuth } from "@/services/auth";
import { getCustomerAuthMessage } from "@/services/auth-message";

const emit = defineEmits<{ "signed-in": []; cancel: [] }>();
const submitting = ref(false);
const legalAccepted = ref(false);
const showProfile = ref(false);
const supportsWechatQuickLogin = miniProgramAuthProvider() === "WECHAT";

const legalConsentActions = createLoginLegalConsentActions(
  () => legalAccepted.value,
  (message) => uni.showToast({ title: message, icon: "none" }),
);

async function wechatPhoneLogin(event: { detail?: { code?: string } }) {
  if (submitting.value) return;
  await legalConsentActions.wechatPhoneLogin(async (legalConsent) => {
    const phoneCode = event.detail?.code;
    if (!phoneCode) {
      uni.showToast({ title: "未获取手机号，可重新快速登录", icon: "none" });
      return;
    }

    submitting.value = true;
    try {
      const isNewUser = await customerAuth.wechatPhoneLogin(phoneCode, legalConsent);
      uni.hideToast();
      if (isNewUser) showProfile.value = true;
      else emit("signed-in");
    } catch (error) {
      uni.showToast({ title: getCustomerAuthMessage(error), icon: "none" });
    } finally {
      submitting.value = false;
    }
  });
}

function showConsentRequired() {
  return legalConsentActions.wechatPhoneLogin(() => undefined);
}

function dismiss() {
  if (!submitting.value && !showProfile.value) emit("cancel");
}

function updateLegalConsent(event: { detail: { value: string[] } }) {
  legalAccepted.value = event.detail.value.includes("accepted");
}

function openLegalDocument(document: "user-agreement" | "privacy-policy") {
  if (!submitting.value) uni.navigateTo({ url: `/pages/legal/${document}` });
}
</script>

<style scoped>
.login-overlay,
.login-backdrop {
  position: fixed;
  inset: 0;
}

.login-overlay {
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.login-backdrop {
  background: rgba(25, 18, 16, .54);
}

.login-drawer {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 540px;
  overflow: hidden;
  padding: 16px max(16px, var(--ld-page-padding)) calc(16px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--ld-mini-surface);
  animation: drawer-enter 180ms ease-out;
}

@keyframes drawer-enter {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .login-drawer { animation: none; }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawer-title {
  color: var(--ld-mini-text);
  font-size: 22px;
  font-weight: 800;
}

.drawer-close {
  display: grid;
  width: 44px;
  height: 44px;
  margin: 0 -8px 0 0;
  padding: 0;
  place-items: center;
  background: transparent;
  color: var(--ld-mini-text-muted);
  font-size: 28px;
  line-height: 1;
}

.drawer-scroll {
  max-height: 68vh;
}

.auth-actions {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.legal-row,
.legal-checkbox-control,
.legal-links {
  display: flex;
  align-items: center;
}

.legal-row {
  flex-wrap: wrap;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm);
  line-height: 1.5;
}

.legal-checkbox-control,
.legal-link {
  display: flex;
  min-height: 44px;
  align-items: center;
}

.legal-checkbox {
  margin-right: 4rpx;
  transform: scale(0.86);
  transform-origin: left center;
}

.legal-link {
  color: var(--ld-mini-primary);
}

.phone-login-button {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  min-height: 50px;
  margin: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--ld-radius-16);
  background: var(--ld-mini-primary);
  color: #fff;
  font-size: var(--ld-font-md);
  font-weight: 700;
}

.phone-login-button.is-disabled {
  opacity: .65;
}

.drawer-close::after,
.phone-login-button::after {
  border: 0;
}

.platform-hint {
  display: block;
  padding: 8px 0 12px;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-base);
}
</style>
