import type { InboxUnreadStatus } from '@lingdian/contracts';
import { QueryClient, QueryClientProvider, focusManager, useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AccountHome, Password } from './account';
import { humanError, ApiError } from './api';
import { auth, availableWorkspaces, useAuth, workspaceLabel, type Workspace } from './auth';
import { Accounts, AdminHome } from './admin';
import { CartProvider } from './cart';
import { type Store, ScreenActiveContext, useWorkspace, WorkspaceContext } from './context';
import { CheckoutRecovery } from './checkout';
import { Menu } from './customer';
import { Inbox, useInboxUnread } from './inbox';
import { MerchantHome } from './merchant';
import { Orders } from './orders';
import { RouteScreen, routeTitle } from './route-screen';
import type { Route } from './routes';
import { colors, Empty, ErrorLine, Icon, IconButton, layout, ListRow, Loading, Panel, Sheet, type IconName, Button } from './ui';

type Tab = 'home' | 'work' | 'inbox' | 'account';
type RouteEntry = { instance: number; page: Route };
type NavigationState = { tab: Tab; routes: RouteEntry[]; storeId?: string };
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000, gcTime: 5 * 60_000,
      retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false, gcTime: 0 },
  },
});

const workspaceIcons: Record<Workspace, IconName> = { user: 'restaurant-outline', merchant: 'storefront-outline', admin: 'shield-checkmark-outline' };

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
    return () => subscription.remove();
  }, []);
  return <SafeAreaProvider><QueryClientProvider client={client}><Shell /></QueryClientProvider></SafeAreaProvider>;
}

function Shell() {
  const { user, workspace, restoring, loggingOut, issue } = useAuth();
  const [navigation, setNavigation] = useState<NavigationState>({ tab: 'home', routes: [] });
  const routeSequence = useRef(0);
  const [chooseWorkspace, setChooseWorkspace] = useState(false);
  const [chooseStore, setChooseStore] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [selectedStoreId, setSelectedStore] = useState<string>();
  const [customerStoreId, setCustomerStore] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [previous, setPrevious] = useState<{ id?: string; workspace: Workspace }>({ workspace: 'user' });
  const storeKey = `stores:${user?.sessionId ?? ''}`;
  const storeIds = useMemo(() => [...(user?.merchantStoreIds ?? [])].sort(), [user?.merchantStoreIds]);
  const stores = useQuery({
    queryKey: [storeKey, '/merchant/stores', storeIds],
    queryFn: ({ signal }) => auth.authenticated<Store[]>('merchant', user!.sessionId, undefined, '/merchant/stores', { signal }),
    enabled: !!user && workspace === 'merchant' && !user.mustChangePassword,
    placeholderData: (data, query) => query?.queryKey[0] === storeKey ? data : undefined,
    staleTime: 45_000,
  });
  const authorizedStores = useMemo(() => stores.data?.filter((item) => storeIds.includes(item.id)), [stores.data, storeIds]);
  const store = workspace === 'merchant'
    ? authorizedStores?.find((item) => item.id === selectedStoreId) ?? authorizedStores?.[0]
    : undefined;
  const key = user ? `private:${user.sessionId}:${store?.id ?? ''}` : 'guest';
  const scopedNavigation: NavigationState = navigation.storeId === store?.id
    ? navigation
    : { tab: 'home', routes: [], storeId: store?.id };
  // Reset before a form from the previous store can mount with the new store context.
  if (navigation !== scopedNavigation) setNavigation(scopedNavigation);
  const { tab, routes } = scopedNavigation;

  useEffect(() => { void auth.restore(); }, []);
  useEffect(() => {
    if (previous.id === user?.userId && previous.workspace === workspace) return;
    if (previous.id && previous.id !== user?.userId) {
      setSelectedStore(undefined);
      client.removeQueries({ predicate: ({ queryKey }) => typeof queryKey[0] === 'string'
        && (queryKey[0].startsWith('private:') || queryKey[0].startsWith('stores:')) });
      client.getMutationCache().clear();
    }
    if (previous.workspace !== workspace || (previous.id && !user)) {
      setNavigation((state) => ({ ...state, tab: 'home', routes: [] }));
    }
    setPrevious({ id: user?.userId, workspace });
  }, [previous, user, workspace]);

  useEffect(() => {
    if (workspace !== 'merchant' || !stores.isSuccess || stores.isPlaceholderData || selectedStoreId === store?.id) return;
    setSelectedStore(store?.id);
    if (selectedStoreId) {
      setChooseStore(false);
      setToast(store ? `门店列表已更新，当前为${store.name}` : '当前账号暂无可用门店');
    }
  }, [workspace, stores.isSuccess, stores.isPlaceholderData, selectedStoreId, store]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 3400);
    return () => clearTimeout(timer);
  }, [toast]);

  const go = useCallback((page: Route) => {
    const entry = { instance: ++routeSequence.current, page };
    setNavigation((state) => ({ ...state, routes: [...state.routes, entry] }));
  }, []);
  const back = useCallback(() => setNavigation((state) => ({ ...state, routes: state.routes.slice(0, -1) })), []);
  const signIn = useCallback(() => go({ type: 'login' }), [go]);
  const selectCustomerStore = useCallback((id?: string) => {
    setCustomerStore(id);
    setNavigation((state) => ({ ...state, tab: 'home', routes: [] }));
  }, []);
  const openTab = (next: Tab) => setNavigation((state) => ({ ...state, tab: next, routes: [] }));

  useEffect(() => {
    if (!routes.length) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  }, [routes.length, back]);

  const activeRoute = routes[routes.length - 1];
  const route = activeRoute?.page;
  const currentView = useRef({ key, route: activeRoute });
  useLayoutEffect(() => {
    currentView.current = { key, route: activeRoute };
  }, [key, activeRoute]);
  const sessionId = user?.sessionId;
  const isCurrent = useCallback(() => {
    const latest = auth.snapshot();
    return currentView.current.key === key && latest.workspace === workspace && latest.user?.sessionId === sessionId;
  }, [key, workspace, sessionId]);
  const inboxVisible = tab === 'inbox' && !route;
  const storesReady = workspace !== 'merchant' || !!store;
  const forced = user?.mustChangePassword;
  const inboxEnabled = !!user && storesReady && !forced;
  const unread = useInboxUnread({
    key,
    enabled: inboxEnabled && !loggingOut,
    visible: inboxVisible,
    call: (path, options) => auth.authenticated<InboxUnreadStatus>(workspace, user!.sessionId, store?.id, path, options),
    show: setToast,
  });
  const count = unread?.count ?? 0;
  const context = useMemo(() => ({
    workspace, user, store, customerStoreId, selectCustomerStore, key, isCurrent, go, back, signIn, show: setToast,
  }), [workspace, user, store, customerStoreId, selectCustomerStore, key, isCurrent, go, back, signIn]);
  const stack = useMemo(() => routes.map((entry) => {
    const active = entry === activeRoute;
    const isRouteCurrent = () => context.isCurrent() && currentView.current.route === entry;
    const closeEntry = () => setNavigation((state) => state.routes[state.routes.length - 1] === entry
      ? { ...state, routes: state.routes.slice(0, -1) }
      : state);
    return <View key={entry.instance} style={active ? layout.flex : styles.hidden}
      accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
      <WorkspaceContext.Provider value={{ ...context, isCurrent: isRouteCurrent, back: () => {
        if (isRouteCurrent()) closeEntry();
      } }}>
        <ScreenActiveContext.Provider value={active}>
          <RouteScreen route={entry.page} onLogin={() => {
            const checkout = entry.page.type === 'login' ? entry.page.checkout : undefined;
            const session = auth.snapshot();
            if (checkout && session.workspace === 'user' && session.user) {
              const checkoutEntry = { instance: ++routeSequence.current, page: checkout };
              setNavigation((state) => state.routes[state.routes.length - 1] === entry
                ? { ...state, routes: [...state.routes.slice(0, -1), checkoutEntry] }
                : state);
            } else closeEntry();
            setToast('登录成功');
          }} onOrdered={(id) => {
            if (!isRouteCurrent()) return;
            const orderEntry: RouteEntry = { instance: ++routeSequence.current, page: { type: 'order', id } };
            setNavigation((state) => state.routes[state.routes.length - 1] === entry
              ? { ...state, tab: 'work', routes: [orderEntry] }
              : state);
          }} />
        </ScreenActiveContext.Provider>
      </WorkspaceContext.Provider>
    </View>;
  }), [routes, activeRoute, context]);

  async function changeWorkspace(mode: Workspace) {
    if (switching || loggingOut) return;
    setSwitching(true);
    try {
      const used = await auth.switchWorkspace(mode);
      setChooseWorkspace(false);
      if (!used) go({ type: 'login', workspace: mode });
    } catch (error) {
      setToast(humanError(error));
    } finally {
      setSwitching(false);
    }
  }

  return <WorkspaceContext.Provider value={context}>
    <StatusBar style="dark" />
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <CartProvider enabled={!restoring && !issue}>
        <TopBar route={forced ? undefined : route} canNotify={inboxEnabled} count={count}
          openWorkspace={forced || restoring || loggingOut || issue ? undefined : user ? () => setChooseWorkspace(true) : signIn} openStore={store && !route ? () => setChooseStore(true) : undefined}
          openInbox={() => openTab('inbox')} />
        {restoring ? <Loading label="正在恢复登录…" />
          : issue ? <Empty title="无法恢复登录" detail={issue} action="重试" onAction={() => void auth.restore()} />
          : forced ? <Password forced />
          : !storesReady && stores.isPending ? <Loading label="正在加载授权门店…" />
          : !storesReady ? <Empty title="当前身份暂时没有可用门店" detail={stores.error ? humanError(stores.error) : undefined} action="刷新门店" onAction={() => void stores.refetch()} />
          : <View key={key} style={layout.flex}>
            {workspace === 'user' && user && <CheckoutRecovery visible={!route} />}
            <View style={route ? styles.hidden : layout.flex} accessibilityElementsHidden={!!route}
              importantForAccessibility={route ? 'no-hide-descendants' : 'auto'}>
              <ScreenActiveContext.Provider value={!route}>
                <TabScreen tab={tab} unread={unread} chooseWorkspace={() => setChooseWorkspace(true)} />
              </ScreenActiveContext.Provider>
            </View>
            {stack}
          </View>}
        {!route && !forced && !restoring && storesReady && !issue && <Navigation tab={tab} count={count} onChange={openTab} />}
        {issue && <Button label="先浏览菜单" variant="plain" onPress={auth.continueAsGuest} />}
      </CartProvider>
      {!!toast && <View pointerEvents="none" style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={styles.toastText}>{toast}</Text>
      </View>}
      <Sheet visible={!!user && chooseWorkspace && !loggingOut} title="切换身份" onClose={() => { if (!switching) setChooseWorkspace(false); }}>
        {availableWorkspaces(user).map((mode) => <Panel key={mode}><ListRow
          icon={workspaceIcons[mode]} title={workspaceLabel[mode]}
          value={user && mode === workspace ? '当前' : undefined} onPress={() => void changeWorkspace(mode)} /></Panel>)}
        {switching && <Loading label="正在验证身份…" />}
      </Sheet>
      <Sheet visible={chooseStore && !!store} title="选择门店" onClose={() => setChooseStore(false)}>
        {authorizedStores?.map((item) => <Panel key={item.id}><ListRow icon="storefront-outline" title={item.name}
          detail={item.code} value={item.id === store?.id ? '当前' : undefined} onPress={() => {
            setSelectedStore(item.id);
            setChooseStore(false);
            setNavigation({ tab: 'home', routes: [], storeId: item.id });
          }} /></Panel>)}
        {stores.isError && <ErrorLine message={humanError(stores.error)} />}
      </Sheet>
    </SafeAreaView>
  </WorkspaceContext.Provider>;
}

function TopBar({ route, canNotify, count, openWorkspace, openStore, openInbox }: {
  route?: Route; canNotify: boolean; count: number; openWorkspace?: () => void; openStore?: () => void; openInbox: () => void;
}) {
  const { back, user, workspace, store } = useWorkspace();
  return <View style={styles.top}>
    <View style={styles.topInner}>
      {route ? <>
        <IconButton label="返回" icon="chevron-back" onPress={back} />
        <Text style={[styles.topTitle, layout.flex]} numberOfLines={1}>{routeTitle(route)}</Text>
      </> : <>
        <View style={styles.brand}>
          <View style={styles.mark}><Icon name="time-outline" size={22} color={colors.white} /></View>
          <Text style={styles.wordmark}>零点</Text>
        </View>
        {openStore && <Pressable accessibilityRole="button" accessibilityLabel={`切换门店，当前${store?.name ?? ''}`} onPress={openStore} style={[styles.role, styles.storeRole]}>
          <Icon name="storefront-outline" size={15} color={colors.primary} />
          <Text style={[styles.roleText, { flexShrink: 1 }]} numberOfLines={1}>{store?.name}</Text>
        </Pressable>}
        {openWorkspace && <Pressable accessibilityRole="button" accessibilityLabel={user ? `切换身份，当前${workspaceLabel[workspace]}` : '登录'} onPress={openWorkspace} style={styles.role}>
          <Text style={styles.roleText} numberOfLines={1}>{user ? workspaceLabel[workspace] : '登录'}</Text><Icon name={user ? 'chevron-down' : 'chevron-forward'} size={13} color={colors.primary} />
        </Pressable>}
      </>}
      {canNotify && <IconButton label="站内消息" icon="notifications-outline" badge={count} onPress={openInbox} />}
    </View>
  </View>;
}

function Navigation({ tab, count, onChange }: { tab: Tab; count: number; onChange: (tab: Tab) => void }) {
  const { workspace } = useWorkspace();
  const tabs: Array<{ tab: Tab; label: string; icon: IconName; active: IconName }> = [
    { tab: 'home', label: workspace === 'user' ? '点餐' : '工作台', icon: workspace === 'user' ? 'restaurant-outline' : 'grid-outline', active: workspace === 'user' ? 'restaurant' : 'grid' },
    { tab: 'work', label: workspace === 'admin' ? '账号' : '订单', icon: workspace === 'admin' ? 'people-outline' : 'receipt-outline', active: workspace === 'admin' ? 'people' : 'receipt' },
    { tab: 'inbox', label: '消息', icon: 'notifications-outline', active: 'notifications' },
    { tab: 'account', label: '我的', icon: 'person-outline', active: 'person' },
  ];
  return <View style={styles.nav}>
    {tabs.map((item) => {
      const selected = item.tab === tab;
      return <Pressable key={item.tab} accessibilityRole="tab" accessibilityState={{ selected }}
        accessibilityLabel={item.tab === 'inbox' && count ? `消息，${count} 条未读` : item.label}
        onPress={() => onChange(item.tab)} style={styles.navButton}>
        <View style={[styles.navIcon, selected && styles.navActive]}><Icon name={selected ? item.active : item.icon} color={selected ? colors.primary : colors.muted} size={21} />
          {item.tab === 'inbox' && count > 0 && <View style={styles.navDot} />}
        </View>
        <Text style={[styles.navText, selected && styles.navSelected]}>{item.label}</Text>
      </Pressable>;
    })}
  </View>;
}

function TabScreen({ tab, unread, chooseWorkspace }: { tab: Tab; unread?: InboxUnreadStatus; chooseWorkspace: () => void }) {
  const { workspace, customerStoreId } = useWorkspace();
  if (tab === 'inbox') return <Inbox unread={unread} />;
  if (tab === 'account') return <AccountHome openWorkspace={chooseWorkspace} />;
  if (tab === 'work') return workspace === 'admin' ? <Accounts /> : <Orders />;
  if (workspace === 'admin') return <AdminHome />;
  if (workspace === 'merchant') return <MerchantHome />;
  return <Menu key={customerStoreId ?? 'primary-store'} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  hidden: { display: 'none' },
  top: { backgroundColor: colors.canvas, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  topInner: { flexDirection: 'row', alignItems: 'center', minHeight: 64, width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 18, gap: 8 },
  brand: { marginRight: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  mark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  wordmark: { color: colors.ink, fontSize: 20, lineHeight: 23, fontWeight: '800' },
  topTitle: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  role: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 12, paddingHorizontal: 10, minHeight: 44, gap: 5, maxWidth: 130 },
  storeRole: { flexShrink: 1, minWidth: 44 },
  roleText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  nav: { backgroundColor: colors.white, flexDirection: 'row', width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 10, borderTopColor: colors.line, borderTopWidth: 1 },
  navButton: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIcon: { alignItems: 'center', justifyContent: 'center', width: 46, height: 30, borderRadius: 13 },
  navActive: { backgroundColor: colors.lavender },
  navText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  navSelected: { color: colors.primary, fontWeight: '800' },
  navDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger, top: 3, right: 9 },
  toast: { position: 'absolute', bottom: 84, backgroundColor: colors.dark, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 10, alignSelf: 'center', maxWidth: '82%' },
  toastText: { color: colors.white, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
