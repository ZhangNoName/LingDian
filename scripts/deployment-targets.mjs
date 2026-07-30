const ALL = Object.freeze({ app: true, merchant: true, admin: true, api: true });
const NONE = Object.freeze({ app: false, merchant: false, admin: false, api: false });

export function detectDeploymentTargets(files) {
  const targets = { ...NONE };

  for (const rawFile of files) {
    const file = rawFile.replaceAll('\\', '/').replace(/^\.\//, '');
    if (isShared(file)) return { ...ALL };
    if (file.startsWith('uniapp/')) targets.app = true;
    if (file.startsWith('web/')) targets.merchant = true;
    if (file.startsWith('admin/')) targets.admin = true;
    if (file.startsWith('backend/') || file.startsWith('packages/db/')) targets.api = true;
    if (file === 'Dockerfile.frontend' || file.startsWith('deploy/frontend/')) {
      targets.app = true;
      targets.merchant = true;
      targets.admin = true;
    }
    if (file === 'Dockerfile.api') targets.api = true;
    if (file.startsWith('deploy/scripts/') || file.startsWith('.github/workflows/deploy')) return { ...ALL };
  }

  return targets;
}

function isShared(file) {
  return file === 'package.json'
    || file === 'pnpm-lock.yaml'
    || file === 'pnpm-workspace.yaml'
    || file.startsWith('common/')
    || file.startsWith('theme/')
    || file.startsWith('packages/contracts/')
    || file.startsWith('packages/icons/')
    || file.startsWith('packages/observability/');
}

