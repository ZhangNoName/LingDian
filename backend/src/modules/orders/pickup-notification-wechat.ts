import { ConfigService } from '@nestjs/config';
import { isInvalidAccessToken, WechatOAuthProvider } from '../auth/providers/wechat-oauth.provider';

type TemplateField = 'pickupCode' | 'storeName' | 'orderNo' | 'readyAt';
type TemplateValues = Record<TemplateField, string>;

export type PickupTemplate = {
  id: string;
  fields: Array<[string, TemplateField]>;
  state: 'developer' | 'trial' | 'formal';
};

export type PickupSendOutcome =
  | { status: 'SENT' | 'UNKNOWN' }
  | { status: 'PENDING' | 'SKIPPED' | 'FAILED'; code?: number };

export function readPickupTemplate(config: ConfigService): PickupTemplate | undefined {
  const id = config.get<string>('WECHAT_PICKUP_NOTIFICATION_TEMPLATE_ID')?.trim();
  const configuredFields = config.get<string>('WECHAT_PICKUP_NOTIFICATION_FIELDS')?.trim();
  if (!id && !configuredFields) return;
  const state = config.get<string>('WECHAT_PICKUP_NOTIFICATION_MINIPROGRAM_STATE')?.trim() || 'formal';
  if (!id || !/^[\w-]{1,128}$/.test(id) || (state !== 'developer' && state !== 'trial' && state !== 'formal')) {
    throw new Error('Invalid WeChat pickup notification template ID or mini program state');
  }
  const fieldNames: readonly string[] = ['pickupCode', 'storeName', 'orderNo', 'readyAt'];
  let fields: unknown;
  try { fields = JSON.parse(configuredFields ?? ''); } catch { /* Validated below. */ }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new Error('WECHAT_PICKUP_NOTIFICATION_FIELDS must map template keywords to pickup data');
  }
  const entries = Object.entries(fields);
  if (!entries.some(([, value]) => value === 'pickupCode') ||
      entries.some(([key, value]) => !/^[a-z_]+\d+$/.test(key) || !fieldNames.includes(value))) {
    throw new Error('Invalid pickup template fields. Include the pickupCode field');
  }
  return { id, fields: entries as PickupTemplate['fields'], state };
}

export async function sendWechatPickup(
  wechat: WechatOAuthProvider, template: PickupTemplate, openId: string, orderId: string, values: TemplateValues,
): Promise<PickupSendOutcome> {
  const data = Object.fromEntries(template.fields.map(([keyword, field]) => [
    keyword,
    { value: keyword.startsWith('thing') ? Array.from(values[field]).slice(0, 20).join('') : values[field] },
  ]));

  for (const forceRefresh of [false, true]) {
    let token: string;
    try {
      token = await wechat.getMiniAccessToken(forceRefresh);
    } catch {
      return { status: 'PENDING' };
    }
    let code: number | undefined;
    try {
      const url = new URL('https://api.weixin.qq.com/cgi-bin/message/subscribe/send');
      url.searchParams.set('access_token', token);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({
          touser: openId,
          template_id: template.id,
          page: `pages/order-detail/order-detail?id=${encodeURIComponent(orderId)}`,
          miniprogram_state: template.state,
          lang: 'zh_CN',
          data,
        }),
      });
      const payload = await response.json() as { errcode?: unknown };
      if (typeof payload.errcode === 'number') code = payload.errcode;
      if (response.ok && code === 0) return { status: 'SENT' };
    } catch {
      return { status: 'UNKNOWN' };
    }
    if (!forceRefresh && isInvalidAccessToken(code)) continue;
    if (code === 43101) return { status: 'SKIPPED', code };
    if (code === -1 || isInvalidAccessToken(code)) return { status: 'PENDING', code };
    return code && code > 0 ? { status: 'FAILED', code } : { status: 'UNKNOWN' };
  }
  return { status: 'UNKNOWN' };
}
