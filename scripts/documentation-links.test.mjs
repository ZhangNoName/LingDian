import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

test('current documentation has no broken local links', async () => {
  const files = [
    join(root, 'README.md'),
    join(root, 'backend/README.md'),
    join(root, 'admin/README.md'),
    join(root, 'web/README.md'),
    join(root, 'deploy/README.md'),
  ];
  await collectMarkdown(join(root, 'docs'), files);

  const broken = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const links = content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);
    for (const match of links) {
      const target = localTarget(match[1]);
      if (!target) continue;
      const resolved = resolve(dirname(file), target);
      try {
        await access(resolved);
      } catch {
        broken.push(`${relative(root, file)} -> ${match[1]}`);
      }
    }
  }

  assert.deepEqual(broken, [], `Fix broken documentation links:\n${broken.join('\n')}`);
});

async function collectMarkdown(directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectMarkdown(path, files);
    else if (entry.name.endsWith('.md')) files.push(path);
  }
}

function localTarget(rawTarget) {
  let target = rawTarget.trim().replace(/^<|>$/g, '');
  if (!target || /^(?:https?:|mailto:|#)/.test(target)) return null;
  target = target.split('#')[0].split('?')[0];
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}
