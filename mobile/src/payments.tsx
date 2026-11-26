import type { OnlinePaymentChannel, PaymentProvider } from '@lingdian/contracts';
import { useState } from 'react';
import { useData, useWorkspace } from './context';
import { DataState, Options, Save, Toggle } from './operations';
import type { PaymentAccount, PaymentFormRoute } from './routes';
import { Badge, Button, Chip, ChipRow, Empty, ErrorLine, Field, ListRow, Page, Panel, Section, Sheet } from './ui';

const mapped: Record<PaymentProvider, { name: string; channel: OnlinePaymentChannel }> = {
  WECHAT_PAY: { name: '微信支付', channel: 'WECHAT' }, ALIPAY: { name: '支付宝', channel: 'ALIPAY' },
  UNIONPAY: { name: '银联', channel: 'UNIONPAY' }, STRIPE: { name: 'Stripe', channel: 'STRIPE' }, PAYPAL: { name: 'PayPal', channel: 'PAYPAL' },
};

export function PaymentAccounts() {
  const { workspace, user, go } = useWorkspace();
  const admin = workspace === 'admin';
  const write = admin && user?.roles.includes('SUPER_ADMIN');
  const query = useData<PaymentAccount[]>(admin ? '/payment-accounts' : '/merchant/payment-accounts');
  const stores = useData<Array<{ id: string; name: string }>>('/admin/users/options/stores', admin);
  const [selected, setSelected] = useState<PaymentAccount>();
  if (!query.data) return <DataState pending={query.isPending} error={query.error} reload={() => void query.refetch()} />;
  return <>
    <Page>
      <Section title="收款账户" accessory={write && <Button label="新增" icon="add" onPress={() => go({ type: 'form', name: 'payments', action: 'create' })} />}>
        {query.data.map((item) => <Panel key={item.id}><ListRow title={mapped[item.provider]?.name ?? item.provider}
          detail={stores.data?.find((store) => store.id === item.storeId)?.name || item.externalAccountId}
          trailing={<Badge label={item.status === 'ACTIVE' ? '启用' : '停用'} tone={item.status === 'ACTIVE' ? 'green' : 'amber'} />}
          onPress={() => setSelected(item)} /></Panel>)}
        {!query.data.length && <Empty title="暂无收款账户" icon="wallet-outline" />}
      </Section>
    </Page>
    <Sheet visible={!!selected} title="收款账户详情" onClose={() => setSelected(undefined)}>
      {selected && <>
        <ListRow title={mapped[selected.provider]?.name ?? selected.provider} detail={selected.externalAccountId} />
        <ListRow title="连接器配置标识" detail={selected.connectorConfigKey} />
        {write && <Button label="编辑收款账户" onPress={() => {
          setSelected(undefined);
          go({ type: 'form', name: 'payments', action: 'edit', data: { ...selected } });
        }} />}
      </>}
    </Sheet>
  </>;
}

export function PaymentAccountForm({ route }: { route: PaymentFormRoute }) {
  const { user } = useWorkspace();
  const initial = route.action === 'edit' ? route.data : undefined;
  const [store, setStore] = useState(initial?.storeId ?? '');
  const [provider, setProvider] = useState<PaymentProvider>(initial?.provider ?? 'WECHAT_PAY');
  const [external, setExternal] = useState(initial?.externalAccountId ?? '');
  const [connector, setConnector] = useState(initial?.connectorConfigKey ?? '');
  const [active, setActive] = useState(initial?.status !== 'DISABLED');
  const stores = useData<Array<{ id: string; name: string }>>('/admin/users/options/stores', !!user?.roles.includes('SUPER_ADMIN'));
  if (!user?.roles.includes('SUPER_ADMIN')) return <Empty title="需要超级管理员权限" />;
  const connectorValid = /^[A-Z0-9_]{2,64}$/.test(connector.trim());
  return <Save title={initial ? '编辑收款账户' : '新增收款账户'} path="/payment-accounts" method="PUT"
    disabled={!store || external.trim().length < 2 || !connectorValid}
    build={() => ({ storeId: store, provider, channel: mapped[provider].channel, externalAccountId: external.trim(), connectorConfigKey: connector.trim(), status: active ? 'ACTIVE' : 'DISABLED' })}>
    {initial ? <ListRow title={mapped[initial.provider]?.name ?? initial.provider} detail={stores.data?.find(({ id }) => id === store)?.name} /> : <>
      <Section title="收款门店">
        <ChipRow>{stores.data?.map((item) => <Chip key={item.id} label={item.name} selected={store === item.id} onPress={() => setStore(item.id)} />)}</ChipRow>
        {stores.isError && <Button label="重试加载门店" variant="secondary" onPress={() => void stores.refetch()} />}
      </Section>
      <Options values={Object.entries(mapped).map(([id, item]) => [id, item.name])} value={provider} onChange={(id) => setProvider(id as PaymentProvider)} />
    </>}
    <Field label="支付平台商户号" value={external} onChangeText={setExternal} maxLength={191} />
    <Field label="连接器配置标识" value={connector} onChangeText={setConnector} autoCapitalize="characters" maxLength={64} />
    <ErrorLine message={connector.trim() && !connectorValid ? '配置标识需为 2–64 位大写字母、数字或下划线。' : undefined} />
    <Toggle label="启用收款账户" value={active} onChange={setActive} />
  </Save>;
}
