import assert from 'node:assert/strict';
import test from 'node:test';

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
  for (const file of ['pnpm-lock.yaml', 'package.json', 'common/src/index.ts']) {
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
