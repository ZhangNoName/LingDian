<template>
  <scroll-view class="login-scroll" scroll-y>
    <view class="login-shell">
      <view class="login-content">
        <view class="hero">
          <text class="title">登录零点点餐</text>
          <text class="subtitle">{{ pendingOauthId ? "验证手机号以完成第三方账号绑定" : "手机号验证后即可继续" }}</text>
        </view>

        <view class="form-card">
          <button
            v-if="supportsWechatQuickLogin && legalAccepted"
            :class="['wechat-login-button', { 'is-disabled': submitting }]"
            open-type="getPhoneNumber"
            :loading="submitting"
            :disabled="submitting"
            @getphonenumber="wechatPhoneLogin"
          >
            <view class="wechat-cue" />
            <text>微信手机号快捷登录</text>
          </button>
          <button
            v-else-if="supportsWechatQuickLogin"
            :class="['wechat-login-button', { 'is-disabled': submitting }]"
            :disabled="submitting"
            @tap="showConsentRequired"
          >
            <view class="wechat-cue" />
            <text>微信手机号快捷登录</text>
          </button>
          <view v-if="supportsWechatQuickLogin" class="phone-divider"><text>或使用短信验证码</text></view>

          <text id="phone-label" class="field-label">手机号</text>
          <input v-model="phone" :class="['field', { 'is-focused': phoneFocused }]" type="tel" maxlength="11" placeholder="请输入手机号" aria-label="手机号" @focus="phoneFocused = true" @blur="phoneFocused = false" />
          <view class="code-row">
            <view class="code-input">
              <text id="code-label" class="field-label">验证码</text>
              <input v-model="code" :class="['field', 'code-field', { 'is-focused': codeFocused }]" type="tel" maxlength="6" placeholder="请输入验证码" aria-label="验证码" @focus="codeFocused = true" @blur="codeFocused = false" />
            </view>
            <button :class="['code-button', { 'is-disabled': cooldown > 0 || sendingCode }]" role="button" tabindex="0" :disabled="cooldown > 0 || sendingCode" @keydown.enter="sendCode" @tap="sendCode">
              {{ cooldown > 0 ? `${cooldown}s 后重试` : "获取验证码" }}
            </button>
          </view>

          <view class="legal-row">
            <checkbox-group class="legal-checkbox-group" @change="updateLegalConsent">
              <label class="legal-checkbox-control">
                <checkbox class="legal-checkbox" value="accepted" :checked="legalAccepted" color="#ed1c24" />
                <text>我已阅读并同意</text>
              </label>
            </checkbox-group>
            <view class="legal-links">
              <text class="legal-link" role="link" tabindex="0" @keydown.enter="openUserAgreement" @tap="openUserAgreement">《用户服务协议》</text>
              <text class="legal-and">和</text>
              <text class="legal-link" role="link" tabindex="0" @keydown.enter="openPrivacyPolicy" @tap="openPrivacyPolicy">《隐私政策》</text>
            </view>
          </view>

          <button :class="['submit-button', { 'is-disabled': submitting }]" role="button" tabindex="0" :loading="submitting" :disabled="submitting" @keydown.enter="submit" @tap="submit">{{ pendingOauthId ? "完成绑定并登录" : "登录" }}</button>
        </view>

        <view v-if="providers.length" class="third-party">
          <text class="divider">其他登录方式</text>
          <view class="provider-row">
            <button v-for="provider in providers" :key="provider" :class="['provider-button', { 'is-disabled': submitting }]" role="button" tabindex="0" :disabled="submitting" @keydown.enter="beginThirdPartyLogin(provider)" @tap="beginThirdPartyLogin(provider)">
              {{ provider === "WECHAT" ? "微信登录" : "QQ 登录" }}
            </button>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { createLoginLegalConsentActions } from "@/legal/legal-consent";
import { customerAuth, type ThirdPartyProvider } from "@/services/auth";
import { getCustomerAuthMessage } from "@/services/auth-message";
import { resolveCustomerReturnUrl } from "@/services/auth-navigation";

const phone = ref("");
const code = ref("");
const phoneFocused = ref(false);
const codeFocused = ref(false);
const pendingOauthId = ref("");
const cooldown = ref(0);
const sendingCode = ref(false);
const submitting = ref(false);
const legalAccepted = ref(false);
const returnUrl = ref("/pages/user/user");
const supportedProviders = computed(() => customerAuth.getSupportedThirdPartyProviders());
const supportsWechatQuickLogin = computed(() => supportedProviders.value.includes("WECHAT"));
const providers = computed(() => supportedProviders.value.filter((provider) => provider !== "WECHAT"));

let cooldownTimer: ReturnType<typeof setInterval> | undefined;

function showError(error: unknown) {
  uni.showToast({ title: getCustomerAuthMessage(error), icon: "none" });
}

const legalConsentActions = createLoginLegalConsentActions(
  () => legalAccepted.value,
  (message) => uni.showToast({ title: message, icon: "none" }),
);

onLoad((options) => {
  returnUrl.value = resolveCustomerReturnUrl(typeof options?.redirect === "string" ? options.redirect : undefined);
});

async function sendCode() {
  await legalConsentActions.sendCode(async () => {
    if (!phone.value) {
      uni.showToast({ title: "请输入手机号", icon: "none" });
      return;
    }

    sendingCode.value = true;
    try {
      await customerAuth.sendCode(phone.value, pendingOauthId.value ? "PHONE_LINK" : "PHONE_LOGIN");
      cooldown.value = 60;
      cooldownTimer = setInterval(() => {
        cooldown.value = Math.max(0, cooldown.value - 1);
        if (cooldown.value === 0 && cooldownTimer) clearInterval(cooldownTimer);
      }, 1000);
      uni.showToast({ title: "验证码已发送", icon: "none" });
    } catch (error) {
      showError(error);
    } finally {
      sendingCode.value = false;
    }
  });
}

async function submit() {
  await legalConsentActions.submit(async (legalConsent) => {
    if (!phone.value || !code.value) {
      uni.showToast({ title: "请输入手机号和验证码", icon: "none" });
      return;
    }

    submitting.value = true;
    try {
      if (pendingOauthId.value) {
        await customerAuth.completePhoneLink(pendingOauthId.value, phone.value, code.value, legalConsent);
      } else {
        await customerAuth.phoneLogin(phone.value, code.value, legalConsent);
      }
      uni.reLaunch({ url: returnUrl.value });
    } catch (error) {
      showError(error);
    } finally {
      submitting.value = false;
    }
  });
}

async function beginThirdPartyLogin(provider: ThirdPartyProvider) {
  await legalConsentActions.beginThirdPartyLogin(async () => {
    submitting.value = true;
    try {
      const pending = await customerAuth.beginThirdPartyLogin(provider);
      pendingOauthId.value = pending.pending_oauth_id;
      code.value = "";
      uni.showToast({ title: "请验证手机号以完成登录", icon: "none" });
    } catch (error) {
      showError(error);
    } finally {
      submitting.value = false;
    }
  });
}

async function wechatPhoneLogin(event: { detail?: { code?: string; errMsg?: string } }) {
  await legalConsentActions.wechatPhoneLogin(async (legalConsent) => {
    const phoneCode = event.detail?.code;
    if (!phoneCode) {
      uni.showToast({ title: "已取消，可继续使用手机号登录", icon: "none" });
      return;
    }

    submitting.value = true;
    try {
      await customerAuth.wechatPhoneLogin(phoneCode, legalConsent);
      uni.reLaunch({ url: returnUrl.value });
    } catch (error) {
      showError(error);
    } finally {
      submitting.value = false;
    }
  });
}

function showConsentRequired() {
  void legalConsentActions.wechatPhoneLogin(() => undefined);
}

function updateLegalConsent(event: { detail: { value: string[] } }) {
  legalAccepted.value = event.detail.value.includes("accepted");
}

function openUserAgreement() {
  uni.navigateTo({ url: "/pages/legal/user-agreement" });
}

function openPrivacyPolicy() {
  uni.navigateTo({ url: "/pages/legal/privacy-policy" });
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});
</script>

<style scoped>
.login-scroll {
  height: 100vh;
  background: var(--ld-mini-bg);
}

.login-shell {
  display: flex;
  min-height: 100%;
  box-sizing: border-box;
  align-items: flex-start;
  justify-content: center;
  padding: calc(var(--status-bar-height, 0px) + 72rpx) 36rpx calc(env(safe-area-inset-bottom) + 48rpx);
}

.login-content {
  width: 100%;
  max-width: 680rpx;
  padding-bottom: 40rpx;
}

.hero {
  margin-bottom: 32rpx;
}

.title,
.subtitle {
  display: block;
}

.title {
  color: var(--ld-mini-text);
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.25;
}

.subtitle {
  margin-top: 10rpx;
  color: var(--ld-mini-text-muted);
  font-size: 25rpx;
  line-height: 1.5;
}

.form-card {
  box-sizing: border-box;
  padding: 24rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: 20rpx;
  background: var(--ld-mini-surface);
  box-shadow: 0 8rpx 24rpx rgba(36, 24, 20, 0.05);
}

.field-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ld-mini-text);
  font-size: 24rpx;
  font-weight: 700;
}

.field {
  width: 100%;
  height: 88rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: var(--ld-mini-bg);
  color: var(--ld-mini-text);
  font-size: 28rpx;
}

.field.is-focused {
  background: var(--ld-mini-surface);
  box-shadow: 0 0 0 2rpx var(--ld-mini-primary);
}

.code-row {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  margin-top: 18rpx;
}

.code-input {
  min-width: 0;
  flex: 1;
}

.code-field {
  width: 100%;
}

.code-button,
.submit-button,
.provider-button,
.wechat-login-button {
  box-sizing: border-box;
  font-weight: 700;
}

.wechat-login-button {
  display: flex;
  width: 100%;
  height: 88rpx;
  margin: 0;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: 16rpx;
  background: var(--ld-mini-surface);
  color: var(--ld-mini-text);
  font-size: 28rpx;
  line-height: 1;
}

.wechat-login-button.is-disabled {
  background: #fafafa;
  color: var(--ld-mini-text-muted);
}

.wechat-cue {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #07c160;
}

.phone-divider {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 24rpx 0;
  color: var(--ld-mini-text-muted);
  font-size: 22rpx;
}

.phone-divider::before,
.phone-divider::after {
  height: 1rpx;
  background: var(--ld-mini-border);
  content: "";
  flex: 1;
}

.code-button {
  width: 190rpx;
  height: 88rpx;
  margin: 0;
  border: 0;
  border-radius: 16rpx;
  background: var(--ld-mini-primary-soft);
  color: var(--ld-mini-primary-pressed);
  font-size: 24rpx;
  line-height: 88rpx;
}

.legal-row {
  display: flex;
  min-height: 88rpx;
  margin-top: 16rpx;
  align-items: center;
  flex-wrap: wrap;
  color: var(--ld-mini-text-muted);
  font-size: 23rpx;
  line-height: 1.5;
}

.legal-checkbox-group,
.legal-checkbox-control,
.legal-links,
.legal-link {
  display: flex;
  align-items: center;
}

.legal-checkbox-control {
  min-height: 88rpx;
  padding-right: 4rpx;
}

.legal-checkbox {
  margin-right: 8rpx;
  transform: scale(0.86);
  transform-origin: left center;
}

.legal-links {
  min-height: 64rpx;
}

.legal-link {
  min-height: 64rpx;
  color: var(--ld-mini-primary);
}

.legal-and {
  margin: 0 2rpx;
}

.submit-button {
  width: 100%;
  height: 88rpx;
  margin-top: 4rpx;
  border: 0;
  border-radius: 16rpx;
  background: var(--ld-mini-primary);
  color: #fff;
  font-size: 28rpx;
  line-height: 88rpx;
}

.code-button.is-disabled,
.provider-button.is-disabled {
  background: #f1e8e8;
  color: #705357;
}

.submit-button.is-disabled {
  background: #d8b5b7;
  color: #fff7f7;
}

.third-party {
  margin-top: 32rpx;
}

.divider {
  display: block;
  color: var(--ld-mini-text-muted);
  font-size: 22rpx;
  text-align: center;
}

.provider-row {
  display: flex;
  justify-content: center;
  gap: 20rpx;
  margin-top: 18rpx;
}

.provider-button {
  height: 76rpx;
  margin: 0;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: 16rpx;
  background: var(--ld-mini-surface);
  color: var(--ld-mini-text);
  font-size: 24rpx;
  line-height: 74rpx;
}

button::after {
  border: 0;
}
</style>
