import type { CreateUserAddressRequest, UpdateUserAddressRequest, UserAddress } from '@lingdian/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { addressesPath, formatAddress } from './address-selection';
import { ApiError, humanError } from './api';
import { useApi, useData, useWorkspace } from './context';
import { DataState } from './operations';
import { Badge, Button, Empty, ErrorLine, Field, layout, Page, Panel } from './ui';

const addressPath = (id: string) => `${addressesPath}/${encodeURIComponent(id)}`;

export function Addresses() {
  const { go } = useWorkspace();
  const query = useData<UserAddress[]>(addressesPath);
  const api = useApi();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState<string>();
  const action = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove?: boolean }) => remove
      ? api.call(addressPath(id), { method: 'DELETE' })
      : api.call(`${addressPath(id)}/default`, { method: 'PATCH' }),
    onSuccess: async () => {
      setConfirm(undefined);
      await client.invalidateQueries({ queryKey: [api.key, addressesPath] });
    },
  });
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  const atLimit = query.data.length >= 20;
  return <Page footer={<View style={layout.compact}>
    <ErrorLine message={action.error ? humanError(action.error) : undefined} />
    {atLimit && <Text style={layout.muted}>已保存 20 条地址</Text>}
    <Button label="添加收货地址" icon="add" disabled={atLimit || action.isPending} onPress={() => go({ type: 'address-editor' })} />
  </View>}>
    {query.isRefetchError && <>
      <ErrorLine message={humanError(query.error)} />
      <Button label="刷新地址" variant="secondary" onPress={() => void query.refetch()} />
    </>}
    {query.data.map((address) => <Panel key={address.id} style={[layout.pad, layout.stack]}>
      <View style={layout.split}>
        <Text style={[layout.strong, layout.flex]}>{address.recipientName} · {address.phoneNumber}</Text>
        {address.isDefault && <Badge label="默认" />}
      </View>
      <Text style={layout.body}>{formatAddress(address)}</Text>
      <View style={[layout.horizontal, { flexWrap: 'wrap' }]}>
        {confirm === address.id ? <>
          <Button label="确认删除" variant="danger" busy={action.isPending} onPress={() => action.mutate({ id: address.id, remove: true })} />
          <Button label="取消" variant="plain" disabled={action.isPending} onPress={() => { setConfirm(undefined); action.reset(); }} />
        </> : <>
          <Button label="编辑" variant="secondary" disabled={action.isPending}
            onPress={() => go({ type: 'address-editor', id: address.id })} />
          {!address.isDefault && <Button label="设为默认" variant="secondary" disabled={action.isPending}
            onPress={() => action.mutate({ id: address.id })} />}
          <Button label="删除" variant="plain" disabled={action.isPending} onPress={() => { setConfirm(address.id); action.reset(); }} />
        </>}
      </View>
    </Panel>)}
    {!query.data.length && <Empty title="还没有收货地址" icon="location-outline" />}
  </Page>;
}

const fields = [
  { key: 'recipientName', label: '收货人', maxLength: 64 },
  { key: 'phoneNumber', label: '手机号码', maxLength: 32 },
  { key: 'provinceName', label: '省份', maxLength: 64 },
  { key: 'cityName', label: '城市', maxLength: 64 },
  { key: 'countyName', label: '区县', maxLength: 64 },
  { key: 'streetName', label: '街道（选填）', maxLength: 128 },
  { key: 'detailInfo', label: '详细地址', maxLength: 255 },
  { key: 'postalCode', label: '邮政编码（选填）', maxLength: 16 },
] as const;
const required = ['recipientName', 'phoneNumber', 'provinceName', 'cityName', 'countyName', 'detailInfo'] as const;
const emptyAddress: CreateUserAddressRequest = {
  recipientName: '', phoneNumber: '', provinceName: '', cityName: '', countyName: '',
  streetName: '', detailInfo: '', postalCode: '', nationalCode: 'CN',
};

export function AddressEditor({ id }: { id?: string }) {
  const query = useData<UserAddress[]>(addressesPath, !!id);
  const record = query.data?.find((address) => address.id === id);
  if (id && !query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  if (id && !record) return <Empty title="这条收货地址已删除" icon="location-outline" />;
  return <AddressFields record={record} reload={async () => {
    const result = await query.refetch({ throwOnError: true });
    return result.data?.find((address) => address.id === id);
  }} />;
}

function AddressFields({ record, reload }: { record?: UserAddress; reload: () => Promise<UserAddress | undefined> }) {
  const api = useApi();
  const client = useQueryClient();
  const { back, show, isCurrent } = useWorkspace();
  const [revision, setRevision] = useState(record?.updatedAt);
  const [draft, setDraft] = useState<CreateUserAddressRequest>(record ?? emptyAddress);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string>();
  const save = useMutation({
    mutationFn: (input: CreateUserAddressRequest) => {
      if (!record) return api.call<UserAddress>(addressesPath, { method: 'POST', body: input });
      const body: UpdateUserAddressRequest = { ...input, expectedUpdatedAt: revision! };
      return api.call<UserAddress>(addressPath(record.id), { method: 'PUT', body });
    },
    onSuccess: (saved) => {
      client.setQueryData<UserAddress[]>([api.key, addressesPath], (current) => current && [
        ...current.filter((item) => item.id !== saved.id), saved,
      ].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || right.updatedAt.localeCompare(left.updatedAt)));
      void client.invalidateQueries({ queryKey: [api.key, addressesPath] });
      if (isCurrent()) {
        show(record ? '地址已更新' : '地址已保存');
        back();
      }
    },
    onError: (error) => {
      if (record && error instanceof ApiError && error.status === 404) {
        void client.invalidateQueries({ queryKey: [api.key, addressesPath] });
      }
    },
  });
  const outOfDate = save.error instanceof ApiError && save.error.status === 409
    && typeof save.error.details === 'object' && save.error.details !== null
    && 'reason' in save.error.details && save.error.details.reason === 'ADDRESS_CHANGED';
  const phoneValid = /^(?:\+?86)?1[3-9]\d{9}$/.test(draft.phoneNumber.trim());
  const busy = save.isPending || reloading;
  const canSave = !busy && !outOfDate && phoneValid && required.every((key) => draft[key].trim());
  const saveAddress = () => {
    const input = { ...emptyAddress, nationalCode: draft.nationalCode };
    for (const { key } of fields) input[key] = draft[key].trim();
    save.mutate(input);
  };
  const loadLatest = async () => {
    setReloading(true);
    setReloadError(undefined);
    try {
      const latest = await reload();
      if (latest) {
        setRevision(latest.updatedAt);
        setDraft(latest);
        save.reset();
      }
    } catch (error) {
      setReloadError(humanError(error));
    } finally {
      setReloading(false);
    }
  };
  return <Page footer={<View style={layout.compact}>
    <ErrorLine message={reloadError ?? (save.error ? humanError(save.error) : undefined)} />
    {outOfDate ? <Button label="加载最新地址" busy={reloading} onPress={() => void loadLatest()} />
      : <Button label="保存地址" disabled={!canSave} busy={save.isPending} onPress={saveAddress} />}
  </View>}>
    {fields.map(({ key, label, maxLength }) => <Field key={key} label={label} maxLength={maxLength}
      value={draft[key]} editable={!busy} keyboardType={key === 'phoneNumber' ? 'phone-pad' : 'default'}
      multiline={key === 'detailInfo'} onChangeText={(value) => setDraft((old) => ({ ...old, [key]: value }))} />)}
    {!!draft.phoneNumber && !phoneValid && <ErrorLine message="请输入有效的中国大陆手机号码。" />}
  </Page>;
}
