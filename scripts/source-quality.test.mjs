import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const sourceRoots = [
  'backend/src',
  'admin/src',
  'web/src',
  'uniapp/src',
  'common/src',
  'packages/contracts/src',
  'packages/db/src',
  'packages/icons/src',
  'packages/observability/src',
];
const maxProductionLines = 600;

const workspaceEntries = new Map([
  ['@lingdian/common', 'common/src/index.ts'],
  ['@lingdian/contracts', 'packages/contracts/src/index.ts'],
  ['@lingdian/db', 'packages/db/src/index.ts'],
  ['@lingdian/icons', 'packages/icons/src/index.ts'],
  ['@lingdian/observability', 'packages/observability/src/index.ts'],
]);

async function collectSourceFiles() {
  const files = [];
  for (const sourceRoot of sourceRoots) await walk(join(root, sourceRoot), files);
  return files;
}

async function walk(directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, files);
    else if (['.ts', '.vue'].includes(extname(entry.name)) && !isTestSource(entry.name)) files.push(path);
  }
}

function isTestSource(name) {
  return /\.(?:spec|test)\.ts$/.test(name) || name.endsWith('.d.ts');
}

function display(path) {
  return relative(root, path).replaceAll('\\', '/');
}

test('production source files stay within the 600-line maintainability budget', async () => {
  const violations = [];
  for (const path of await collectSourceFiles()) {
    const content = await readFile(path, 'utf8');
    const lines = content === '' ? 0 : content.split(/\r?\n/).length;
    if (lines > maxProductionLines) violations.push(`${display(path)} (${lines} lines)`);
  }
  assert.deepEqual(violations, [], `Split oversized production files:\n${violations.join('\n')}`);
});

test('production source imports have no runtime cycles', async () => {
  const files = await collectSourceFiles();
  const fileSet = new Set(files.map((path) => normalize(path)));
  const graph = new Map([...fileSet].map((path) => [path, new Set()]));

  for (const path of fileSet) {
    const content = await readFile(path, 'utf8');
    for (const specifier of runtimeImportSpecifiers(content)) {
      const target = resolveImport(path, specifier, fileSet);
      if (target && target !== path) graph.get(path).add(target);
    }
  }

  const cycles = stronglyConnectedComponents(graph)
    .filter((component) => component.length > 1)
    .map((component) => component.map(display).sort().join(' -> '))
    .sort();
  assert.deepEqual(cycles, [], `Break runtime import cycles:\n${cycles.join('\n')}`);
});

function runtimeImportSpecifiers(content) {
  const specifiers = [];
  const pattern = /(?:^|\n)\s*(?:import\s+(?!type\b)(?:[^'";]+?\sfrom\s+)?|export\s+(?!type\b)[^'";]+?\sfrom\s+)['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(content))) specifiers.push(match[1]);
  return specifiers;
}

function resolveImport(importer, specifier, fileSet) {
  let base;
  if (specifier.startsWith('.')) {
    base = resolve(dirname(importer), specifier);
  } else if (specifier.startsWith('@/')) {
    const importerPath = display(importer);
    const application = importerPath.split('/')[0];
    if (!['admin', 'web', 'uniapp'].includes(application)) return null;
    base = join(root, application, 'src', specifier.slice(2));
  } else {
    const workspacePackage = [...workspaceEntries.keys()]
      .sort((left, right) => right.length - left.length)
      .find((name) => specifier === name || specifier.startsWith(`${name}/`));
    if (!workspacePackage) return null;
    const entry = workspaceEntries.get(workspacePackage);
    if (specifier === workspacePackage) return normalize(join(root, entry));
    base = join(root, dirname(entry), specifier.slice(workspacePackage.length + 1));
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.vue`,
    join(base, 'index.ts'),
    join(base, 'index.vue'),
  ].map(normalize);
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function stronglyConnectedComponents(graph) {
  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  const visit = (node) => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const dependency of graph.get(node)) {
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(dependency)));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component);
  };

  for (const node of graph.keys()) if (!indices.has(node)) visit(node);
  return components;
}
