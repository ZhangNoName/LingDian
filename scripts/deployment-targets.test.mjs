import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { detectDeploymentTargets } from './deployment-targets.mjs';

test('maps application changes to the smallest deployment set', () => {
  assert.deepEqual(detectDeploymentTargets(['uniapp/src/pages/index.vue']), {
    app: true,
    merchant: false,
    admin: false,
    api: false,
  });
  assert.deepEqual(detectDeploymentTargets(['web/src/App.vue']), {
    app: false,
    merchant: true,
    admin: false,
    api: false,
  });
  assert.deepEqual(detectDeploymentTargets(['admin/src/App.vue']), {
    app: false,
    merchant: false,
    admin: true,
    api: false,
  });
  assert.deepEqual(detectDeploymentTargets(['backend/src/main.ts']), {
    app: false,
    merchant: false,
    admin: false,
    api: true,
  });
});

test('shared build inputs redeploy every service', () => {
  for (const file of [
    'pnpm-lock.yaml',
    'package.json',
    'common/src/index.ts',
    'deploy/nginx/lingdian-subdomains.conf',
  ]) {
    assert.deepEqual(detectDeploymentTargets([file]), {
      app: true,
      merchant: true,
      admin: true,
      api: true,
    });
  }
});

test('documentation-only changes do not redeploy services', () => {
  assert.deepEqual(detectDeploymentTargets(['docs/deployment.md', 'README.md']), {
    app: false,
    merchant: false,
    admin: false,
    api: false,
  });
});

test('API release joins the private application network', async () => {
  const releaseScript = await readFile(new URL('../deploy/scripts/release.sh', import.meta.url), 'utf8');
  const apiRuns = releaseScript.match(/docker run[^\n]+--env-file "\$ENV_FILE"[^\n]*/g) ?? [];

  assert.ok(apiRuns.length >= 4, 'expected migration, candidate, production, and rollback API runs');
  assert.ok(apiRuns.every((command) => command.includes('--network lingdian-network')));
});

test('frontend assets use compression and cache policies appropriate to hashed files', async () => {
  const nginx = await readFile(new URL('../deploy/frontend/nginx.conf', import.meta.url), 'utf8');

  assert.match(nginx, /gzip on;/);
  assert.match(nginx, /location \^~ \/assets\/[\s\S]+max-age=31536000, immutable/);
  assert.match(nginx, /location = \/index\.html[\s\S]+no-cache, no-store, must-revalidate/);
  assert.match(nginx, /location \^~ \/static\/[\s\S]+max-age=86400/);
});

test('public subdomains terminate TLS with HTTP/2 and redirect plaintext HTTP', async () => {
  const nginx = await readFile(new URL('../deploy/nginx/lingdian-subdomains.conf', import.meta.url), 'utf8');

  assert.equal((nginx.match(/http2 on;/g) ?? []).length, 4);
  assert.equal((nginx.match(/listen 443 ssl;/g) ?? []).length, 4);
  assert.equal((nginx.match(/listen \[::\]:443 ssl;/g) ?? []).length, 4);
  assert.match(nginx, /return 301 https:\/\/\$host\$request_uri;/);
  assert.equal((nginx.match(/ssl_certificate \/etc\/letsencrypt\/live\/app\.zsf\.shopping\/fullchain\.pem;/g) ?? []).length, 4);
  assert.match(nginx, /server_name api\.zsf\.shopping;[\s\S]+proxy_http_version 1\.1;/);
});

test('production release synchronizes the validated host Nginx config', async () => {
  const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const release = await readFile(new URL('../deploy/scripts/release.sh', import.meta.url), 'utf8');
  const installer = await readFile(new URL('../deploy/scripts/install-nginx-config.sh', import.meta.url), 'utf8');

  assert.match(workflow, /LINGDIAN_SYNC_NGINX=1 bash/);
  assert.match(workflow, /show '\$\{\{ github\.sha \}\}:deploy\/scripts\/release\.sh'/);
  assert.match(release, /bash deploy\/scripts\/install-nginx-config\.sh/);
  assert.match(installer, /nginx -t/);
  assert.match(installer, /restore_previous_config/);
  assert.match(installer, /systemctl reload nginx/);
});
