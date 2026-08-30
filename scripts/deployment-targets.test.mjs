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
    'deploy/nginx/templates/lingdian-https.conf.template',
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

test('API operations join the private Compose network', async () => {
  const compose = await readFile(new URL('../deploy/compose.yml', import.meta.url), 'utf8');

  for (const service of ['api', 'migrate', 'bootstrap']) {
    assert.match(compose, new RegExp(`\\n  ${service}:[\\s\\S]*?\\n    networks: \\[lingdian\\]`));
  }
  assert.match(compose, /networks:\n  lingdian:\n    name: \$\{COMPOSE_NETWORK:-lingdian\}/);
});

test('API deployment gates use primary-store readiness', async () => {
  const compose = await readFile(new URL('../deploy/compose.yml', import.meta.url), 'utf8');
  const deployScript = await readFile(new URL('../deploy/scripts/deploy.sh', import.meta.url), 'utf8');
  const preflight = await readFile(new URL('../deploy/scripts/preflight.sh', import.meta.url), 'utf8');
  const dockerfile = await readFile(new URL('../Dockerfile.api', import.meta.url), 'utf8');

  assert.match(compose, /\/api\/health\/ready/);
  assert.match(deployScript, /wait_for_application/);
  assert.match(preflight, /PRIMARY_STORE_ID/);
  assert.match(preflight, /NODE_ENV=production, STORE_MODE=single, and API_PREFIX=api are required/);
  assert.match(dockerfile, /\/api\/health\/ready/);
});

test('frontend assets use compression and cache policies appropriate to hashed files', async () => {
  const nginx = await readFile(new URL('../deploy/frontend/nginx.conf', import.meta.url), 'utf8');

  assert.match(nginx, /gzip on;/);
  assert.match(nginx, /location \^~ \/assets\/[\s\S]+max-age=31536000, immutable/);
  assert.match(nginx, /location = \/index\.html[\s\S]+no-cache, no-store, must-revalidate/);
  assert.match(nginx, /location \^~ \/static\/[\s\S]+max-age=86400/);
});

test('public subdomains terminate TLS with HTTP/2 and redirect plaintext HTTP', async () => {
  const nginx = await readFile(new URL('../deploy/nginx/templates/lingdian-https.conf.template', import.meta.url), 'utf8');
  const proxy = await readFile(new URL('../deploy/nginx/lingdian-proxy.conf', import.meta.url), 'utf8');

  assert.equal((nginx.match(/listen 443 ssl http2;/g) ?? []).length, 4);
  assert.equal((nginx.match(/listen \[::\]:443 ssl http2;/g) ?? []).length, 4);
  assert.match(nginx, /return 301 https:\/\/\$host\$request_uri;/);
  assert.equal((nginx.match(/ssl_certificate \/etc\/letsencrypt\/live\/__CERT_NAME__\/fullchain\.pem;/g) ?? []).length, 4);
  assert.match(nginx, /server_name __API_DOMAIN__;[\s\S]+proxy_pass http:\/\/127\.0\.0\.1:__API_PORT__;/);
  assert.match(proxy, /proxy_http_version 1\.1;/);
  assert.match(nginx, /location ~\* \^\/api\/metrics\(\?:\/\|\$\) \{ return 404; \}/);
});

test('production release verifies an immutable bundle and installs validated Nginx config', async () => {
  const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const release = await readFile(new URL('../deploy/scripts/release.sh', import.meta.url), 'utf8');
  const deployAll = await readFile(new URL('../deploy/scripts/deploy-all.sh', import.meta.url), 'utf8');
  const installer = await readFile(new URL('../deploy/scripts/install-nginx.sh', import.meta.url), 'utf8');

  assert.match(workflow, /sha256sum --check --strict/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'/);
  assert.match(workflow, /format\('lingdian-pr-\{0\}', github\.event\.pull_request\.number\)/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.match(workflow, /printf 'STATE_DIR=%s\/state\\n' "\$ci_dir"/);
  assert.match(workflow, /git --git-dir="\$repository" bundle verify/);
  assert.match(workflow, /bash "\$runner_dir\/deploy\/scripts\/deploy-all\.sh"/);
  assert.match(release, /exec bash "\$SCRIPT_DIR\/deploy-all\.sh"/);
  assert.match(deployAll, /bash "\$SCRIPT_DIR\/deploy\.sh"/);
  assert.match(installer, /nginx -t/);
  assert.match(installer, /restore_nginx/);
  assert.match(installer, /systemctl reload nginx/);
});
