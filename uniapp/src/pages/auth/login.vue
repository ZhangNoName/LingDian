<template>
  <scroll-view class="login-scroll" scroll-y>
    <view class="login-shell">
      <view class="login-content">
        <view class="hero">
      <text class="title">登录零点点餐</text>
      <text class="subtitle">{{ pendingOauthId ? "验证手机号以完成第三方账号绑定" : "手机号验证后即可继续" }}</text>
        </view>

        <view class="form-card">
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
const returnUrl = ref("/pages/user/user");
const providers = computed(() => customerAuth.getSupportedThirdPartyProviders());

let cooldownTimer: ReturnType<typeof setInterval> | undefined;

function showError(error: unknown) {
  uni.showToast({ title: getCustomerAuthMessage(error), icon: "none" });
}

onLoad((options) => {
  returnUrl.value = resolveCustomerReturnUrl(typeof options?.redirect === "string" ? options.redirect : undefined);
});

async function sendCode() {
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
}

async function submit() {
  if (!phone.value || !code.value) {
    uni.showToast({ title: "请输入手机号和验证码", icon: "none" });
    return;
  }

  submitting.value = true;
  try {
    if (pendingOauthId.value) {
      await customerAuth.completePhoneLink(pendingOauthId.value, phone.value, code.value);
    } else {
      await customerAuth.phoneLogin(phone.value, code.value);
    }
    uni.reLaunch({ url: returnUrl.value });
  } catch (error) {
    showError(error);
  } finally {
    submitting.value = false;
  }
}

async function beginThirdPartyLogin(provider: ThirdPartyProvider) {
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
  align-items: center;
  justify-content: center;
  padding: calc(var(--status-bar-height, 0px) + 64rpx) 48rpx calc(env(safe-area-inset-bottom) + 64rpx);
}

.login-content {
  width: 100%;
  max-width: 680rpx;
  margin: auto 0;
  padding-bottom: 48rpx;
}

.hero {
  margin-bottom: 56rpx;
}

.title,
.subtitle {
  display: block;
}

.title {
  color: var(--ld-mini-text);
  font-size: 48rpx;
  font-weight: 900;
}

.subtitle {
  margin-top: 16rpx;
  color: var(--ld-mini-text-muted);
  font-size: 28rpx;
}

.form-card {
  padding: 32rpx;
  border-radius: 24rpx;
  background: #fff;
  box-sizing: border-box;
  box-shadow: var(--ld-mini-shadow-card);
}

.field-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ld-mini-text);
  font-size: 24rpx;
  font-weight: 800;
}

.field {
  width: 100%;
  height: 92rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  border-radius: 12rpx;
  background: #f6f3f3;
  color: var(--ld-mini-text);
  font-size: 30rpx;
}

.field.is-focused {
  background: #fff;
  box-shadow: 0 0 0 3rpx var(--ld-mini-primary);
}

.code-row {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  margin-top: 20rpx;
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
.provider-button {
  border: 0;
  font-weight: 800;
}

.code-button {
  width: 190rpx;
  height: 92rpx;
  margin: 0;
  border-radius: 12rpx;
  background: var(--ld-mini-primary-soft);
  color: var(--ld-mini-primary-pressed);
  font-size: 24rpx;
  line-height: 92rpx;
}

.submit-button {
  width: 100%;
  height: 96rpx;
  margin-top: 32rpx;
  border-radius: 48rpx;
  background: var(--ld-mini-primary);
  color: #fff;
  font-size: 30rpx;
  line-height: 96rpx;
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
  margin-top: 56rpx;
}

.divider {
  display: block;
  color: #8a8a8a;
  font-size: 24rpx;
  text-align: center;
}

.provider-row {
  display: flex;
  justify-content: center;
  gap: 20rpx;
  margin-top: 24rpx;
}

.provider-button {
  margin: 0;
  border-radius: 36rpx;
  background: #fff;
  color: var(--ld-mini-text);
  font-size: 26rpx;
}

button::after {
  border: 0;
}
</style>
