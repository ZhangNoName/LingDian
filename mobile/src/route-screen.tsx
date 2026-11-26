import { Legal, Login, Password, Profile } from './account';
import { AddressEditor, Addresses } from './addresses';
import { AccountEditor, AccountRecord, Accounts, SystemLogRecordView, SystemLogs } from './admin';
import { workspaceLabel, type Workspace } from './auth';
import { CatalogCollection, CatalogForm, CatalogRecord } from './catalog';
import { Checkout } from './checkout';
import { useWorkspace } from './context';
import { CustomerStores, Product } from './customer';
import { InventoryEditor } from './inventory-forms';
import { InventoryCollection, InventoryRecord } from './inventory';
import { Hold, Holds, Integrations, StoreSettings } from './merchant';
import { Order, Orders } from './orders';
import { PaymentAccountForm, PaymentAccounts } from './payments';
import { collectionTitle, type CollectionRoute, type Route } from './routes';
import { Empty } from './ui';

export function routeTitle(route: Route): string {
  switch (route.type) {
    case 'login': return route.workspace ? `${workspaceLabel[route.workspace]}登录` : '登录';
    case 'product': return route.editLineId ? '重新选择规格' : '商品详情';
    case 'customer-stores': return '选择门店';
    case 'checkout': return '订单确认';
    case 'addresses': return '收货地址';
    case 'address-editor': return route.id ? '编辑收货地址' : '新增收货地址';
    case 'profile': return '个人资料';
    case 'password': return '修改密码';
    case 'store': return '门店设置';
    case 'order': return '订单详情';
    case 'legal': return route.document === 'agreement' ? '用户服务协议' : '隐私保护政策';
    case 'collection': return collectionTitle(route.name);
    case 'record':
      if (route.name === 'logs') return '告警详情';
      if (route.name === 'trend') return '库存趋势';
      return '详情';
    case 'form': return '编辑';
  }
}

export function RouteScreen({ route, onLogin, onOrdered }: { route: Route; onLogin: () => void; onOrdered: (id: string) => void }) {
  const { user, workspace, signIn } = useWorkspace();
  if (route.type === 'login') return <Login key={route.workspace} mode={route.workspace} onSuccess={onLogin} />;
  if (route.type === 'legal') return <Legal document={route.document} />;
  if (workspace === 'user') {
    if (route.type === 'product') return <Product {...route} />;
    if (route.type === 'customer-stores') return <CustomerStores {...route} />;
  }
  if (!user) return <Empty title="登录后继续" action="登录" onAction={signIn} />;
  switch (route.type) {
    case 'checkout':
      if (workspace === 'user') return <Checkout {...route} onOrdered={onOrdered} />;
      break;
    case 'addresses':
      if (workspace === 'user') return <Addresses />;
      break;
    case 'address-editor':
      if (workspace === 'user') return <AddressEditor id={route.id} />;
      break;
    case 'profile': return <Profile />;
    case 'password':
      if (workspace !== 'user') return <Password />;
      break;
    case 'store':
      if (workspace === 'merchant') return <StoreSettings />;
      break;
    case 'order': return <Order id={route.id} />;
    case 'collection': return <CollectionScreen route={route} workspace={workspace} />;
    case 'record': return <RecordScreen route={route} workspace={workspace} />;
    case 'form': return <FormScreen route={route} workspace={workspace} />;
  }
  return <UnavailableRoute />;
}

function UnavailableRoute() {
  return <Empty title="当前身份无法访问此页面" />;
}

function CollectionScreen({ route, workspace }: { route: CollectionRoute; workspace: Workspace }) {
  switch (route.name) {
    case 'orders':
      if (workspace !== 'user') return <Orders initial={route.orders} />;
      break;
    case 'payments':
      if (workspace !== 'user') return <PaymentAccounts />;
      break;
    case 'accounts':
      if (workspace === 'admin') return <Accounts />;
      break;
    case 'logs':
      if (workspace === 'admin') return <SystemLogs />;
      break;
    case 'products':
    case 'categories':
      if (workspace === 'merchant') return <CatalogCollection name={route.name} />;
      break;
    case 'integrations':
      if (workspace === 'merchant') return <Integrations />;
      break;
    case 'holds':
      if (workspace === 'merchant') return <Holds />;
      break;
    case 'inventory':
    case 'alerts':
    case 'recipes':
    case 'suppliers':
    case 'purchases':
    case 'stocktakes':
    case 'movements':
    case 'report':
    case 'replenishment':
    case 'receiptReport':
      if (workspace === 'merchant') return <InventoryCollection route={route} />;
      break;
  }
  return <UnavailableRoute />;
}

function RecordScreen({ route, workspace }: { route: Extract<Route, { type: 'record' }>; workspace: Workspace }) {
  const { id, name } = route;
  switch (name) {
    case 'accounts':
      if (workspace === 'admin') return <AccountRecord id={id} />;
      break;
    case 'logs':
      if (workspace === 'admin') return <SystemLogRecordView id={id} />;
      break;
    case 'products':
      if (workspace === 'merchant') return <CatalogRecord id={id} />;
      break;
    case 'holds':
      if (workspace === 'merchant') return <Hold id={id} />;
      break;
    case 'inventory':
    case 'alerts':
    case 'recipes':
    case 'purchases':
    case 'stocktakes':
    case 'trend':
    case 'usage':
    case 'changes':
    case 'receipts':
      if (workspace === 'merchant') return <InventoryRecord name={name} id={id} />;
      break;
  }
  return <UnavailableRoute />;
}

function FormScreen({ route, workspace }: { route: Extract<Route, { type: 'form' }>; workspace: Workspace }) {
  switch (route.name) {
    case 'accounts':
      if (workspace === 'admin') return <AccountEditor route={route} />;
      break;
    case 'payments':
      if (workspace === 'admin') return <PaymentAccountForm route={route} />;
      break;
    case 'products':
    case 'categories':
      if (workspace === 'merchant') return <CatalogForm route={route} />;
      break;
    case 'inventory':
    case 'suppliers':
    case 'purchases':
    case 'stocktakes':
    case 'alerts':
    case 'recipes':
      if (workspace === 'merchant') return <InventoryEditor route={route} />;
      break;
  }
  return <UnavailableRoute />;
}
