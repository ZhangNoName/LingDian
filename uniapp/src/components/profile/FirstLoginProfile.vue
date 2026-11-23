<template>
  <form class="profile-card" @submit="save">
    <view class="profile-fields">
      <view class="intro">
        <text class="heading">设置头像和昵称</text>
      </view>

      <!-- #ifdef MP-WEIXIN -->
      <button type="default" open-type="chooseAvatar" class="avatar-choice" :disabled="saving" @chooseavatar="chooseWechatAvatar">
        <image v-if="avatarPath" class="avatar-preview" :src="avatarPath" mode="aspectFill" />
        <view v-else class="avatar-placeholder"><AppIcon name="profile" :size="52" tone="primary" /></view>
        <text>{{ avatarPath ? "更换头像" : "选择头像" }}</text>
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <button type="default" class="avatar-choice" :disabled="saving" @tap="choosePhoto">
        <image v-if="avatarPath" class="avatar-preview" :src="avatarPath" mode="aspectFill" />
        <view v-else class="avatar-placeholder"><AppIcon name="profile" :size="52" tone="primary" /></view>
        <text>{{ avatarPath ? "更换头像" : "选择头像" }}</text>
      </button>
      <!-- #endif -->

      <view class="nickname">
        <text class="field-label">昵称</text>
        <!-- #ifdef MP-WEIXIN -->
        <input class="field" type="nickname" name="nickname" maxlength="32" :disabled="saving" :cursor-spacing="20" placeholder="填写或使用微信昵称" aria-label="昵称" />
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <input class="field" type="text" name="nickname" maxlength="32" :disabled="saving" placeholder="填写昵称" aria-label="昵称" />
        <!-- #endif -->
      </view>
      <text v-if="error" class="error" role="alert">{{ error }}</text>
      <button form-type="submit" class="save" :class="{ 'is-disabled': saving }" :loading="saving" :disabled="saving">保存并继续</button>
      <AppActionButton variant="outline" size="large" :disabled="saving" @activate="emit('done')">暂时跳过</AppActionButton>
    </view>
  </form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import AppActionButton from "@/components/app/AppActionButton.vue";
import AppIcon from "@/components/app/AppIcon.vue";
import { customerAuth } from "@/services/auth";
import { profile } from "@/services/profile";

const emit = defineEmits<{ done: [] }>();
const avatarPath = ref("");
const saving = ref(false);
const error = ref("");
let savedNickname = "";

function chooseWechatAvatar(event: { detail?: { avatarUrl?: string } }) {
  if (!saving.value && event.detail?.avatarUrl) {
    avatarPath.value = event.detail.avatarUrl;
    error.value = "";
  }
}

function choosePhoto() {
  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["album"],
    success: ({ tempFilePaths }) => {
      const path = Array.isArray(tempFilePaths) ? tempFilePaths[0] : tempFilePaths;
      if (path) {
        avatarPath.value = path;
        error.value = "";
      }
    },
  });
}

async function save(event: { detail?: { value?: { nickname?: string } } }) {
  if (saving.value) return;
  const nickname = event.detail?.value?.nickname?.trim() ?? "";
  const avatar = avatarPath.value;
  if (!nickname && !avatar) {
    error.value = "请选择头像或填写昵称";
    return;
  }

  error.value = "";
  saving.value = true;
  const session = customerAuth.getSessionVersion();
  try {
    if (nickname && nickname !== savedNickname) {
      const result = await profile.updateNickname(nickname);
      savedNickname = result.nickname;
    }
    if (customerAuth.getSessionVersion() !== session) return;
    if (avatar) await profile.uploadAvatar(avatar);
    if (customerAuth.getSessionVersion() === session) emit("done");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "资料保存失败，请重试";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.profile-card {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding-top: 8px;
}

.profile-fields {
  display: grid;
  gap: 20rpx;
}

.heading, .field-label, .error {
  display: block;
}

.heading {
  color: var(--ld-mini-primary-pressed);
  font-size: 24px;
  font-weight: 750;
  text-align: center;
}

.avatar-choice {
  display: grid;
  justify-items: center;
  gap: 12rpx;
  margin: 0 auto;
  padding: 12rpx 24rpx;
  background: transparent;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-base);
  font-weight: 650;
  line-height: 1.4;
}

.avatar-preview, .avatar-placeholder {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
}

.avatar-placeholder {
  display: grid;
  place-items: center;
  background: var(--ld-mini-primary-soft);
}

.field-label {
  margin-bottom: 10rpx;
  font-size: var(--ld-font-base);
  font-weight: 650;
}

.field {
  box-sizing: border-box;
  width: 100%;
  height: 88rpx;
  min-height: 44px;
  padding: 0 20rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-bg);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md);
}

.error {
  color: var(--ld-mini-primary-pressed);
  font-size: var(--ld-font-sm);
}

.save {
  width: 100%;
  min-height: 44px;
  margin: 0;
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-primary);
  color: white;
  font-size: var(--ld-font-md);
  font-weight: 650;
  line-height: 88rpx;
}

.avatar-choice::after, .save::after { border: 0; }
.save.is-disabled { opacity: .55; }
</style>
