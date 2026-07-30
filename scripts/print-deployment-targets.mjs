import { readFileSync } from 'node:fs';
import { detectDeploymentTargets } from './deployment-targets.mjs';

const targets = detectDeploymentTargets(readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean));
const selected = Object.entries(targets).filter(([, enabled]) => enabled).map(([name]) => name);
process.stdout.write(`value=${selected.join(',') || 'none'}\n`);

