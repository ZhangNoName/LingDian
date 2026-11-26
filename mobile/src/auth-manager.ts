import type { AccountLoginRequest, AuthAudience, AuthenticatedUser, MobileAccountLoginRequest, MobileAccountLoginResult, MobileAuthTokens, PhoneLoginRequest } from '@lingdian/contracts';
import type { request, RequestOptions } from './api';
import { ApiError } from './api-error';

export type Workspace = 'user' | 'merchant' | 'admin';
export const workspaces: Workspace[] = ['user', 'merchant', 'admin'];
export const audience: Record<Workspace, AuthAudience> = { user: 'user-api', merchant: 'merchant-api', admin: 'admin-api' };
export const workspaceLabel: Record<Workspace, string> = { user: '顾客', merchant: '商家', admin: '平台管理' };

export type AccountWorkspace = Exclude<Workspace, 'user'>;
const accountWorkspaces: Record<AccountLoginRequest['audience'], AccountWorkspace> = {
  'merchant-api': 'merchant', 'admin-api': 'admin',
};

type Credentials = AccountLoginRequest | PhoneLoginRequest;
type Session = { access: string; refresh: string; user: AuthenticatedUser; expiresAt: number };
type Snapshot = { user: AuthenticatedUser | null; workspace: Workspace; restoring: boolean; loggingOut?: boolean; issue?: string };
function canUse(user: AuthenticatedUser, workspace: Workspace): boolean {
  if (workspace === 'admin') return user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
  return workspace === 'user' ? user.roles.includes('USER') : user.roles.includes('MERCHANT');
}

export function availableWorkspaces(user: AuthenticatedUser | null): Workspace[] {
  return user ? workspaces.filter((workspace) => audience[workspace] === user.audience || canUse(user, workspace)) : workspaces;
}

type SessionStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

type AuthDependencies = {
  storage: SessionStorage;
  request: typeof request;
  createDeviceId: () => string;
  realm: string;
};

const installationKey = 'lingdian-mobile-installation';

export class AuthManager {
  private state: Snapshot = { user: null, workspace: 'user', restoring: true };
  private listeners = new Set<() => void>();
  private sessions = new Map<Workspace, Session>();
  private pending = new Map<Workspace, Promise<Session>>();
  private installation?: Promise<string>;
  private boot?: Promise<void>;
  private changingIdentity = false;
  private logoutOperation?: Promise<void>;
  private revision = 0;
  private storageQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dependencies: AuthDependencies) {}

  private activeKey() {
    return `lingdian-mobile-workspace-${this.dependencies.realm}`;
  }

  private sessionKey(workspace: Workspace) {
    return `lingdian-mobile-session-${workspace}-${this.dependencies.realm}`;
  }

  private persist<T>(revision: number, write: () => Promise<T>): Promise<T | undefined> {
    const operation = this.storageQueue.then(() => revision === this.revision ? write() : undefined);
    this.storageQueue = operation.catch(() => undefined);
    return operation;
  }

  snapshot = () => this.state;

  subscribe = (onChange: () => void) => {
    this.listeners.add(onChange);
    return () => { this.listeners.delete(onChange); };
  };

  private publish(state: Snapshot) {
    this.state = state;
    this.listeners.forEach((notify) => notify());
  }

  device(): Promise<string> {
    this.installation ??= (async () => {
      const device = await this.dependencies.storage.get(installationKey) ?? this.dependencies.createDeviceId();
      await this.dependencies.storage.set(installationKey, device);
      return device;
    })().catch((error: unknown) => {
      this.installation = undefined;
      throw error;
    });
    return this.installation;
  }

  restore = (): Promise<void> => {
    this.boot ??= this.restoreActive().finally(() => { this.boot = undefined; });
    return this.boot;
  };

  private async restoreActive() {
    const revision = this.revision;
    this.publish({ ...this.state, restoring: true, issue: undefined });
    try {
      const last = await this.dependencies.storage.get(this.activeKey()) as Workspace | null;
      if (!last || !workspaces.includes(last)) {
        if (revision === this.revision) this.publish({ user: null, workspace: 'user', restoring: false });
        return;
      }
      const session = await this.refresh(last);
      if (revision === this.revision) this.publish({ user: session.user, workspace: last, restoring: false });
    } catch (error) {
      if (revision !== this.revision) return;
      const expired = error instanceof ApiError && error.status === 401;
      this.publish({
        user: null, workspace: 'user', restoring: false,
        issue: expired ? undefined : '暂时无法恢复登录，请重试。',
      });
    }
  }

  continueAsGuest = () => {
    this.revision++;
    this.publish({ user: null, workspace: 'user', restoring: false });
  };

  private async accept(mode: Workspace, data: MobileAuthTokens, revision: number, expectedUser?: string): Promise<Session> {
    if (revision !== this.revision || data.user.audience !== audience[mode] || (expectedUser && data.user.userId !== expectedUser)) {
      throw new ApiError(401, '身份校验失败，请重新登录。');
    }
    await this.persist(revision, () => this.dependencies.storage.set(this.sessionKey(mode), data.refresh_token));
    if (revision !== this.revision) throw new ApiError(401, '会话已切换。');
    const session = {
      access: data.access_token, refresh: data.refresh_token, user: data.user,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    this.sessions.set(mode, session);
    return session;
  }

  private refresh(mode: Workspace): Promise<Session> {
    const inProgress = this.pending.get(mode);
    if (inProgress) return inProgress;
    const revision = this.revision;
    const expected = this.sessions.get(mode)?.user.userId ?? this.state.user?.userId;
    const rotation = (async () => {
      const refreshToken = this.sessions.get(mode)?.refresh ?? await this.dependencies.storage.get(this.sessionKey(mode));
      if (!refreshToken) throw new ApiError(401, '请登录后继续。');
      try {
        const token = await this.dependencies.request<MobileAuthTokens>('/auth/mobile/refresh', {
          method: 'POST', body: { refreshToken },
        }, { device: await this.device() });
        const session = await this.accept(mode, token, revision, expected);
        if (this.state.workspace === mode && this.state.user && !this.state.loggingOut) this.publish({ ...this.state, user: session.user });
        return session;
      } catch (error) {
        if (revision === this.revision && error instanceof ApiError && error.status === 401) {
          this.sessions.delete(mode);
          await this.persist(revision, () => this.dependencies.storage.remove(this.sessionKey(mode)));
          if (revision === this.revision && this.state.workspace === mode && this.state.user && !this.state.loggingOut) this.continueAsGuest();
        }
        throw error;
      }
    })();
    this.pending.set(mode, rotation);
    void rotation.finally(() => {
      if (this.pending.get(mode) === rotation) this.pending.delete(mode);
    }).catch(() => undefined);
    return rotation;
  }

  private async getSession(mode: Workspace): Promise<Session> {
    const session = this.sessions.get(mode);
    if (session && session.expiresAt > Date.now() + 12_000) return session;
    return this.refresh(mode);
  }

  private async withIdentityChange<T>(run: () => Promise<T>): Promise<T> {
    if (this.changingIdentity) throw new ApiError(409, '有身份验证正在进行，请稍候。');
    this.changingIdentity = true;
    try {
      return await run();
    } finally {
      this.changingIdentity = false;
    }
  }

  signIn(mode: Workspace, credential: Credentials) {
    return this.withIdentityChange(() => this.authenticateIdentity(mode, credential));
  }

  signInWithAccount(credential: MobileAccountLoginRequest): Promise<AccountWorkspace[] | undefined> {
    return this.withIdentityChange(async () => {
      const revision = this.revision;
      if (this.state.user || this.state.restoring) throw new ApiError(409, '当前会话已变化，请返回后重试。');
      const result = await this.dependencies.request<MobileAccountLoginResult>('/auth/mobile/account/login', {
        method: 'POST', body: credential,
      }, { device: await this.device() });
      if (revision !== this.revision) throw new ApiError(401, '会话已切换。');
      if ('audiences' in result) return result.audiences.map((entry) => accountWorkspaces[entry]);

      const selected = result.user.audience;
      if (selected === 'user-api') throw new ApiError(401, '身份校验失败，请重新登录。');
      await this.activate(accountWorkspaces[selected], result, revision);
      return undefined;
    });
  }

  private async authenticateIdentity(mode: Workspace, credential: Credentials) {
    const revision = this.revision;
    const user = this.state.user;
    const workspace = this.state.workspace;
    if (user && !availableWorkspaces(user).includes(mode)) throw new ApiError(403, '当前账号未获该身份授权。');
    const device = await this.device();
    const original = user ? await this.getSession(workspace) : undefined;
    if (revision !== this.revision) throw new ApiError(401, '会话已切换。');
    const switching = user && user.audience !== audience[mode];
    const runner = 'phone' in credential ? 'phone' : 'account';
    const token = await this.dependencies.request<MobileAuthTokens>(`/auth/mobile/${runner}/${switching ? 'switch' : 'login'}`, {
      method: 'POST', body: credential,
    }, { device, token: switching ? original?.access : undefined });
    await this.activate(mode, token, revision, user?.userId);
  }

  private async activate(mode: Workspace, token: MobileAuthTokens, revision: number, userId?: string) {
    if (!userId && revision === this.revision) {
      this.sessions.clear();
      await this.persist(revision, () => Promise.all(workspaces.filter((role) => role !== mode).map((role) => this.dependencies.storage.remove(this.sessionKey(role)))));
    }
    const session = await this.accept(mode, token, revision, userId);
    await this.persist(revision, () => this.dependencies.storage.set(this.activeKey(), mode));
    if (revision === this.revision) this.publish({ user: session.user, workspace: mode, restoring: false });
  }

  async switchWorkspace(mode: Workspace): Promise<boolean> {
    const { user } = this.state;
    if (this.changingIdentity) throw new ApiError(409, '有身份验证正在进行，请稍候。');
    if (this.state.workspace === mode && user) return true;
    if (!user || !canUse(user, mode)) return false;
    this.changingIdentity = true;
    const revision = this.revision;
    try {
      const session = await this.getSession(mode);
      if (revision !== this.revision || session.user.userId !== user.userId || !canUse(session.user, mode)) return false;
      await this.persist(revision, () => this.dependencies.storage.set(this.activeKey(), mode));
      if (revision !== this.revision) return false;
      this.publish({ user: session.user, workspace: mode, restoring: false });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return false;
      throw error;
    } finally {
      this.changingIdentity = false;
    }
  }

  async authenticated<T>(mode: Workspace, sessionId: string, storeId: string | undefined, path: string, options?: RequestOptions) {
    if (this.state.loggingOut || this.state.workspace !== mode || this.state.user?.sessionId !== sessionId) throw new ApiError(401, '会话已切换。');
    const send = (session: Session) => {
      if (this.state.loggingOut || this.state.workspace !== mode || this.state.user?.sessionId !== sessionId) throw new ApiError(401, '会话已切换。');
      if (mode === 'merchant' && storeId !== undefined && !session.user.merchantStoreIds?.includes(storeId)) {
        throw new ApiError(403, '当前账号已无法访问该门店。');
      }
      return this.dependencies.request<T>(path, options, { token: session.access, store: storeId });
    };
    const used = await this.getSession(mode);
    try {
      return await send(used);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || options?.signal?.aborted) throw error;
      if (this.state.loggingOut || this.state.workspace !== mode || this.state.user?.sessionId !== sessionId) throw error;
      const latest = this.sessions.get(mode);
      return send(latest && latest.access !== used.access ? latest : await this.refresh(mode));
    }
  }

  async logout(all = false) {
    if (this.logoutOperation) return this.logoutOperation;
    if (this.changingIdentity) throw new ApiError(409, '有身份验证正在进行，请稍候。');
    this.changingIdentity = true;
    this.logoutOperation = this.endSession(all).finally(() => {
      this.changingIdentity = false;
      this.logoutOperation = undefined;
    });
    return this.logoutOperation;
  }

  private async endSession(all: boolean) {
    const { workspace } = this.state;
    this.publish({ ...this.state, loggingOut: true });
    try {
      // A refresh already sent to the server may have rotated the token needed to sign out.
      await Promise.allSettled(this.pending.values());
      if (all) {
        const active = await this.getSession(workspace);
        await this.dependencies.request('/auth/logout-all', { method: 'POST' }, { token: active.access });
      } else {
        const results = await Promise.allSettled(workspaces.map(async (role) => {
          const session = this.sessions.get(role) ?? (await this.dependencies.storage.get(this.sessionKey(role)) ? await this.getSession(role) : undefined);
          if (!session) return;
          const usable = session.expiresAt > Date.now() ? session : await this.getSession(role);
          await this.dependencies.request('/auth/logout', { method: 'POST' }, { token: usable.access });
        }));
        const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected'
          && (!(result.reason instanceof ApiError) || result.reason.status !== 401));
        if (failed) throw failed.reason;
      }
    } finally {
      const revision = ++this.revision;
      this.sessions.clear();
      try {
        await this.persist(revision, () => Promise.all([this.dependencies.storage.remove(this.activeKey()), ...workspaces.map((role) => this.dependencies.storage.remove(this.sessionKey(role)))]));
      } finally {
        if (revision === this.revision) this.publish({ user: null, workspace: 'user', restoring: false });
      }
    }
  }
}
