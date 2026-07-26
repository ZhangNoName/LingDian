import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('publishes browser-facing named exports as ESM', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const output = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');

  assert.equal(packageJson.type, 'module');
  assert.match(output, /export function createClientLogReporter/);
  assert.match(output, /export function installBrowserErrorReporter/);
  assert.doesNotMatch(output, /\bexports\./);
});
