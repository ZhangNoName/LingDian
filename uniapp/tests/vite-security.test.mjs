import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  blockWindowsOpenInEditor,
  isOpenInEditorRequest,
} from "../vite-security.mjs";

const configUrl = new URL("../vite.config.ts", import.meta.url);

test("limits the development server to loopback", async () => {
  const source = await readFile(configUrl, "utf8");

  assert.match(source, /host:\s*["']127\.0\.0\.1["']/);
});

function installMiddleware(platform) {
  let middleware;
  const plugin = blockWindowsOpenInEditor(platform);
  plugin.configureServer({
    middlewares: {
      use(handler) {
        middleware = handler;
      },
    },
  });
  return middleware;
}

function runMiddleware(middleware, url) {
  let nextCalled = false;
  let body;
  const response = {
    statusCode: 200,
    end(value) {
      body = value;
    },
  };

  middleware({ url }, response, () => {
    nextCalled = true;
  });
  return { body, nextCalled, statusCode: response.statusCode };
}

test("matches every path shape handled by Vite's open-in-editor route", () => {
  for (const url of [
    "/__open-in-editor",
    "/__open-in-editor?file=src/App.vue",
    "/__open-in-editor/",
    "/__open-in-editor/nested?file=src/App.vue",
    "/__open-in-editor.anything",
  ]) {
    assert.equal(isOpenInEditorRequest(url), true, url);
  }

  for (const url of [
    "/",
    "/__open-in-editor-safe",
    "/prefix/__open-in-editor",
  ]) {
    assert.equal(isOpenInEditorRequest(url), false, url);
  }
});

test("returns 404 for all open-in-editor route variants on Windows", () => {
  const middleware = installMiddleware("win32");
  assert.equal(typeof middleware, "function");

  for (const url of [
    "/__open-in-editor",
    "/__open-in-editor/?file=src/App.vue",
    "/__open-in-editor.anything?file=src/App.vue",
  ]) {
    assert.deepEqual(runMiddleware(middleware, url), {
      body: "Not found",
      nextCalled: false,
      statusCode: 404,
    });
  }

  assert.deepEqual(runMiddleware(middleware, "/__open-in-editor-safe"), {
    body: undefined,
    nextCalled: true,
    statusCode: 200,
  });
});

test("does not install the blocker on non-Windows platforms", () => {
  assert.equal(installMiddleware("darwin"), undefined);
});

test("requires an explicit HTTPS API only for production mini-program builds", async () => {
  const { normalizeApiBase } = await import("../api-base.ts");
  assert.throws(() => normalizeApiBase(undefined, true, "mp-weixin"), /HTTPS/);
  assert.throws(() => normalizeApiBase("http://example.test/api", true, "mp-weixin"), /HTTPS/);
  assert.equal(normalizeApiBase("https://example.test/api/", true, "mp-weixin"), "https://example.test/api");
  assert.equal(normalizeApiBase(undefined, true, "h5"), "/api");
  assert.equal(normalizeApiBase(undefined, false, "mp-weixin"), "http://localhost:9000/api");
});
