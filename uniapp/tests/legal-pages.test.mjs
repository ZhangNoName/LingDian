import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

test("pages.json registers both legal reader routes with fixed titles", async () => {
  const pagesJson = JSON.parse(await readProjectFile("src/pages.json"));
  const legalPages = pagesJson.pages.filter((page) => page.path.startsWith("pages/legal/"));

  assert.deepEqual(legalPages, [
    {
      path: "pages/legal/user-agreement",
      style: { navigationBarTitleText: "用户服务协议" },
    },
    {
      path: "pages/legal/privacy-policy",
      style: { navigationBarTitleText: "隐私政策" },
    },
  ]);
});

test("thin legal pages delegate rendering to LegalDocumentPage", async () => {
  const cases = [
    ["src/pages/legal/user-agreement.vue", "userAgreementDocument"],
    ["src/pages/legal/privacy-policy.vue", "privacyPolicyDocument"],
  ];

  for (const [pagePath, documentName] of cases) {
    const page = await readProjectFile(pagePath);

    assert.match(page, /import LegalDocumentPage from ["']@\/components\/legal\/LegalDocumentPage\.vue["']/);
    assert.match(page, new RegExp(`import \\{ ${documentName} \\} from ["']@/legal/legal-documents["']`));
    assert.match(page, new RegExp(`<LegalDocumentPage :document=["']${documentName}["']\\s*/>`));
    assert.doesNotMatch(page, /<scroll-view|<style/);
  }
});

test("the shared reader owns scrolling and uses WXSS-compatible class-only selectors", async () => {
  const reader = await readProjectFile("src/components/legal/LegalDocumentPage.vue");

  assert.match(reader, /<scroll-view[^>]*class="legal-scroll"[^>]*scroll-y/);
  assert.doesNotMatch(reader, /:deep\(|:not\(|\.[\w-]+\s+(text|view|scroll-view)/);
});

test("the profile page does not expose an unverified customer-service number", async () => {
  const profilePage = await readProjectFile("src/pages/user/user.vue");

  assert.doesNotMatch(profilePage, /400-888-0123/);
});
