<template>
  <form class="address-form" @submit="save">
    <view class="form-fields">
      <view>
        <text class="field-label">收货人</text>
        <input v-model="draft.recipientName" class="field" maxlength="64" :disabled="saving" placeholder="请输入收货人姓名" aria-label="收货人" />
      </view>
      <view>
        <text class="field-label">联系电话</text>
        <input v-model="draft.phoneNumber" class="field" type="number" maxlength="11" :disabled="saving" placeholder="请输入 11 位手机号" aria-label="联系电话" />
      </view>
      <view>
        <text class="field-label">所在地区</text>
        <!-- #ifdef MP-WEIXIN -->
        <picker mode="region" level="sub-district" :value="region" :disabled="saving" @change="chooseRegion">
          <view class="field region-picker" role="button" :aria-label="regionLabel || '选择省市、区县和街道'">
            <text v-if="regionLabel">{{ regionLabel }}</text>
            <text v-else class="placeholder">请选择省市、区县和街道</text>
            <AppIcon name="next" :size="26" tone="muted" />
          </view>
        </picker>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="region-fields">
          <input v-model="draft.provinceName" class="field" maxlength="64" :disabled="saving" placeholder="省份" aria-label="省份" />
          <input v-model="draft.cityName" class="field" maxlength="64" :disabled="saving" placeholder="城市" aria-label="城市" />
          <input v-model="draft.countyName" class="field" maxlength="64" :disabled="saving" placeholder="区县" aria-label="区县" />
          <input v-model="draft.streetName" class="field" maxlength="128" :disabled="saving" placeholder="街道或乡镇" aria-label="街道或乡镇" />
        </view>
        <!-- #endif -->
      </view>
      <view>
        <text class="field-label">详细地址</text>
        <textarea v-model="draft.detailInfo" class="field detail-field" maxlength="255" :disabled="saving" placeholder="请填写小区、楼栋和门牌号" aria-label="详细地址" />
      </view>
      <text v-if="validationError || error" class="form-error" role="alert">{{ validationError || error }}</text>
      <button form-type="submit" class="save" :class="{ 'is-saving': saving }" :loading="saving" :disabled="saving">保存地址</button>
    </view>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { CreateUserAddressRequest } from "@lingdian/contracts";
import AppIcon from "@/components/app/AppIcon.vue";

const props = defineProps<{ saving: boolean; error: string }>();
const emit = defineEmits<{ save: [address: CreateUserAddressRequest] }>();

const draft = reactive({ recipientName: "", phoneNumber: "", provinceName: "", cityName: "", countyName: "", streetName: "", detailInfo: "" });
const initialRegion = ["北京市", "北京市", "东城区", "东华门街道"];
const region = computed(() => draft.countyName
  ? [draft.provinceName, draft.cityName, draft.countyName, draft.streetName]
  : initialRegion);
const regionLabel = computed(() => draft.countyName ? [...new Set(region.value)].filter(Boolean).join(" ") : "");
const validationError = ref("");

function chooseRegion(event: { detail: { value: string[] } }) {
  const [province = "", city = "", county = "", street = ""] = event.detail.value;
  draft.provinceName = province;
  draft.cityName = city;
  draft.countyName = county;
  draft.streetName = street;
}

function save() {
  if (props.saving) return;
  const address = {
    recipientName: draft.recipientName.trim(),
    phoneNumber: String(draft.phoneNumber).trim(),
    provinceName: draft.provinceName.trim(),
    cityName: draft.cityName.trim(),
    countyName: draft.countyName.trim(),
    detailInfo: draft.detailInfo.trim(),
    streetName: draft.streetName.trim(),
    postalCode: "",
    nationalCode: "",
  };
  if (!address.recipientName) validationError.value = "请输入收货人姓名";
  else if (!/^(?:1[3-9]|9[28])\d{9}$/.test(address.phoneNumber)) validationError.value = "请输入有效的 11 位手机号";
  else if (!address.provinceName || !address.cityName || !address.countyName) validationError.value = "请填写完整的省市区";
  else if (!address.streetName) validationError.value = "请填写所在街道或乡镇";
  else if (!address.detailInfo) validationError.value = "请输入详细地址";
  else {
    validationError.value = "";
    emit("save", address);
  }
}
</script>

<style scoped>
.address-form {
  display: block;
  margin: 0 var(--ld-page-padding);
  padding: var(--ld-card-padding);
  border-radius: var(--ld-radius-16);
  background: var(--ld-mini-surface);
}

.form-fields {
  display: grid;
  gap: 24rpx;
}

.field-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base);
  font-weight: 700;
}

.field {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 88rpx;
  min-height: 44px;
  padding: 0 20rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-bg);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base);
}

.region-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.region-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.placeholder {
  color: var(--ld-mini-text-muted);
}

.detail-field {
  height: 168rpx;
  padding: 18rpx 20rpx;
}

.form-error {
  color: var(--ld-mini-primary-pressed);
  font-size: var(--ld-font-sm);
}

.save {
  width: 100%;
  min-height: 44px;
  margin: 0;
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-primary);
  color: #fff;
  font-size: var(--ld-font-md);
  font-weight: 700;
  line-height: 88rpx;
}

.save::after { border: 0; }
.save.is-saving { opacity: .55; }
</style>
