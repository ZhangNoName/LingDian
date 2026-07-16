<template>
  <view class="page">
    <view class="hero">
      <text class="title">登录零点点餐</text>
      <text class="subtitle">{{ pendingOauthId ? "验证手机号以完成第三方账号绑定" : "手机号验证后即可继续" }}</text>
    </view>

    <view class="form-card">
      <input v-model="phone" class="field" type="number" maxlength="11" placeholder="请输入手机号" />
      <view class="code-row">
        <input v-model="code" class="field code-field" type="number" maxlength="6" placeholder="请输入验证码" />
        <button class="code-button" :disabled="cooldown > 0 || sendingCode" @tap="sendCode">
          {{ cooldown > 0 ? `${cooldown}s 后重试` : "获取验证码" }}
        </button>
      </view>
      <button class="submit-button" :loading="submitting" @tap="submit">{{ pendingOauthId ? "完成绑定并登录" : "登录" }}</button>
    </view>

    <view v-if="providers.length" class="third-party">
      <text class="divider">其他登录方式</text>
      <view class="provider-row">
        <button v-for="provider in providers" :key="provider" class="provider-button" :disabled="submitting" @tap="beginThirdPartyLogin(provider)">
          {{ provider === "WECHAT" ? "微信登录" : "QQ 登录" }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { customerAuth, type ThirdPartyProvider } from "@/services/auth";

const phone = ref("");
const code = ref("");
const pendingOauthId = ref("");
const cooldown = ref(0);
const sendingCode = ref(false);
const submitting = ref(false);
const providers = computed(() => customerAuth.getSupportedThirdPartyProviders());

let cooldownTimer: ReturnType<typeof setInterval> | undefined;

function showError(error: unknown) {
  uni.showToast({ title: error instanceof Error ? error.message : "登录失败，请稍后重试", icon: "none" });
}

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
    uni.reLaunch({ url: "/pages/user/user" });
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
.page {
  min-height: 100vh;
  padding: 160rpx 48rpx 80rpx;
  background: linear-gradient(180deg, #effaf3 0, #f7f7f7 360rpx);
}

.hero {
  margin-bottom: 72rpx;
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
  color: #777;
  font-size: 28rpx;
}

.form-card {
  padding: 32rpx;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: var(--ld-mini-shadow-card);
}

.field {
  width: 100%;
  height: 92rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  background: #f5f6f5;
  color: var(--ld-mini-text);
  font-size: 30rpx;
}

.code-row {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.code-field {
  flex: 1;
  min-width: 0;
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
  background: #e9f8ee;
  color: var(--ld-mini-primary);
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
