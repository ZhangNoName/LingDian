<template>
  <Layout active="profile">
    <template #header>
      <AppNavBar title="我的" />
    </template>
    <view class="profile-content">
      <ProfileHeader
        :presentation="customerPresentation"
        :avatar-url="customerProfile?.avatar_data_url"
        :editable="!!customerProfile && !editing && !loggingOut"
        @edit="startEditing"
      />
      <form v-if="editing" class="edit-card" @submit="saveProfile">
        <view class="edit-fields">
          <!-- #ifdef MP-WEIXIN -->
          <view class="avatar-row">
            <text class="field-label">头像</text>
            <button class="avatar-choice" open-type="chooseAvatar" aria-label="更换头像" :disabled="saving" @chooseavatar="chooseAvatar">
              <image v-if="avatarPath || customerProfile?.avatar_data_url" class="avatar-image" :src="avatarPath || customerProfile?.avatar_data_url" mode="aspectFill" />
              <view v-else class="avatar-placeholder"><AppIcon name="profile" :size="44" tone="muted" /></view>
              <text>更换头像</text>
            </button>
          </view>
          <!-- #endif -->
          <view>
            <text class="field-label">昵称</text>
            <!-- #ifdef MP-WEIXIN -->
            <input class="nickname-input" :value="nickname" name="nickname" type="nickname" maxlength="32" placeholder="请输入昵称" aria-label="昵称" :disabled="saving" />
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <input class="nickname-input" :value="nickname" name="nickname" maxlength="32" placeholder="请输入昵称" aria-label="昵称" :disabled="saving" />
            <!-- #endif -->
          </view>
          <text v-if="editError" class="edit-error" role="alert">{{ editError }}</text>
          <view class="edit-actions">
            <AppActionButton variant="outline" :disabled="saving" @activate="cancelEditing">取消</AppActionButton>
            <button class="save" :class="{ 'is-saving': saving }" form-type="submit" :loading="saving" :disabled="saving">保存</button>
          </view>
        </view>
      </form>
      <template v-else>
        <ManageGrid :entries="manageEntries" @select="handleManageEntry" />
        <view v-if="currentUser" class="session-actions">
          <AppActionButton variant="outline" :loading="loggingOut" @activate="logout">退出登录</AppActionButton>
        </view>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import type { AuthenticatedUser, CustomerProfile } from "@lingdian/contracts";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import AppIcon from "@/components/app/AppIcon.vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import ManageGrid from "@/components/profile/ManageGrid.vue";
import ProfileHeader from "@/components/profile/ProfileHeader.vue";
import Layout from "@/layout/layout.vue";
import { customerAuth } from "@/services/auth";
import { clearCart } from "@/services/cart";
import { requireCustomerAuth } from "@/services/auth-navigation";
import { buildCustomerPresentation } from "@/services/customer-presentation";
import { profile } from "@/services/profile";
import type { ManageEntry } from "@/types/member";

const nickname = ref("");
const avatarPath = ref("");
const editing = ref(false);
const saving = ref(false);
const editError = ref("");
const loggingOut = ref(false);
const currentUser = ref<AuthenticatedUser | undefined>(customerAuth.getUser());
const customerProfile = ref<CustomerProfile>();
const customerPresentation = computed(() => buildCustomerPresentation(currentUser.value, customerProfile.value));
let profileLoad = 0;
const manageEntries: ManageEntry[] = [
  { key: "orders", label: "我的订单", route: "/pages/his/his" },
  { key: "address", label: "地址管理", route: "/pages/address/address" },
];

onShow(async () => {
  if (!(await requireCustomerAuth())) return;
  const user = customerAuth.getUser();
  if (currentUser.value?.userId !== user?.userId) {
    customerProfile.value = undefined;
    editing.value = false;
  }
  currentUser.value = user;
  if (editing.value) return;
  const load = ++profileLoad;
  const session = customerAuth.getSessionVersion();
  try {
    const result = await profile.get();
    if (load === profileLoad && customerAuth.getSessionVersion() === session) customerProfile.value = result;
  } catch (error) {
    if (load === profileLoad && customerAuth.getSessionVersion() === session) {
      uni.showToast({ title: error instanceof Error ? error.message : "资料加载失败", icon: "none" });
    }
  }
});

function handleManageEntry(entry: ManageEntry) {
  if (entry.key === "address") uni.navigateTo({ url: entry.route });
  else uni.redirectTo({ url: entry.route });
}

async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await customerAuth.logout();
  } catch {
    uni.showToast({ title: "已在本机退出，服务器状态待确认", icon: "none" });
  } finally {
    clearCart();
    uni.reLaunch({ url: "/pages/home/home" });
  }
}

function startEditing() {
  if (!customerProfile.value || loggingOut.value) return;
  profileLoad++;
  nickname.value = customerProfile.value.nickname ?? "";
  avatarPath.value = "";
  editError.value = "";
  editing.value = true;
}

function cancelEditing() {
  if (!saving.value) editing.value = false;
}

function chooseAvatar(event: { detail?: { avatarUrl?: string } }) {
  if (editing.value && !saving.value && event.detail?.avatarUrl) avatarPath.value = event.detail.avatarUrl;
}

async function saveProfile(event: { detail?: { value?: { nickname?: string } } }) {
  if (saving.value || !editing.value || !customerProfile.value) return;
  nickname.value = event.detail?.value?.nickname?.trim() ?? nickname.value;
  const nicknameChanged = nickname.value !== (customerProfile.value.nickname ?? "");
  editError.value = "";
  if (nicknameChanged && !nickname.value) {
    editError.value = "请输入昵称";
    return;
  }
  if (!nicknameChanged && !avatarPath.value) {
    editing.value = false;
    return;
  }

  saving.value = true;
  const session = customerAuth.getSessionVersion();
  let nicknameSaved = false;
  try {
    if (nicknameChanged) {
      const result = await profile.updateNickname(nickname.value);
      if (customerAuth.getSessionVersion() !== session) return;
      nickname.value = result.nickname;
      customerProfile.value = { ...customerProfile.value, nickname: result.nickname };
      nicknameSaved = true;
    }
    if (avatarPath.value) {
      const result = await profile.uploadAvatar(avatarPath.value);
      if (customerAuth.getSessionVersion() !== session) return;
      customerProfile.value = result;
    }
    editing.value = false;
    uni.showToast({ title: "个人信息已保存", icon: "success" });
  } catch (error) {
    if (customerAuth.getSessionVersion() === session) {
      const message = error instanceof Error ? error.message : "个人信息保存失败，请重试";
      editError.value = nicknameSaved ? `昵称已保存。${message}` : message;
    }
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.profile-content {
  padding: var(--ld-page-padding, 24rpx) 0 12rpx;
}

.edit-card {
  display: block;
  margin: 0 var(--ld-page-padding, 24rpx) 20rpx;
  padding: 20rpx;
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.edit-fields {
  display: grid;
  gap: 24rpx;
}

.field-label {
  display: block;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
}

.avatar-row,
.avatar-choice {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.avatar-row { justify-content: space-between; }

.avatar-choice {
  margin: 0;
  padding: 0;
  background: transparent;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-sm);
  line-height: 1.4;
}

.avatar-image,
.avatar-placeholder {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
}

.avatar-placeholder {
  display: grid;
  place-items: center;
  background: var(--ld-mini-primary-soft);
}

.session-actions {
  padding: 24rpx var(--ld-page-padding) 0;
}

.nickname-input {
  box-sizing: border-box;
  width: 100%;
  height: 88rpx;
  min-height: 44px;
  margin-top: 10rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-bg);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base);
}

.edit-error { color: var(--ld-mini-primary-pressed); font-size: var(--ld-font-sm); }

.edit-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.save {
  width: 100%;
  margin: 0;
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-primary);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 66rpx;
}

.avatar-choice::after, .save::after { border: 0; }
.save.is-saving { opacity: .55; }
</style>
