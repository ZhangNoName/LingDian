import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRenderer, h, nextTick, type App, type Component, type RendererOptions } from "vue";
import { createServer, transformWithEsbuild, type Plugin, type ViteDevServer } from "vite";

interface TestNode {
  type: string;
  text: string;
  props: Record<string, unknown>;
  children: TestNode[];
  parent: TestNode | null;
  value: unknown;
  getRootNode: () => unknown;
  addEventListener: (name: string, listener: unknown) => void;
  removeEventListener: (name: string) => void;
}

class TestDocument {
  activeElement: TestNode | null = null;
}

class TestShadowRoot {}

const testDocument = new TestDocument();
Object.assign(globalThis, {
  Document: TestDocument,
  ShadowRoot: TestShadowRoot,
  document: testDocument,
});

const customElements = new Set([
  "scroll-view",
  "view",
  "text",
  "button",
  "input",
  "image",
  "checkbox-group",
  "label",
  "checkbox",
]);
const uniappRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(import.meta.url);
const pluginRequire = createRequire(require.resolve("@dcloudio/vite-plugin-uni"));
const sfcCompiler = pluginRequire("@vue/compiler-sfc");

function actualVuePagePlugin(): Plugin {
  return {
    name: "actual-vue-page-test",
    enforce: "pre",
    resolveId(id) {
      if (id === "virtual:uni-app-page-lifecycle") return "\0virtual:uni-app-page-lifecycle";
      if (id === "virtual:lingdian-miniapp-icons") return "\0virtual:lingdian-miniapp-icons";
    },
    load(id) {
      if (id === "\0virtual:uni-app-page-lifecycle") return "export function onLoad() {}";
      if (id === "\0virtual:lingdian-miniapp-icons") return 'export default { back: { text: "" }, profile: { primary: "" } }';
    },
    async transform(source, id) {
      if (!id.endsWith(".vue")) return;

      const parsed = sfcCompiler.parse(source, { filename: id });
      if (parsed.errors.length) throw parsed.errors[0];

      const descriptor = parsed.descriptor;
      const script = sfcCompiler.compileScript(descriptor, {
        id: "actual-login-page",
        genDefaultAs: "__sfc__",
      });
      const template = sfcCompiler.compileTemplate({
        id: "actual-login-page",
        filename: id,
        source: descriptor.template.content,
        compilerOptions: {
          bindingMetadata: script.bindings,
          isCustomElement: (tag: string) => customElements.has(tag),
        },
      });
      if (template.errors.length) throw template.errors[0];

      const executableModule = [
        script.content,
        template.code.replace("export function render", "function render"),
        "__sfc__.render = render;",
        "export default __sfc__;",
      ].join("\n");

      return transformWithEsbuild(executableModule, id, { loader: "ts", format: "esm" });
    },
  };
}

function createTestNode(type: string, text = ""): TestNode {
  const node: TestNode = {
    type,
    text,
    props: {},
    children: [],
    parent: null,
    value: "",
    getRootNode: () => testDocument,
    addEventListener(name, listener) {
      node.props[`native:${name}`] = listener;
    },
    removeEventListener(name) {
      delete node.props[`native:${name}`];
    },
  };
  return node;
}

const rendererOptions: RendererOptions<TestNode, TestNode> = {
  patchProp(element, key, _previous, value) {
    element.props[key] = value;
  },
  insert(child, parent, anchor) {
    child.parent = parent;
    const anchorIndex = anchor ? parent.children.indexOf(anchor) : -1;
    if (anchorIndex < 0) parent.children.push(child);
    else parent.children.splice(anchorIndex, 0, child);
  },
  remove(child) {
    if (!child.parent) return;
    const index = child.parent.children.indexOf(child);
    if (index >= 0) child.parent.children.splice(index, 1);
  },
  createElement: (type) => createTestNode(type),
  createText: (text) => createTestNode("#text", text),
  createComment: (text) => createTestNode("#comment", text),
  setText(node, text) {
    node.text = text;
  },
  setElementText(node, text) {
    node.text = text;
    node.children = [];
  },
  parentNode: (node) => node.parent,
  nextSibling(node) {
    if (!node.parent) return null;
    return node.parent.children[node.parent.children.indexOf(node) + 1] ?? null;
  },
  querySelector: () => null,
  setScopeId(node, id) {
    node.props[id] = "";
  },
  cloneNode(node) {
    return { ...node, props: { ...node.props }, children: [...node.children] };
  },
  insertStaticContent(content, parent, anchor) {
    const node = createTestNode("#static", content);
    rendererOptions.insert(node, parent, anchor);
    return [node, node];
  },
};

const testRenderer = createRenderer(rendererOptions);
let viteServer: ViteDevServer;
let Layout: Component;
let openCustomerLogin: typeof import("@/services/customer-login").openCustomerLogin;
let activeApp: App | undefined;
let networkRequests = 0;
let nativeLoginRequests = 0;
let toastMessages: string[] = [];

beforeAll(async () => {
  viteServer = await createServer({
    configFile: false,
    root: uniappRoot,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true },
    plugins: [actualVuePagePlugin()],
    resolve: {
      alias: [
        { find: "@dcloudio/uni-app", replacement: "virtual:uni-app-page-lifecycle" },
        { find: "@", replacement: path.resolve(uniappRoot, "src") },
      ],
    },
    ssr: { external: ["@lingdian/contracts"] },
  });

  const layoutModule = await viteServer.ssrLoadModule("/src/layout/layout.vue");
  Layout = layoutModule.default as Component;
  ({ openCustomerLogin } = await viteServer.ssrLoadModule("/src/services/customer-login.ts"));
});

afterAll(async () => {
  await viteServer.close();
});

beforeEach(() => {
  networkRequests = 0;
  nativeLoginRequests = 0;
  toastMessages = [];
  Object.assign(uni, {
    showToast(options: UniApp.ShowToastOptions) {
      toastMessages.push(options.title ?? "");
    },
    request(options: UniApp.RequestOptions) {
      networkRequests += 1;
      options.fail?.({ errMsg: "request:fail component-test" } as UniApp.GeneralCallbackResult);
      return { abort() {} } as UniApp.RequestTask;
    },
    login(options: UniApp.LoginOptions) {
      nativeLoginRequests += 1;
      options.fail?.({ errMsg: "login:fail component-test" } as UniApp.GeneralCallbackResult);
      return {} as UniApp.LoginRes;
    },
    navigateTo() {},
    reLaunch() {},
    hideKeyboard() {},
    hideToast() {},
    getSystemInfoSync: () => ({ uniPlatform: "mp-weixin" }),
  });
});

afterEach(() => {
  activeApp?.unmount();
  activeApp = undefined;
});

async function mountLoginDrawer() {
  const root = createTestNode("root");
  activeApp = testRenderer.createApp({
    render: () => h(Layout, { showTabBar: false }, () => h("text", "当前页面")),
  });
  activeApp.mount(root);
  const result = openCustomerLogin(getCurrentPages()[0]);
  await nextTick();
  return { root, result };
}

function flatten(root: TestNode): TestNode[] {
  return [root, ...root.children.flatMap(flatten)];
}

function textContent(node: TestNode): string {
  if (node.type === "#comment") return "";
  return node.text + node.children.map(textContent).join("");
}

function findNode(root: TestNode, predicate: (node: TestNode) => boolean): TestNode {
  const node = flatten(root).find(predicate);
  if (!node) throw new Error("Expected rendered login drawer node was not found.");
  return node;
}

function findButton(root: TestNode, text: string): TestNode {
  return findNode(root, (node) => node.type === "button" && textContent(node) === text);
}

async function acceptLegalConsent(root: TestNode): Promise<void> {
  const checkboxGroup = findNode(root, (node) => node.type === "checkbox-group");
  (checkboxGroup.props.onChange as (event: { detail: { value: string[] } }) => void)({
    detail: { value: ["accepted"] },
  });
  await nextTick();
}

async function tap(node: TestNode): Promise<void> {
  await (node.props.onTap as (event?: unknown) => unknown)({ stopPropagation() {} });
  await nextTick();
}

describe("login drawer behavior", () => {
  it("can be dismissed without leaving the underlying page", async () => {
    const { root, result } = await mountLoginDrawer();
    expect(textContent(root)).toContain("当前页面");
    await tap(findButton(root, "×"));
    await expect(result).resolves.toBe(false);
    expect(textContent(root)).toBe("当前页面");
  });

  it("only offers quick phone login and waits for consent before requesting the phone number", async () => {
    const { root } = await mountLoginDrawer();
    await nextTick();

    const phoneButton = findButton(root, "手机号快捷登录");

    expect(flatten(root).filter((node) => node.type === "button").map(textContent)).toEqual(["×", "手机号快捷登录"]);
    expect(textContent(root)).not.toContain("微信");
    expect(flatten(root).some((node) => node.type === "input")).toBe(false);
    expect(phoneButton.props["open-type"]).toBeUndefined();
    expect(phoneButton.props.onGetphonenumber).toBeUndefined();
    expect(phoneButton.props.onTap).toBeTypeOf("function");

    await tap(phoneButton);

    expect(networkRequests).toBe(0);
    expect(nativeLoginRequests).toBe(0);
    expect(toastMessages).toEqual(["请先阅读并同意《用户服务协议》和《隐私政策》"]);
  });

  it("renders the native getPhoneNumber action after explicit consent", async () => {
    const { root } = await mountLoginDrawer();
    await acceptLegalConsent(root);

    const phoneButton = findButton(root, "手机号快捷登录");
    expect(textContent(root)).not.toContain("微信");
    expect(phoneButton.props["open-type"]).toBe("getPhoneNumber");
    expect(phoneButton.props.onGetphonenumber).toBeTypeOf("function");
    expect(phoneButton.props.onTap).toBeUndefined();
  });

  it("keeps the drawer open when the customer declines phone authorization", async () => {
    const { root } = await mountLoginDrawer();
    await acceptLegalConsent(root);
    const phoneButton = findButton(root, "手机号快捷登录");
    await (phoneButton.props.onGetphonenumber as (event: unknown) => Promise<void>)({ detail: {} });

    expect(networkRequests).toBe(0);
    expect(nativeLoginRequests).toBe(0);
    expect(toastMessages).toEqual(["未获取手机号，可重新快速登录"]);
  });
});

it.each([true, false])("shows the profile step only for an account created on this login (%s)", async (isNewUser) => {
  Object.assign(uni, {
    login(options: UniApp.LoginOptions) {
      options.success?.({ code: "wx-login-code", errMsg: "login:ok" } as UniApp.LoginRes);
    },
  });
  uni.request = ((options: UniApp.RequestOptions) => {
    expect(options.url).toMatch(/\/auth\/wechat\/miniapp\/phone-login$/);
    expect(options.data).toMatchObject({ loginCode: "wx-login-code", phoneCode: "wx-phone-code" });
    options.success?.({
      statusCode: 200,
      header: {},
      cookies: [],
      errMsg: "request:ok",
      data: {
        code: 0,
        data: {
          access_token: "user-token",
          expires_in: 900,
          user: { userId: "user-1", sessionId: "session-1", audience: "user-api", roles: ["USER"] },
          ...(isNewUser ? { is_new_user: true } : {}),
        },
      },
    });
    return { abort() {} } as UniApp.RequestTask;
  }) as typeof uni.request;
  const { root, result } = await mountLoginDrawer();
  await acceptLegalConsent(root);
  const phoneButton = findButton(root, "手机号快捷登录");
  await (phoneButton.props.onGetphonenumber as (event: unknown) => Promise<void>)({
    detail: { code: "wx-phone-code" },
  });
  await nextTick();
  if (isNewUser) {
    expect(textContent(root)).toContain("设置头像和昵称");
    await tap(findButton(root, "暂时跳过"));
  } else {
    expect(textContent(root)).not.toContain("设置头像和昵称");
  }
  await expect(result).resolves.toBe(true);
  expect(textContent(root)).toBe("当前页面");
});
