import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRenderer, nextTick, type App, type Component, type RendererOptions } from "vue";
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
    },
    load(id) {
      if (id === "\0virtual:uni-app-page-lifecycle") return "export function onLoad() {}";
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
let LoginPage: Component;
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

  const pageModule = await viteServer.ssrLoadModule("/src/pages/auth/login.vue");
  LoginPage = pageModule.default as Component;
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
  });
});

afterEach(() => {
  activeApp?.unmount();
  activeApp = undefined;
});

function mountLoginPage(): TestNode {
  const root = createTestNode("root");
  activeApp = testRenderer.createApp(LoginPage);
  activeApp.mount(root);
  return root;
}

function flatten(root: TestNode): TestNode[] {
  return [root, ...root.children.flatMap(flatten)];
}

function textContent(node: TestNode): string {
  return node.text + node.children.map(textContent).join("");
}

function findNode(root: TestNode, predicate: (node: TestNode) => boolean): TestNode {
  const node = flatten(root).find(predicate);
  if (!node) throw new Error("Expected rendered login-page node was not found.");
  return node;
}

function findButton(root: TestNode, text: string): TestNode {
  return findNode(root, (node) => node.type === "button" && textContent(node) === text);
}

async function setValidCredentials(root: TestNode): Promise<void> {
  const inputs = flatten(root).filter((node) => node.type === "input");
  (inputs[0].props["onUpdate:modelValue"] as (value: string) => void)("13800000000");
  (inputs[1].props["onUpdate:modelValue"] as (value: string) => void)("123456");
  await nextTick();
}

async function tap(node: TestNode): Promise<void> {
  await (node.props.onTap as (event?: unknown) => unknown)();
  await nextTick();
}

describe("actual login page legal-consent behavior", () => {
  it("does not render a native getPhoneNumber action while consent is unchecked", async () => {
    const root = mountLoginPage();
    await nextTick();

    const wechatButton = findButton(root, "微信手机号快捷登录");

    expect(wechatButton.props["open-type"]).toBeUndefined();
    expect(wechatButton.props.onGetphonenumber).toBeUndefined();
    expect(wechatButton.props.onTap).toBeTypeOf("function");
  });

  it.each([
    ["send code", "获取验证码"],
    ["submit phone login", "登录"],
    ["start third-party authorization", "QQ 登录"],
    ["tap the unchecked WeChat action", "微信手机号快捷登录"],
  ])("blocks %s before the real page reaches auth or network dependencies", async (_name, buttonText) => {
    const root = mountLoginPage();
    await nextTick();
    await setValidCredentials(root);

    await tap(findButton(root, buttonText));

    expect(networkRequests).toBe(0);
    expect(nativeLoginRequests).toBe(0);
    expect(toastMessages).toEqual(["请先阅读并同意《用户服务协议》和《隐私政策》"]);
  });

  it("renders the native getPhoneNumber action after explicit consent", async () => {
    const root = mountLoginPage();
    await nextTick();
    const checkboxGroup = findNode(root, (node) => node.type === "checkbox-group");

    (checkboxGroup.props.onChange as (event: { detail: { value: string[] } }) => void)({
      detail: { value: ["accepted"] },
    });
    await nextTick();

    const wechatButton = findButton(root, "微信手机号快捷登录");
    expect(wechatButton.props["open-type"]).toBe("getPhoneNumber");
    expect(wechatButton.props.onGetphonenumber).toBeTypeOf("function");
    expect(wechatButton.props.onTap).toBeUndefined();
  });
});
