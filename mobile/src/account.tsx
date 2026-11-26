import { type CustomerProfile } from '@lingdian/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { assetUrl, humanError, request } from './api';
import { auth, useAuth, workspaceLabel, type AccountWorkspace, type Workspace } from './auth';
import { useApi, useData, useWorkspace } from './context';
import { privacyPolicyDocument, userAgreementDocument } from './legal-documents';
import { selectPhoto } from './photo-picker';
import { Badge, Button, Chip, ChipRow, colors, Empty, ErrorLine, Field, Icon, layout, ListRow, Loading, Page, Panel, Section } from './ui';

type LoginMethod = 'customer-sms' | 'admin-sms' | 'password';

export function Login({ mode, onSuccess }: { mode?: Workspace; onSuccess: () => void }) {
  const { go } = useWorkspace();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [method, setMethod] = useState<LoginMethod>(mode === 'merchant' || mode === 'admin' ? 'password' : 'customer-sms');
  const [reset, setReset] = useState(false);
  const [roleChoices, setRoleChoices] = useState<AccountWorkspace[]>();
  const customerSms = method === 'customer-sms';
  const isPhone = method !== 'password';
  const phoneValid = /^(?:\+?86)?1[3-9]\d{9}$/.test(phone.trim());

  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const send = useMutation({
    mutationFn: async () => reset
      ? request('/auth/password/forgot', { method: 'POST', body: { audience: 'merchant-api', username: username.trim() } })
      : request('/auth/codes', {
        method: 'POST',
        body: { phone: phone.trim(), purpose: customerSms ? 'PHONE_LOGIN' : 'ADMIN_LOGIN', deviceId: `lingdian-app:${await auth.device()}` },
      }),
    onSuccess: () => setRemaining(60),
  });

  const submit = useMutation({
    mutationFn: async (selected?: AccountWorkspace) => {
      if (reset) {
        await request('/auth/password/reset', { method: 'POST', body: { audience: 'merchant-api', username: username.trim(), password, code: code.trim() } });
      } else if (isPhone) {
        const smsWorkspace = customerSms ? 'user' : 'admin';
        await auth.signIn(smsWorkspace, {
          audience: customerSms ? 'user-api' : 'admin-api', phone: phone.trim(), code: code.trim(),
          ...(customerSms ? { legalConsent: { userAgreementVersion: userAgreementDocument.version, privacyPolicyVersion: privacyPolicyDocument.version } } : {}),
        });
      } else {
        const credentials = { username: username.trim(), password };
        const workspace = selected ?? mode;
        if (workspace === 'admin' || workspace === 'merchant') {
          await auth.signIn(workspace, { ...credentials, audience: workspace === 'admin' ? 'admin-api' : 'merchant-api' });
        } else {
          return auth.signInWithAccount(credentials);
        }
      }
    },
    onSuccess: (choices) => {
      if (choices) {
        setRoleChoices(choices);
        return;
      }
      if (!reset) return onSuccess();
      setReset(false);
      setCode('');
      setPassword('');
      setRemaining(0);
    },
  });

  const busy = submit.isPending || send.isPending;
  const valid = isPhone
    ? phoneValid && /^\d{6}$/.test(code.trim()) && (!customerSms || accepted)
    : username.trim().length >= 3 && password.length >= (reset ? 12 : 8) && (!reset || /^\d{6}$/.test(code.trim()));
  const changeMethod = (next: LoginMethod) => {
    if (busy || next === method) return;
    setMethod(next);
    setReset(false);
    setCode('');
    setPassword('');
    send.reset();
    submit.reset();
  };
  const submitForm = () => {
    if (!valid || busy || roleChoices) return;
    Keyboard.dismiss();
    submit.mutate(undefined);
  };

  const stepTitle = roleChoices ? '选择登录身份' : reset ? '重置商家密码' : undefined;
  return <Page>
    {stepTitle && <Text style={layout.heading} accessibilityRole="header">{stepTitle}</Text>}
    {roleChoices ? <Panel style={[layout.pad, layout.stack]}>
      {roleChoices.map((workspace) => <Button key={workspace} label={workspaceLabel[workspace]} variant="secondary"
        disabled={busy} onPress={() => submit.mutate(workspace)} />)}
      <ErrorLine message={submit.error ? humanError(submit.error) : undefined} />
      <Button label="返回登录" variant="plain" disabled={busy} onPress={() => {
        setRoleChoices(undefined);
        setPassword('');
        submit.reset();
      }} />
    </Panel> : <>
      {!mode && !reset && <ChipRow>
        <Chip label="短信验证码" selected={isPhone} onPress={() => changeMethod('customer-sms')} />
        <Chip label="账号密码" selected={!isPhone} onPress={() => changeMethod('password')} />
      </ChipRow>}
      {mode === 'admin' && <ChipRow>
        <Chip label="账号密码" selected={!isPhone} onPress={() => changeMethod('password')} />
        <Chip label="短信验证码" selected={isPhone} onPress={() => changeMethod('admin-sms')} />
      </ChipRow>}
      <Panel style={[layout.pad, layout.stack]}>
        {!mode && method === 'admin-sms' && <Text style={layout.strong}>管理员短信登录</Text>}
        {isPhone ? <Field label="手机号码" value={phone} onChangeText={setPhone} editable={!busy} keyboardType="phone-pad" autoComplete="tel" maxLength={16} placeholder="输入手机号" />
          : <Field label="账号" value={username} onChangeText={setUsername} editable={!busy} autoComplete="username" maxLength={64} placeholder="输入账号" />}
        {(isPhone || reset) && <>
          <Field label={reset ? '绑定手机验证码' : '短信验证码'} value={code} onChangeText={setCode} editable={!busy} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
          <Button label={remaining ? `${remaining} 秒后重发` : '发送验证码'} onPress={() => send.mutate()}
            disabled={submit.isPending || remaining > 0 || (reset ? username.trim().length < 3 : !phoneValid) || (customerSms && !accepted)}
            busy={send.isPending} variant="secondary" />
        </>}
        {!isPhone && <Field label={reset ? '新密码' : '密码'} value={password} onChangeText={setPassword} editable={!busy}
          secureTextEntry autoComplete={reset ? 'new-password' : 'current-password'} maxLength={256}
          returnKeyType="go" onSubmitEditing={submitForm} />}
        {customerSms && <View style={layout.compact}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="我已阅读并同意以下协议"
            accessibilityState={{ checked: accepted }} style={layout.horizontal} disabled={busy} onPress={() => setAccepted(!accepted)}>
            <Icon name={accepted ? 'checkbox' : 'square-outline'} color={colors.primary} />
            <Text style={[layout.body, layout.flex]}>我已阅读并同意以下协议</Text>
          </Pressable>
          <View style={layout.horizontal}>
            <Button label="用户服务协议" variant="plain" onPress={() => go({ type: 'legal', document: 'agreement' })} />
            <Button label="隐私保护政策" variant="plain" onPress={() => go({ type: 'legal', document: 'privacy' })} />
          </View>
        </View>}
        <ErrorLine message={submit.error ? humanError(submit.error) : send.error ? humanError(send.error) : undefined} />
        <Button label={reset ? '保存新密码' : '登录'} onPress={submitForm} disabled={!valid || send.isPending} busy={submit.isPending} />
        {!mode && isPhone && <Button label={customerSms ? '管理员短信登录' : '返回顾客短信登录'} variant="plain" disabled={busy}
          onPress={() => changeMethod(customerSms ? 'admin-sms' : 'customer-sms')} />}
        {!mode && !isPhone && <Button label={reset ? '返回账号登录' : '商家忘记密码'} variant="plain" disabled={busy}
          onPress={() => { setReset(!reset); setCode(''); setPassword(''); send.reset(); submit.reset(); }} />}
      </Panel>
    </>}
  </Page>;
}

export function Legal({ document }: { document: 'agreement' | 'privacy' }) {
  const legal = document === 'privacy' ? privacyPolicyDocument : userAgreementDocument;
  return <Page>
    <Text style={layout.heading}>{legal.title}</Text>
    <Text style={layout.muted}>{legal.operatorName} · {legal.effectiveDate}</Text>
    {legal.introduction.map((paragraph) => <Text key={paragraph} style={layout.body}>{paragraph}</Text>)}
    {legal.sections.map((section) => <Section key={section.title} title={section.title}>
      {section.paragraphs.map((paragraph) => <Text key={paragraph} style={layout.body}>{paragraph}</Text>)}
      {section.bullets?.map((bullet) => <Text key={bullet} style={layout.body}>• {bullet}</Text>)}
    </Section>)}
  </Page>;
}

export function Profile() {
  const api = useApi();
  const { workspace, show } = useWorkspace();
  const customer = workspace === 'user';
  const path = customer ? '/auth/profile' : '/auth/profile/nickname';
  const profile = useData<CustomerProfile>(path);
  const [nickname, setNickname] = useState<string | undefined>();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => api.call('/auth/profile/nickname', { method: 'PATCH', body: { nickname: nickname?.trim() } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [api.key, path] });
      setNickname(undefined);
      show('昵称已保存');
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      const photo = await selectPhoto('avatar', 512 * 1024);
      if (photo) await api.call('/auth/profile/avatar', { method: 'POST', body: photo });
      return !!photo;
    },
    onSuccess: (changed) => { if (changed) void client.invalidateQueries({ queryKey: [api.key, path] }); },
  });
  if (profile.isPending) return <Loading />;
  if (profile.isError) return <Empty title="无法加载资料" detail={humanError(profile.error)} action="重试" onAction={() => void profile.refetch()} />;
  const photo = assetUrl(profile.data?.avatar_data_url);
  return <Page>
    {customer && <Panel style={[layout.pad, layout.horizontal]}>
      {photo ? <Image source={{ uri: photo }} style={styles.avatar} /> : <View style={styles.avatar}><Icon name="person-outline" color={colors.primary} /></View>}
      <Button label="更换头像" variant="secondary" onPress={() => upload.mutate()} busy={upload.isPending} />
    </Panel>}
    <Field label="昵称" value={nickname ?? profile.data?.nickname ?? ''} onChangeText={setNickname} maxLength={32} />
    <ErrorLine message={save.error ? humanError(save.error) : upload.error ? humanError(upload.error) : undefined} />
    <Button label="保存昵称" onPress={() => save.mutate()} busy={save.isPending} disabled={!nickname?.trim()} />
  </Page>;
}

export function Password({ forced = false }: { forced?: boolean }) {
  const api = useApi();
  const { workspace, user, show } = useWorkspace();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sms, setSms] = useState(false);
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: () => api.call('/auth/password/change/code', { method: 'POST' }),
    onSuccess: () => setSent(true),
    onError: () => setSent(false),
  });
  const submit = useMutation({
    mutationFn: async () => {
      await api.call(sms ? '/auth/password/change' : '/auth/account/password-change', {
        method: 'POST', body: sms ? { code: current.trim(), password } : { currentPassword: current, password },
      });
      const latest = auth.snapshot();
      if (latest.workspace !== workspace || latest.user?.sessionId !== user?.sessionId) return false;
      await auth.logout().catch(() => undefined);
      return true;
    },
    onSuccess: (signedOut) => { if (signedOut) show('密码已更新，请重新登录'); },
  });
  return <Page>
    {forced && <Badge tone="amber" label="修改临时密码后继续" />}
    {workspace === 'merchant' && <ChipRow>
      <Chip label="当前密码" selected={!sms} onPress={() => { setSms(false); setCurrent(''); }} />
      <Chip label="短信验证" selected={sms} onPress={() => { setSms(true); setCurrent(''); }} />
    </ChipRow>}
    <Field label={sms ? '验证码' : '当前密码'} value={current} onChangeText={setCurrent} secureTextEntry={!sms}
      keyboardType={sms ? 'number-pad' : 'default'} maxLength={sms ? 6 : 256} />
    {sms && <Button label={sent ? '验证码已发送' : '发送验证码'} variant="secondary" onPress={() => send.mutate()} disabled={sent} busy={send.isPending} />}
    <Field label="新密码（至少 12 个字符）" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" maxLength={256} />
    <Field label="确认新密码" value={confirm} onChangeText={setConfirm} secureTextEntry maxLength={256} />
    <ErrorLine message={submit.error ? humanError(submit.error) : send.error ? humanError(send.error) : undefined} />
    <Button label="更新密码" onPress={() => submit.mutate()} disabled={!current || password.length < 12 || confirm !== password} busy={submit.isPending} />
    {forced && <Button label="退出登录" variant="plain" onPress={() => void auth.logout().catch(() => undefined)} />}
  </Page>;
}

export function AccountHome({ openWorkspace }: { openWorkspace: () => void }) {
  const { loggingOut } = useAuth();
  const { workspace, user, go, signIn, show } = useWorkspace();
  const nickname = useData<{ nickname: string | null }>('/auth/profile/nickname', !!user);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const logout = useMutation({
    networkMode: 'always',
    mutationFn: (all: boolean) => auth.logout(all),
    onError: (error) => show(auth.snapshot().user ? humanError(error) : '已退出本机，服务器暂时无法确认退出结果。'),
  });
  return <Page>
    {user && !!nickname.data?.nickname && <Panel><ListRow icon="person-outline" title={nickname.data.nickname} /></Panel>}
    {!user ? <Button label="登录" onPress={signIn} /> : <Panel>
      <ListRow icon="person-outline" title="个人资料" onPress={() => go({ type: 'profile' })} />
      <View style={layout.separator} />
      {workspace === 'user' ? <ListRow icon="location-outline" title="收货地址" onPress={() => go({ type: 'addresses' })} />
        : <ListRow icon="lock-closed-outline" title="修改密码" onPress={() => go({ type: 'password' })} />}
    </Panel>}
    <Panel>
      {user && <ListRow icon="swap-horizontal-outline" title="切换身份" onPress={loggingOut ? undefined : openWorkspace} />}
      {workspace === 'merchant' && user && <>
        <View style={layout.separator} />
        <ListRow icon="storefront-outline" title="门店设置" onPress={() => go({ type: 'store' })} />
      </>}
      {workspace === 'user' && <>
        {user && <View style={layout.separator} />}
        <ListRow icon="document-text-outline" title="用户服务协议" onPress={() => go({ type: 'legal', document: 'agreement' })} />
        <View style={layout.separator} />
        <ListRow icon="shield-checkmark-outline" title="隐私保护政策" onPress={() => go({ type: 'legal', document: 'privacy' })} />
      </>}
    </Panel>
    {user && (confirmLogout ? <Panel style={[layout.pad, layout.stack]}>
      <Text style={layout.strong}>退出登录</Text>
      <Button label="退出这台设备" variant="danger" onPress={() => logout.mutate(false)} busy={logout.isPending} />
      <Button label="退出所有设备" variant="danger" onPress={() => logout.mutate(true)} busy={logout.isPending} />
      <Button label="取消" variant="plain" onPress={() => setConfirmLogout(false)} disabled={logout.isPending} />
    </Panel> : <Button label="退出登录" variant="danger" onPress={() => setConfirmLogout(true)} />)}
  </Page>;
}

const styles = StyleSheet.create({
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
});
