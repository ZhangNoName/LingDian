import type { AuthRole, PlatformAccountType, PlatformUserSummary, SystemLogLevel, SystemLogRecord, SystemLogSource } from '@lingdian/contracts';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useData, useWorkspace } from './context';
import { localTime } from './format';
import { DataState, Options, PagedList, Save } from './operations';
import type { AccountFormRoute } from './routes';
import { Badge, Button, Chip, ChipRow, Empty, Field, layout, ListRow, Page, Panel, Section, Sheet } from './ui';

const path = '/admin/users';
const roleText: Record<AuthRole, string> = { USER: '顾客', MERCHANT: '商家', ADMIN: '管理员', SUPER_ADMIN: '超级管理员' };
const roleRank: Record<AuthRole, number> = { USER: 0, MERCHANT: 1, ADMIN: 2, SUPER_ADMIN: 3 };
const roleOptions = Object.keys(roleText) as AuthRole[];
const maxRank = (roles: AuthRole[]) => Math.max(-1, ...roles.map((role) => roleRank[role]));
const userName = (user: PlatformUserSummary) => user.nickname || user.username || user.phone || '用户';
const accountTypes = [['', '全部'], ['ADMINISTRATOR', '管理员'], ['MERCHANT', '商家'], ['USER', '顾客']] as Array<[PlatformAccountType | '', string]>;

export function AdminHome() {
  const { go, user } = useWorkspace();
  return <Page>
    <Panel><ListRow title="账号管理" icon="people-outline" onPress={() => go({ type: 'collection', name: 'accounts' })} /></Panel>
    <Section title="平台运营"><Panel>
      <ListRow title="订单查询" icon="receipt-outline" onPress={() => go({ type: 'collection', name: 'orders' })} />
      <View style={layout.separator} />
      <ListRow title="收款账户" icon="wallet-outline" onPress={() => go({ type: 'collection', name: 'payments' })} />

      {user?.roles.includes('SUPER_ADMIN') && <><View style={layout.separator} /><ListRow title="系统日志" icon="pulse-outline" onPress={() => go({ type: 'collection', name: 'logs' })} /></>}
    </Panel></Section>
  </Page>;
}

export function Accounts() {
  const { go } = useWorkspace();
  const [type, setType] = useState<PlatformAccountType | ''>('');
  const [status, setStatus] = useState('');
  return <PagedList<PlatformUserSummary> path={path} title="账号管理" searchable
    filters={{ accountType: type, status }} add={() => go({ type: 'form', name: 'accounts', action: 'create' })}
    controls={<>
      <Options values={accountTypes} value={type} onChange={(value) => setType(value as PlatformAccountType | '')} />
      <Options values={[[ '', '全部状态'], ['ACTIVE', '已启用'], ['DISABLED', '已停用']]} value={status} onChange={setStatus} />
    </>}
    recordKey={(item) => item.userId} render={(item) => <ListRow title={userName(item)} detail={item.roles.map((role) => roleText[role]).join('、')}
      icon="person-outline" onPress={() => go({ type: 'record', name: 'accounts', id: item.userId })}
      trailing={<Badge tone={item.status === 'ACTIVE' ? 'green' : 'red'} label={item.status === 'ACTIVE' ? '已启用' : '已停用'} />} />} />;
}

export function AccountRecord({ id }: { id: string }) {
  const { go, user } = useWorkspace();
  const detail = useData<PlatformUserSummary>(`${path}/${encodeURIComponent(id)}`);
  const stores = useData<Array<{ id: string; name: string }>>(`${path}/options/stores`, !!detail.data?.storeIds.length);
  const record = detail.data;
  if (!record) return <DataState pending={detail.isPending} error={detail.error} reload={() => void detail.refetch()} />;
  const canManage = user?.userId !== id && maxRank(user?.roles ?? []) > maxRank(record.roles);
  return <Page>
    <Text style={layout.heading}>{userName(record)}</Text>
    <Panel>
      <ListRow title="账号" detail={record.username ?? '未设置'} />
      <ListRow title="手机号" detail={record.phone ?? '未设置'} />
      <ListRow title="身份" detail={record.roles.map((role) => roleText[role]).join('、') || '未分配'} />
      {!!record.storeIds.length && <ListRow title="经营门店" detail={record.storeIds.map((storeId) => stores.data?.find(({ id }) => storeId === id)?.name ?? storeId).join('、')} />}
      <ListRow title="账号状态" detail={record.status === 'ACTIVE' ? '已启用' : '已停用'} />
      <ListRow title="最近登录" detail={localTime(record.lastLoginAt) || '暂无登录记录'} />
      <ListRow title="创建时间" detail={localTime(record.createdAt)} />
    </Panel>
    {canManage && <Section title="账号操作">
      <Button label="编辑账号与门店" onPress={() => go({ type: 'form', name: 'accounts', action: 'edit', id })} />
      {record.username && <Button label="重置密码" variant="secondary" onPress={() => go({ type: 'form', name: 'accounts', action: 'password', id })} />}
      <Button label={record.status === 'ACTIVE' ? '停用账号' : '启用账号'} variant={record.status === 'ACTIVE' ? 'danger' : 'secondary'}
        onPress={() => go({ type: 'form', name: 'accounts', action: 'status', id })} />
    </Section>}
  </Page>;
}

export function AccountEditor({ route }: { route: AccountFormRoute }) {
  const { action } = route;
  const id = route.action === 'create' ? undefined : route.id;
  const detail = useData<PlatformUserSummary>(`${path}/${encodeURIComponent(id ?? '')}`, !!id);
  if (id && !detail.data) return <DataState pending={detail.isPending} error={detail.error} reload={() => void detail.refetch()} />;
  return <AccountFields action={action} record={detail.data} />;
}

function AccountFields({ action, record }: { action: AccountFormRoute['action']; record?: PlatformUserSummary }) {
  const { user } = useWorkspace();
  const [nickname, setNickname] = useState(record?.nickname ?? '');
  const [username, setUsername] = useState(record?.username ?? '');
  const [phone, setPhone] = useState(record?.phone ?? '');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<AuthRole[]>(record?.roles ?? ['USER']);
  const [storeIds, setStores] = useState(record?.storeIds ?? []);
  const creator = !record;
  const editing = action === 'create' || action === 'edit';
  const stores = useData<Array<{ id: string; name: string }>>(`${path}/options/stores`, editing);
  const detailPath = record ? `${path}/${encodeURIComponent(record.userId)}` : path;
  const rank = maxRank(user?.roles ?? []);
  if (record && (record.userId === user?.userId || maxRank(record.roles) >= rank)) return <Empty title="当前账号无此操作权限" />;
  if (action === 'status' && record) {
    const disable = record.status === 'ACTIVE';
    return <Save title={disable ? '停用账号' : '启用账号'} label={disable ? '确认停用' : '确认启用'}
      path={`${detailPath}/status`} method="PATCH" build={() => ({ status: disable ? 'DISABLED' : 'ACTIVE' })}>
      <Text style={layout.body}>{disable ? `停用后，${userName(record)}的现有会话将立即失效。` : userName(record)}</Text>
    </Save>;
  }
  if (action === 'password' && record) return <Save title="重置密码" label="确认重置" path={`${detailPath}/password-reset`} method="POST"
    disabled={password.length < 12} build={() => ({ password })}>
    <Field label="新密码（至少 12 个字符）" value={password} onChangeText={setPassword} secureTextEntry maxLength={256} />
  </Save>;
  if (!editing) return <Empty title="未找到账号操作入口" />;
  const selectedStores = roles.includes('MERCHANT') ? storeIds : [];
  const needsCredentials = !creator && !record.username && roles.includes('MERCHANT');
  const loginName = username.trim();
  const invalidCredentials = (creator || needsCredentials) && (!/^[a-z0-9._-]{3,64}$/i.test(loginName) || password.length < 12);
  const changed = (left: string[], right: string[]) => left.length !== right.length || left.some((item) => !right.includes(item));
  return <Save title={creator ? '新增账号' : '编辑账号'} path={detailPath} method={creator ? 'POST' : 'PATCH'}
    disabled={!roles.length || roles.includes('MERCHANT') && !selectedStores.length || invalidCredentials || creator && !phone.trim()}
    build={() => ({
      nickname: nickname.trim(), ...(loginName && (creator || record?.username || needsCredentials) ? { username: loginName } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}), ...(creator || needsCredentials ? { password } : {}),
      ...(creator || changed(roles, record.roles) ? { roles } : {}),
      ...(creator || changed(selectedStores, record.storeIds) ? { storeIds: selectedStores } : {}),
    })}>
    <Field label="昵称" value={nickname} onChangeText={setNickname} maxLength={32} />
    {(creator || record.username) && <Field label="账号" value={username} onChangeText={setUsername} maxLength={64} />}
    <Field label="手机号" value={phone} onChangeText={setPhone} maxLength={32} keyboardType="phone-pad" />
    {creator && <Field label="初始密码（至少 12 个字符）" value={password} onChangeText={setPassword} maxLength={256} secureTextEntry />}
    <Section title="分配身份">
      <ChipRow>{roleOptions.filter((role) => roleRank[role] < rank).map((role) => <Chip key={role} label={roleText[role]} selected={roles.includes(role)}
        onPress={() => setRoles(roles.includes(role) ? roles.filter((value) => value !== role) : [...roles, role])} />)}</ChipRow>
    </Section>
    {roles.includes('MERCHANT') && <Section title="经营门店">
      {stores.isError && <Button label="重新加载门店" variant="secondary" onPress={() => void stores.refetch()} />}
      {stores.data?.map((store) => <Chip key={store.id} label={store.name} selected={storeIds.includes(store.id)}
        onPress={() => setStores(storeIds.includes(store.id) ? storeIds.filter((value) => value !== store.id) : [...storeIds, store.id])} />)}
    </Section>}
    {needsCredentials && <Section title="商家登录">
      <Field label="商家登录账号" value={username} onChangeText={setUsername} maxLength={64} autoComplete="off" />
      <Field label="临时密码（至少 12 个字符，首次登录须修改）" value={password} onChangeText={setPassword} maxLength={256}
        secureTextEntry autoComplete="off" />
    </Section>}
  </Save>;
}

export function SystemLogs() {
  const { user } = useWorkspace();
  const [source, setSource] = useState('');
  const [level, setLevel] = useState('');
  const [record, setRecord] = useState<SystemLogRecord>();
  if (!user?.roles.includes('SUPER_ADMIN')) return <Empty title="需要超级管理员权限" />;
  const sources: Array<[SystemLogSource | '', string]> = [['', '全部来源'], ['SERVER', '服务端'], ['MINIAPP', '顾客端'], ['MERCHANT_WEB', '商家 Web'], ['ADMIN_WEB', '平台后台']];
  const levels: Array<[SystemLogLevel | '', string]> = [['', '全部级别'], ['INFO', '信息'], ['WARN', '警告'], ['ERROR', '错误'], ['FATAL', '严重']];
  return <>
    <PagedList<SystemLogRecord> path="/admin/system-logs" title="系统日志" filters={{ source, level }}
      controls={<><Options values={sources} value={source} onChange={setSource} /><Options values={levels} value={level} onChange={setLevel} /></>}
      recordKey={(item) => item.id} render={(item) => <ListRow title={item.event} detail={`${item.message} · ${localTime(item.createdAt)}`}
        trailing={<Badge label={levels.find(([value]) => value === item.level)?.[1] ?? item.level} tone={item.level === 'ERROR' || item.level === 'FATAL' ? 'red' : 'purple'} />}
        onPress={() => setRecord(item)} />} />
    <Sheet visible={!!record} title="日志详情" onClose={() => setRecord(undefined)}>
      {record && <LogDetails record={record} />}
    </Sheet>
  </>;
}

export function SystemLogRecordView({ id }: { id: string }) {
  const { user, go } = useWorkspace();
  const allowed = !!user?.roles.includes('SUPER_ADMIN');
  const query = useData<SystemLogRecord>(`/admin/system-logs/${encodeURIComponent(id)}`, allowed);
  if (!allowed) return <Empty title="需要超级管理员权限" />;
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  return <Page>
    <Section title="系统告警"><LogDetails record={query.data} /></Section>
    <Button label="查看系统日志" variant="secondary" onPress={() => go({ type: 'collection', name: 'logs' })} />
  </Page>;
}

function LogDetails({ record }: { record: SystemLogRecord }) {
  return <>
    <Text style={layout.strong}>{record.event}</Text>
    <Text style={layout.body}>{record.message}</Text>
    <Text style={layout.muted}>{record.source} · {record.level} · {localTime(record.createdAt)}</Text>
    {record.path && <Text style={layout.muted}>{record.method} {record.path} {record.statusCode}</Text>}
    {record.requestId && <Text style={layout.muted} selectable>请求编号 {record.requestId}</Text>}
    {record.details && <Text style={layout.body} selectable>{JSON.stringify(record.details, null, 2)}</Text>}
  </>;
}
