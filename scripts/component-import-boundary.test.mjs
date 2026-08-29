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

test('merchant pages import Element Plus through the local UI boundary', async () => {
  const sourceRoot = join(projectRoot, 'web', 'src');
  const boundary = join(sourceRoot, 'components', 'ui', 'element-plus.ts');
  const violations = [];

  for (const file of await sourceFiles(sourceRoot)) {
    if (file === boundary || file.includes(`${join('src', 'styles')}/`)) continue;
    const source = await readFile(file, 'utf8');
    if (/from\s+['"]element-plus['"]/.test(source)) {
      violations.push(relative(projectRoot, file));
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
