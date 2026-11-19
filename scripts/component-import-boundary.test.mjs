import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';

const projectRoot = new URL('..', import.meta.url).pathname;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|vue)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

test('both consoles use the shared shadcn-vue component source', async () => {
  const violations = [];
  const config = JSON.parse(await readFile(join(projectRoot, 'packages', 'console-ui', 'components.json'), 'utf8'));
  assert.equal(config.style, 'new-york-v4');

  for (const workspace of ['admin', 'web', 'packages/console-ui']) {
    const root = join(projectRoot, workspace);
    const isApp = workspace === 'admin' || workspace === 'web';
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    if (isApp) assert.equal(manifest.dependencies['@lingdian/console-ui'], 'workspace:*');
    assert.equal(manifest.dependencies?.['element-plus'] ?? manifest.devDependencies?.['element-plus'], undefined);

    for (const file of await sourceFiles(join(root, 'src'))) {
      const source = await readFile(file, 'utf8');
      const legacyControl = /['"]element-plus(?:\/|['"])|<\/?(?:el-[\w-]+|NativeSelect|select)(?=[\s/>])/.test(source);
      const directPrimitive = isApp && /['"]reka-ui(?:\/|['"])/.test(source);
      if (legacyControl || directPrimitive) violations.push(relative(projectRoot, file));
    }
  }

  assert.deepEqual(violations, []);
});

test('merchant screens render common controls through shared components', async () => {
  const sourceRoot = join(projectRoot, 'web', 'src');
  const violations = [];

  for (const area of ['components', 'layouts', 'views']) {
    for (const file of await sourceFiles(join(sourceRoot, area))) {
      if (!file.endsWith('.vue')) continue;
      const source = await readFile(file, 'utf8');
      const directControl = source.match(/<(button|input|select|textarea|table|dialog)(?=[\s/>])/);
      if (directControl) violations.push(`${relative(projectRoot, file)} uses <${directControl[1]}>`);
    }
  }

  assert.deepEqual(violations, []);
});

test('applications source icons from the shared icon package', async () => {
  const violations = [];
  for (const application of ['admin', 'web', 'uniapp']) {
    const sourceRoot = join(projectRoot, application, 'src');
    for (const file of await sourceFiles(sourceRoot)) {
      const source = await readFile(file, 'utf8');
      if (/from\s+['"](?:@element-plus\/icons-vue|lucide-vue-next)['"]/.test(source)) {
        violations.push(relative(projectRoot, file));
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('both management applications consume the shared console color tokens', async () => {
  const adminMain = await readFile(join(projectRoot, 'admin', 'src', 'main.ts'), 'utf8');
  const webMain = await readFile(join(projectRoot, 'web', 'src', 'main.ts'), 'utf8');
  assert.match(adminMain, /@theme\/colors\.css/);
  assert.match(webMain, /@theme\/colors\.css/);
});
