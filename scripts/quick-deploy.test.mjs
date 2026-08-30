import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, readlink, realpath, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deploy = join(root, 'deploy');
const testTmpdir = await realpath(tmpdir());

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
    env: {
      ...process.env,
      LINGDIAN_ALLOW_TEST_LAYOUT: 'true',
      ...(options.env ?? {}),
    },
  });
}

async function writeExecutable(path, contents) {
  await writeFile(path, contents, { mode: 0o755 });
  await chmod(path, 0o755);
}

async function createMarkedRelease(releases, sha) {
  const release = join(releases, sha);
  await mkdir(join(release, 'deploy'), { recursive: true });
  await writeFile(join(release, '.lingdian-release-sha'), `${sha}\n`, { mode: 0o444 });
  await writeFile(join(release, 'deploy', 'compose.yml'), 'services: {}\n');
  return release;
}

async function createDeploymentFixture(t, prefix) {
  const fixture = await mkdtemp(join(testTmpdir, prefix));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const paths = Object.fromEntries(['state', 'data', 'backups', 'releases', 'bin']
    .map((name) => [name, join(fixture, name)]));
  await Promise.all(Object.values(paths).map((path) => mkdir(path, { recursive: true })));
  await mkdir(join(paths.data, 'uploads'), { recursive: true });

  let env = await readFile(join(deploy, 'production.env.example'), 'utf8');
  env = env
    .replace(/^DEPLOY_ROOT=.*$/m, `DEPLOY_ROOT=${fixture}`)
    .replace(/^DATA_DIR=.*$/m, `DATA_DIR=${paths.data}`)
    .replace(/^BACKUP_DIR=.*$/m, `BACKUP_DIR=${paths.backups}`)
    .replace(/^RELEASES_DIR=.*$/m, `RELEASES_DIR=${paths.releases}`)
    .replace(/^STATE_DIR=.*$/m, `STATE_DIR=${paths.state}`);
  const envFile = join(fixture, 'production.env');
  await writeFile(envFile, env, { mode: 0o600 });
  await chmod(envFile, 0o600);
  return { fixture, ...paths, envFile };
}

test('quick-deploy shell entrypoints pass bash syntax validation', async () => {
  const scripts = [
    'backup.sh', 'bootstrap-host.sh', 'cleanup.sh', 'deploy-all.sh', 'deploy.sh', 'init-env.sh',
    'install-nginx-config.sh', 'install-nginx.sh', 'issue-tls.sh', 'lib.sh', 'logs.sh',
    'preflight.sh', 'release.sh', 'restore.sh', 'rollback.sh', 'status.sh', 'upgrade.sh',
  ];
  for (const script of scripts) {
    const result = run('bash', ['-n', join(deploy, 'scripts', script)]);
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
    assert.equal((await stat(join(deploy, 'scripts', script))).mode & 0o111, 0o111,
      `${script} must be executable by the deployment user`);
  }
});

test('observability state directory rejects broad and symlinked destructive targets', async (t) => {
  const fixture = await mkdtemp(join(testTmpdir, 'lingdian-observability-path-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const bin = join(fixture, 'bin');
  await mkdir(bin);
  await writeExecutable(join(bin, 'docker'), [
    '#!/bin/sh',
    'case "${1:-}" in',
    '  info) exit 0 ;;',
    '  compose) exit 0 ;;',
    '  *) exit 0 ;;',
    'esac',
    '',
  ].join('\n'));
  const observabilityEnv = join(fixture, 'observability.env');
  await writeFile(observabilityEnv,
    await readFile(join(deploy, 'observability', '.env.example'), 'utf8'), { mode: 0o600 });
  const commandEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    OBSERVABILITY_ENV_FILE: observabilityEnv,
  };

  const broad = run('/bin/bash', [join(deploy, 'observability', 'observability.sh'), 'check'], {
    env: { ...commandEnv, OBSERVABILITY_STATE_DIR: '/' },
  });
  assert.notEqual(broad.status, 0);
  assert.match(broad.stderr, /OBSERVABILITY_STATE_DIR .*不安全/);

  const target = join(fixture, 'target');
  await mkdir(target);
  const link = join(fixture, 'linked-state');
  await symlink(target, link);
  const symlinked = run('/bin/bash', [join(deploy, 'observability', 'observability.sh'), 'check'], {
    env: { ...commandEnv, OBSERVABILITY_STATE_DIR: join(link, 'observability') },
  });
  assert.notEqual(symlinked.status, 0);
  assert.match(symlinked.stderr, /不得包含符号链接路径/);
});

test('deploy-all hands the observability phase to the exact target release', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-observability-handoff-');
  const revision = run('git', ['rev-parse', 'HEAD']).stdout.trim();
  assert.match(revision, /^[0-9a-f]{40}$/);
  const targetRelease = await createMarkedRelease(fixture.releases, revision);
  await mkdir(join(targetRelease, 'deploy', 'scripts'), { recursive: true });
  await writeExecutable(join(targetRelease, 'deploy', 'scripts', 'deploy-all.sh'), '#!/bin/sh\nexit 0\n');

  const invocationLog = join(fixture.fixture, 'bash-invocations.log');
  await writeExecutable(join(fixture.bin, 'bash'), [
    '#!/bin/sh',
    'set -eu',
    'printf "%s\\n" "$*" >> "$TEST_INVOCATION_LOG"',
    'case "$1" in',
    '  */deploy/scripts/deploy.sh)',
    '    printf "%s\\n" "$TEST_EXPECTED_SHA" > "$TEST_STATE_DIR/current"',
    '    exit 0',
    '    ;;',
    '  */releases/*/deploy/scripts/deploy-all.sh) exit 0 ;;',
    '  *) exec /bin/bash "$@" ;;',
    'esac',
    '',
  ].join('\n'));

  const result = run('/bin/bash', [join(deploy, 'scripts', 'deploy-all.sh'),
    '--env', fixture.envFile, '--sha', revision], {
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH}`,
      TEST_INVOCATION_LOG: invocationLog,
      TEST_EXPECTED_SHA: revision,
      TEST_STATE_DIR: fixture.state,
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const invocations = (await readFile(invocationLog, 'utf8')).trim().split('\n');
  assert.equal(invocations.length, 2);
  assert.match(invocations[0], new RegExp(`^${join(deploy, 'scripts', 'deploy.sh').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
  assert.match(invocations[1], new RegExp(`^${join(targetRelease, 'deploy', 'scripts', 'deploy-all.sh').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
  assert.match(invocations[1], new RegExp(`--observability-only --expected-sha ${revision}`));
});

test('observability continuation restores the previous stack and environment on upgrade failure', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-observability-rollback-');
  const previousSha = '6'.repeat(40);
  const targetSha = '7'.repeat(40);
  const previousRelease = await createMarkedRelease(fixture.releases, previousSha);
  const targetRelease = await createMarkedRelease(fixture.releases, targetSha);
  const operationLog = join(fixture.fixture, 'observability-operations.log');
  const dockerLog = join(fixture.fixture, 'docker-operations.log');

  for (const release of [previousRelease, targetRelease]) {
    await mkdir(join(release, 'deploy', 'scripts'), { recursive: true });
    await mkdir(join(release, 'deploy', 'observability'), { recursive: true });
  }
  await writeExecutable(join(targetRelease, 'deploy', 'scripts', 'deploy-all.sh'),
    await readFile(join(deploy, 'scripts', 'deploy-all.sh'), 'utf8'));
  await writeFile(join(targetRelease, 'deploy', 'scripts', 'lib.sh'),
    await readFile(join(deploy, 'scripts', 'lib.sh'), 'utf8'));
  await writeFile(join(targetRelease, 'deploy', 'observability', '.env.example'), 'GRAFANA_PORT=3001\n');
  await writeExecutable(join(targetRelease, 'deploy', 'observability', 'observability.sh'), [
    '#!/bin/sh',
    'printf "target:%s\\n" "$1" >> "$TEST_OBSERVABILITY_LOG"',
    '[ "$1" != install ] || exit 42',
    'exit 0',
    '',
  ].join('\n'));
  await writeExecutable(join(previousRelease, 'deploy', 'observability', 'observability.sh'), [
    '#!/bin/sh',
    'printf "previous:%s\\n" "$1" >> "$TEST_OBSERVABILITY_LOG"',
    'exit 0',
    '',
  ].join('\n'));
  await writeExecutable(join(fixture.bin, 'docker'), fakeTransactionalDockerScript());
  await writeExecutable(join(fixture.bin, 'flock'), '#!/bin/sh\nexit 0\n');

  await writeFile(join(fixture.state, 'current'), `${targetSha}\n`, { mode: 0o600 });
  await writeFile(join(fixture.state, 'previous'), `${previousSha}\n`, { mode: 0o600 });
  await writeFile(join(fixture.state, 'observability-current'), `${previousSha}\n`, { mode: 0o600 });
  await writeFile(join(fixture.state, 'observability-intent'), `${targetSha}\n`, { mode: 0o600 });
  const observabilityDir = join(fixture.fixture, 'observability');
  await mkdir(observabilityDir, { mode: 0o700 });
  const observabilityEnv = join(observabilityDir, 'observability.env');
  const originalEnv = 'GRAFANA_PORT=3999\nCUSTOM_SENTINEL=preserve-byte-for-byte\n';
  await writeFile(observabilityEnv, originalEnv, { mode: 0o600 });

  const result = run('/bin/bash', [join(targetRelease, 'deploy', 'scripts', 'deploy-all.sh'),
    '--observability-only', '--expected-sha', targetSha, '--env', fixture.envFile], {
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH}`,
      TEST_DOCKER_LOG: dockerLog,
      TEST_EXISTING_OBSERVABILITY: 'true',
      TEST_OBSERVABILITY_LOG: operationLog,
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Previous observability release .* was restored/);
  assert.equal(await readFile(observabilityEnv, 'utf8'), originalEnv);
  assert.equal((await readFile(join(fixture.state, 'observability-current'), 'utf8')).trim(), previousSha);
  assert.equal((await readFile(join(fixture.state, 'observability-pending'), 'utf8')).trim(), targetSha);
  assert.equal((await readFile(join(fixture.state, 'observability-intent'), 'utf8')).trim(), targetSha);
  assert.equal((await readFile(join(fixture.state, 'observability-env-existed'), 'utf8')).trim(), 'true');
  assert.equal(await readFile(join(fixture.state, 'observability-env.rollback'), 'utf8'), originalEnv);
  assert.deepEqual((await readFile(operationLog, 'utf8')).trim().split('\n'), ['target:install', 'previous:install']);
  const dockerOperations = await readFile(dockerLog, 'utf8');
  assert.doesNotMatch(dockerOperations, / compose .* stop api app merchant admin/);

  // Simulate an uncatchable process death after some env upserts. A retry must
  // reuse the first attempt's persistent rollback image, not snapshot this
  // partially mutated file as the new baseline.
  await writeFile(observabilityEnv, 'GRAFANA_PORT=3888\nPARTIAL_ATTEMPT=true\n', { mode: 0o600 });
  const retried = run('/bin/bash', [join(targetRelease, 'deploy', 'scripts', 'deploy-all.sh'),
    '--observability-only', '--expected-sha', targetSha, '--env', fixture.envFile], {
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH}`,
      TEST_DOCKER_LOG: dockerLog,
      TEST_EXISTING_OBSERVABILITY: 'true',
      TEST_OBSERVABILITY_LOG: operationLog,
    },
  });
  assert.notEqual(retried.status, 0);
  assert.equal(await readFile(observabilityEnv, 'utf8'), originalEnv);
  assert.equal(await readFile(join(fixture.state, 'observability-env.rollback'), 'utf8'), originalEnv);
  assert.deepEqual((await readFile(operationLog, 'utf8')).trim().split('\n'),
    ['target:install', 'previous:install', 'target:install', 'previous:install']);
});

test('first observability failure stops core and a successful retry reactivates it', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-observability-first-install-');
  const targetSha = '8'.repeat(40);
  const targetRelease = await createMarkedRelease(fixture.releases, targetSha);
  const operationLog = join(fixture.fixture, 'observability-operations.log');
  const dockerLog = join(fixture.fixture, 'docker-operations.log');
  await mkdir(join(targetRelease, 'deploy', 'scripts'), { recursive: true });
  await mkdir(join(targetRelease, 'deploy', 'observability'), { recursive: true });
  await writeExecutable(join(targetRelease, 'deploy', 'scripts', 'deploy-all.sh'),
    await readFile(join(deploy, 'scripts', 'deploy-all.sh'), 'utf8'));
  await writeFile(join(targetRelease, 'deploy', 'scripts', 'lib.sh'),
    await readFile(join(deploy, 'scripts', 'lib.sh'), 'utf8'));
  await writeFile(join(targetRelease, 'deploy', 'observability', '.env.example'), 'GRAFANA_PORT=3001\n');
  const targetObservability = join(targetRelease, 'deploy', 'observability', 'observability.sh');
  await writeExecutable(targetObservability, [
    '#!/bin/sh',
    'printf "target:%s\\n" "$1" >> "$TEST_OBSERVABILITY_LOG"',
    '[ "$1" != install ] || exit 42',
    'exit 0',
    '',
  ].join('\n'));
  await writeExecutable(join(fixture.bin, 'docker'), fakeTransactionalDockerScript());
  await writeExecutable(join(fixture.bin, 'flock'), '#!/bin/sh\nexit 0\n');
  await writeFile(join(fixture.state, 'current'), `${targetSha}\n`, { mode: 0o600 });
  await writeFile(join(fixture.state, 'observability-intent'), `${targetSha}\n`, { mode: 0o600 });

  const commandEnv = {
    ...process.env,
    PATH: `${fixture.bin}:${process.env.PATH}`,
    TEST_DOCKER_LOG: dockerLog,
    TEST_EXISTING_OBSERVABILITY: 'false',
    TEST_OBSERVABILITY_LOG: operationLog,
  };
  const failed = run('/bin/bash', [join(targetRelease, 'deploy', 'scripts', 'deploy-all.sh'),
    '--observability-only', '--expected-sha', targetSha, '--env', fixture.envFile], { env: commandEnv });
  assert.notEqual(failed.status, 0);
  assert.equal((await readFile(join(fixture.state, 'observability-core-stopped'), 'utf8')).trim(), targetSha);
  assert.match(await readFile(dockerLog, 'utf8'), /compose .* stop api app merchant admin/);
  await assert.rejects(stat(join(fixture.fixture, 'observability', 'observability.env')), { code: 'ENOENT' });
  const transactionScript = await readFile(join(deploy, 'scripts', 'deploy-all.sh'), 'utf8');
  assert.match(transactionScript,
    /state_write observability-core-stopped "\$current_sha"[\s\S]*if compose stop api app merchant admin/,
    'core-stop intent must survive a process death immediately after Docker stops the services');

  await writeExecutable(targetObservability, [
    '#!/bin/sh',
    'printf "target:%s\\n" "$1" >> "$TEST_OBSERVABILITY_LOG"',
    'exit 0',
    '',
  ].join('\n'));
  const recovered = run('/bin/bash', [join(targetRelease, 'deploy', 'scripts', 'deploy-all.sh'),
    '--observability-only', '--expected-sha', targetSha, '--env', fixture.envFile], { env: commandEnv });
  assert.equal(recovered.status, 0, `${recovered.stdout}\n${recovered.stderr}`);
  assert.equal((await readFile(join(fixture.state, 'observability-current'), 'utf8')).trim(), targetSha);
  await assert.rejects(stat(join(fixture.state, 'observability-core-stopped')), { code: 'ENOENT' });
  await assert.rejects(stat(join(fixture.state, 'observability-pending')), { code: 'ENOENT' });
  await assert.rejects(stat(join(fixture.state, 'observability-intent')), { code: 'ENOENT' });
  await assert.rejects(stat(join(fixture.state, 'observability-env-existed')), { code: 'ENOENT' });
  await assert.rejects(stat(join(fixture.state, 'observability-env.rollback')), { code: 'ENOENT' });
  const dockerOperations = await readFile(dockerLog, 'utf8');
  assert.match(dockerOperations, /compose .* up -d api app merchant admin/);
});

function fakeTransactionalDockerScript() {
  return [
    '#!/bin/sh',
    'set -eu',
    'printf "%s\\n" "$*" >> "$TEST_DOCKER_LOG"',
    'case "${1:-}" in',
    '  info) exit 0 ;;',
    '  compose)',
    '    case " $* " in',
    '      *" version --short "*) printf "%s\\n" 2.30.0 ;;',
    '      *" version "*) exit 0 ;;',
    '      *" ps -q "*) printf "%s\\n" fake-core-container ;;',
    '      *) exit 0 ;;',
    '    esac',
    '    ;;',
    '  ps)',
    '    [ "${TEST_EXISTING_OBSERVABILITY:-false}" != true ] || printf "%s\\n" fake-observability-container',
    '    ;;',
    '  inspect)',
    '    case "$*" in',
    '      *State.Status*) printf "%s\\n" running ;;',
    '      *State.Health*) printf "%s\\n" healthy ;;',
    '      *) exit 1 ;;',
    '    esac',
    '    ;;',
    '  *) exit 0 ;;',
    'esac',
    '',
  ].join('\n');
}

test('compose and Nginx keep secrets private and metrics off the public edge', async () => {
  const compose = await readFile(join(deploy, 'compose.yml'), 'utf8');
  assert.match(compose, /LINGDIAN_API_ENV_FILE/);
  assert.doesNotMatch(compose, /api:[\s\S]*?env_file:\s*\n\s*- \$\{LINGDIAN_ENV_FILE/);
  assert.match(compose, /127\.0\.0\.1:\$\{API_PORT:-9000\}:9000/);
  assert.match(compose, /max-size: \$\{DOCKER_LOG_MAX_SIZE:-20m\}/);
  assert.match(compose, /DEBIAN_SECURITY_MIRROR/);
  assert.equal((compose.match(/format: raw/g) || []).length, 3);

  for (const dockerfileName of ['Dockerfile.api', 'Dockerfile.frontend']) {
    const dockerfile = await readFile(join(root, dockerfileName), 'utf8');
    assert.match(dockerfile.split('\n', 1)[0],
      /^# syntax=docker\/dockerfile:1\.7@sha256:[0-9a-f]{64}$/);
  }

  for (const name of ['lingdian-http.conf.template', 'lingdian-https.conf.template']) {
    const nginx = await readFile(join(deploy, 'nginx', 'templates', name), 'utf8');
    assert.match(nginx, /location ~\* \^\/api\/metrics\(\?:\/\|\$\) \{ return 404; \}/);
    assert.doesNotMatch(nginx, /location = \/api\/metrics/);
    assert.match(nginx, /error_log [^;]+ warn;/);
    assert.doesNotMatch(nginx, /error_log [^;]+ crit;/);
  }
});

test('runtime env generation uses an API allowlist and one-time bootstrap file', async (t) => {
  const fixture = await mkdtemp(join(testTmpdir, 'lingdian-deploy-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const state = join(fixture, 'state');
  const data = join(fixture, 'data');
  const backups = join(fixture, 'backups');
  const releases = join(fixture, 'releases');
  await Promise.all([state, data, backups, releases].map((path) => mkdir(path, { recursive: true })));
  await mkdir(join(data, 'uploads'), { recursive: true });

  let env = await readFile(join(deploy, 'production.env.example'), 'utf8');
  env = env
    .replace(/^DEPLOY_ROOT=.*$/m, `DEPLOY_ROOT=${fixture}`)
    .replace(/^DATA_DIR=.*$/m, `DATA_DIR=${data}`)
    .replace(/^BACKUP_DIR=.*$/m, `BACKUP_DIR=${backups}`)
    .replace(/^RELEASES_DIR=.*$/m, `RELEASES_DIR=${releases}`)
    .replace(/^STATE_DIR=.*$/m, `STATE_DIR=${state}`)
    .replace(/^AUTH_JWT_ACCESS_SECRET=.*$/m, 'AUTH_JWT_ACCESS_SECRET=Exact$UNSET_tail!123456789');
  const envFile = join(fixture, 'production.env');
  await writeFile(envFile, env, { mode: 0o600 });
  await chmod(envFile, 0o600);

  const result = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
    'ensure_runtime_dirs',
    'prepare_runtime_envs',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: envFile },
  });
  assert.equal(result.status, 0, result.stderr);

  const apiRuntime = await readFile(join(state, 'api-runtime.env'), 'utf8');
  const bootstrapRuntime = await readFile(join(state, 'bootstrap-runtime.env'), 'utf8');
  assert.match(apiRuntime, /^DATABASE_MODE=local$/m);
  assert.match(apiRuntime, /^DATABASE_URL=/m);
  assert.match(apiRuntime, /^TRUST_PROXY_HOPS=1$/m);
  assert.match(apiRuntime, /^AUTH_JWT_ACCESS_SECRET=Exact\$UNSET_tail!123456789$/m);
  assert.doesNotMatch(apiRuntime, /^(?:MYSQL_|DEPLOY_ROOT|BACKUP_DIR|AUTH_BOOTSTRAP_|STORE_BOOTSTRAP_)/m);
  assert.match(bootstrapRuntime, /^AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=/m);
  assert.match(bootstrapRuntime, /^STORE_BOOTSTRAP_CODE=/m);
  assert.equal((await stat(join(state, 'api-runtime.env'))).mode & 0o777, 0o600);

  const invalidProjectEnv = join(fixture, 'invalid-project.env');
  await writeFile(invalidProjectEnv, env.replace(/^COMPOSE_PROJECT_NAME=.*$/m,
    'COMPOSE_PROJECT_NAME=unmonitored-project'), { mode: 0o600 });
  const invalidProject = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: invalidProjectEnv },
  });
  assert.notEqual(invalidProject.status, 0);
  assert.match(invalidProject.stderr, /must be lingdian or start with lingdian-/);
});

test('bootstrap credential scrubbing is atomic, privileged, and retry-safe', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-scrub-test-');
  const original = await readFile(fixture.envFile, 'utf8');
  await writeFile(fixture.envFile, original.replace(/^AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=.*$/m,
    'export AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=StillSecret!123'), { mode: 0o600 });
  await writeExecutable(join(fixture.bin, 'sudo'), [
    '#!/bin/sh',
    'set -eu',
    '[ "${1:-}" != -n ] || shift',
    'exec "$@"',
    '',
  ].join('\n'));

  const result = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
    'ensure_runtime_dirs',
    'scrub_bootstrap_credentials',
    'scrub_bootstrap_credentials',
  ].join('; ')], {
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH}`,
      TEST_ROOT: root,
      TEST_ENV: fixture.envFile,
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const scrubbed = await readFile(fixture.envFile, 'utf8');
  assert.match(scrubbed, /^export AUTH_BOOTSTRAP_SUPER_ADMIN_PASSWORD=$/m);
  assert.match(scrubbed, /^AUTH_BOOTSTRAP_MERCHANT_PASSWORD=$/m);
  assert.match(scrubbed, /^AUTH_JWT_ACCESS_SECRET=.+$/m);
  assert.equal((await stat(fixture.envFile)).mode & 0o777, 0o600);

  const lib = await readFile(join(deploy, 'scripts', 'lib.sh'), 'utf8');
  assert.match(lib, /export PATH="\/usr\/local\/sbin:/);
  assert.match(lib, /sudo_command mktemp/);
  assert.match(lib, /sudo_command install -o/);
  assert.match(lib, /sudo_command mv -f/);
  const deployScript = await readFile(join(deploy, 'scripts', 'deploy.sh'), 'utf8');
  assert.match(deployScript, /\nfi\n\n# Keep this outside[\s\S]*\nscrub_bootstrap_credentials\nprepare_runtime_envs\n/);
});

test('authoritative release state repairs a missing current pointer and rejects a real directory', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-current-pointer-test-');
  const sha = 'c'.repeat(40);
  const release = await createMarkedRelease(fixture.releases, sha);
  await writeFile(join(fixture.state, 'current'), `${sha}\n`, { mode: 0o600 });
  const command = [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
    'ensure_runtime_dirs',
    'reconcile_current_release_pointer',
    'printf "%s\\n" "$RELEASE_POINTER_REPAIRED"',
  ].join('; ');
  const commandEnv = { ...process.env, TEST_ROOT: root, TEST_ENV: fixture.envFile };
  const repaired = run('bash', ['-c', command], { env: commandEnv });
  assert.equal(repaired.status, 0, `${repaired.stdout}\n${repaired.stderr}`);
  assert.match(repaired.stdout, /true/);
  assert.equal(await readlink(join(fixture.fixture, 'current')), release);

  await rm(join(fixture.fixture, 'current'));
  await mkdir(join(fixture.fixture, 'current'));
  const unsafe = run('bash', ['-c', command], { env: commandEnv });
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /must be absent or a symbolic link/);
});

test('application rollback compatibility requires exact readable Prisma migration trees', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-migration-compatibility-test-');
  const left = join(fixture.releases, 'left');
  const right = join(fixture.releases, 'right');
  const leftMigrations = join(left, 'packages', 'db', 'prisma', 'migrations');
  const rightMigrations = join(right, 'packages', 'db', 'prisma', 'migrations');
  await Promise.all([leftMigrations, rightMigrations].map((path) => mkdir(path, { recursive: true })));
  await Promise.all([
    join(leftMigrations, '20260710_baseline'),
    join(rightMigrations, '20260710_baseline'),
  ].map((path) => mkdir(path)));
  await Promise.all([
    join(leftMigrations, '20260710_baseline', 'migration.sql'),
    join(rightMigrations, '20260710_baseline', 'migration.sql'),
  ].map((path) => writeFile(path, 'CREATE TABLE baseline (id INT PRIMARY KEY);\n')));
  await Promise.all([
    join(leftMigrations, 'migration_lock.toml'),
    join(rightMigrations, 'migration_lock.toml'),
  ].map((path) => writeFile(path, 'provider = "mysql"\n')));

  const command = [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'prisma_migration_sets_match "$TEST_LEFT_RELEASE" "$TEST_RIGHT_RELEASE"',
  ].join('\n');
  const commandEnv = {
    ...process.env,
    TEST_ROOT: root,
    TEST_LEFT_RELEASE: left,
    TEST_RIGHT_RELEASE: right,
  };

  const matching = run('bash', ['-c', command], { env: commandEnv });
  assert.equal(matching.status, 0, `${matching.stdout}\n${matching.stderr}`);

  await writeFile(
    join(rightMigrations, '20260710_baseline', 'migration.sql'),
    'CREATE TABLE baseline (id BIGINT PRIMARY KEY);\n',
  );
  const changedContents = run('bash', ['-c', command], { env: commandEnv });
  assert.notEqual(changedContents.status, 0,
    'same-named migrations with different SQL must not allow application-only rollback');
  await writeFile(
    join(rightMigrations, '20260710_baseline', 'migration.sql'),
    'CREATE TABLE baseline (id INT PRIMARY KEY);\n',
  );

  await symlink(
    join(rightMigrations, '20260710_baseline', 'migration.sql'),
    join(rightMigrations, '20260710_baseline', 'linked.sql'),
  );
  const symlinked = run('bash', ['-c', command], { env: commandEnv });
  assert.notEqual(symlinked.status, 0, 'a symlink anywhere in the migration tree must fail closed');
  await rm(join(rightMigrations, '20260710_baseline', 'linked.sql'));

  await mkdir(join(rightMigrations, '20260830_new_invariant'));
  await writeFile(join(rightMigrations, '20260830_new_invariant', 'migration.sql'), 'SELECT 1;\n');
  const different = run('bash', ['-c', command], { env: commandEnv });
  assert.notEqual(different.status, 0, 'a release with an additional migration must not roll back application-only');

  await rm(rightMigrations, { recursive: true });
  const missing = run('bash', ['-c', command], { env: commandEnv });
  assert.notEqual(missing.status, 0, 'a missing migration directory must fail closed');
});

test('an incompatible rollback target is rejected without stopping the current release', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-rollback-refusal-test-');
  const currentSha = '1'.repeat(40);
  const targetSha = '2'.repeat(40);
  const currentRelease = await createMarkedRelease(fixture.releases, currentSha);
  await createMarkedRelease(fixture.releases, targetSha);
  const currentMigrations = join(currentRelease, 'packages', 'db', 'prisma', 'migrations');
  await mkdir(join(currentMigrations, '20260710_baseline'), { recursive: true });
  await writeFile(
    join(currentMigrations, '20260710_baseline', 'migration.sql'),
    'CREATE TABLE baseline (id INT PRIMARY KEY);\n',
  );
  await writeFile(join(fixture.state, 'current'), `${currentSha}\n`);
  await writeFile(join(fixture.state, 'previous'), `${targetSha}\n`);
  await symlink(currentRelease, join(fixture.fixture, 'current'));

  const dockerLog = join(fixture.fixture, 'docker.log');
  await writeExecutable(join(fixture.bin, 'docker'), [
    '#!/bin/sh',
    'printf "%s\\n" "$*" >> "$TEST_DOCKER_LOG"',
    'if [ "${1:-}" = info ]; then exit 0; fi',
    'if [ "${1:-}" = compose ] && [ "${2:-}" = version ]; then echo "2.30.0"; exit 0; fi',
    'exit 0',
    '',
  ].join('\n'));
  await writeExecutable(join(fixture.bin, 'flock'), '#!/bin/sh\nexit 0\n');

  const result = run('/bin/bash', [join(deploy, 'scripts', 'rollback.sh'),
    '--env', fixture.envFile, '--sha', targetSha, '--skip-backup'], {
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH}`,
      TEST_DOCKER_LOG: dockerLog,
    },
  });
  assert.notEqual(result.status, 0, 'an incompatible application-only rollback must be refused');
  assert.match(result.stderr, /current release and its services remain unchanged/);
  assert.doesNotMatch(await readFile(dockerLog, 'utf8'), /compose .* stop/,
    'rejecting a target before activation must not stop the healthy current release');
  assert.equal((await readFile(join(fixture.state, 'current'), 'utf8')).trim(), currentSha);
});

test('production template and compose resolve the release root correctly', async (t) => {
  const template = await readFile(join(deploy, 'production.env.example'), 'utf8');
  assert.match(template, /TRUST_PROXY_HOPS=1/);
  assert.match(template, /DEPLOY_PUBLIC_IPV4=CHANGE_ME_PUBLIC_IPV4/);
  assert.match(template, /allowPublicKeyRetrieval=true/);
  assert.match(template, /OBSERVABILITY_ENABLED=true/);
  assert.match(template, /^GRAFANA_PORT=3001$/m);
  assert.match(template, /^PROMETHEUS_PORT=9090$/m);
  assert.match(template, /^ALERTMANAGER_PORT=9093$/m);
  assert.match(template, /^ALERT_WEBHOOK_URL=$/m);
  assert.match(template, /^MYSQL_IMAGE=mysql:8\.4@sha256:[0-9a-f]{64}$/m);
  assert.match(template, /^BACKUP_ARCHIVE_IMAGE=busybox:1\.37@sha256:[0-9a-f]{64}$/m);
  assert.match(template, /^EXTERNAL_MYSQL_SSL_MODE=VERIFY_IDENTITY$/m);
  assert.match(template, /^EXTERNAL_MYSQL_SSL_CA=\//m);
  const preflight = await readFile(join(deploy, 'scripts', 'preflight.sh'), 'utf8');
  assert.match(preflight, /must use an immutable name:tag@sha256/);
  assert.match(preflight, /must not use the latest tag/);
  assert.match(preflight, /has an AAAA record, but this deployment profile is IPv4-only/);
  assert.match(preflight, /AAAA DNS lookup failed/);
  assert.match(preflight, /TLS_ENABLED=true is required by the production deployment profile/);
  assert.match(preflight, /TLS_STAGING=false is required by the production deployment profile/);
  assert.match(preflight, /A records must resolve exclusively to DEPLOY_PUBLIC_IPV4/);
  assert.match(preflight, /ALERT_WEBHOOK_URL must be empty or an absolute HTTPS URL/);
  assert.match(preflight, /sslaccept=strict and sslcert=external-mysql-ca\.pem/);
  assert.match(preflight, /Observability is enabled but the target release is missing/);
  assert.match(preflight, /DockerRootDir/);
  assert.match(preflight,
    /state_read observability-core-stopped[\s\S]*retry that exact release before upgrading/);
  const deployAll = await readFile(join(deploy, 'scripts', 'deploy-all.sh'), 'utf8');
  assert.match(deployAll, /upsert_observability_key ALERT_WEBHOOK_URL/);
  const hostBootstrap = await readFile(join(deploy, 'scripts', 'bootstrap-host.sh'), 'utf8');
  assert.match(hostBootstrap, /if \[\[ ! -e "\$DATA_DIR\/mysql" \]\]/);
  assert.match(hostBootstrap, /Preserving existing MySQL data-directory ownership and mode/);
  assert.match(hostBootstrap, /compose_version_is_supported/);
  assert.match(hostBootstrap, /Docker Compose 2\.30\.0\+ is required after host bootstrap/);
  assert.match(hostBootstrap, /python3-certbot-nginx rsync sudo tar util-linux/);
  assert.match(hostBootstrap, /visudo -cf "\$sudoers_tmp"/);
  assert.match(hostBootstrap, /init-env\.sh" --owner "\$DEPLOY_USER"/);
  assert.match(hostBootstrap, /ufw --force enable/);
  assert.match(hostBootstrap, /docker\.service\.d\/lingdian-storage\.conf/);
  assert.ok(hostBootstrap.indexOf('docker.service.d/lingdian-storage.conf') <
    hostBootstrap.indexOf('systemctl restart docker'),
  'Docker storage dependency must be installed before Docker is restarted');
  assert.ok(hostBootstrap.indexOf('load_deploy_config') <
    hostBootstrap.indexOf('systemctl restart docker'),
  'the protected deployment root must be resolved before Docker is restarted');
  assert.ok(hostBootstrap.indexOf('systemctl restart docker') <
    hostBootstrap.indexOf('install -d -m 0750 -o "$DEPLOY_USER"'),
  'Docker must activate required mounts before deployment data directories are created');
  const backupUnit = await readFile(join(deploy, 'systemd', 'lingdian-backup.service.template'), 'utf8');
  assert.match(backupUnit,
    /RequiresMountsFor=__DEPLOY_ROOT__ __DATA_DIR__ __BACKUP_DIR__ __RELEASES_DIR__ __STATE_DIR__ __ENV_FILE__/);
  const dockerStorageUnit = await readFile(
    join(deploy, 'systemd', 'docker-lingdian-storage.conf.template'), 'utf8');
  assert.match(dockerStorageUnit,
    /RequiresMountsFor=__DEPLOY_ROOT__ __DATA_DIR__ __BACKUP_DIR__ __RELEASES_DIR__ __STATE_DIR__/);
  assert.ok(hostBootstrap.indexOf('validate_absolute_path ENV_FILE "$ENV_FILE"') <
    hostBootstrap.indexOf('apt-get update'));
  assert.ok(hostBootstrap.indexOf('validate_absolute_path ENV_FILE "$ENV_FILE"') <
    hostBootstrap.indexOf('chown "$DEPLOY_USER:$deploy_group" "$ENV_FILE"'));
  assert.ok(hostBootstrap.indexOf('validate_environment_location "$ENV_FILE"') <
    hostBootstrap.indexOf('apt-get update'));
  const initEnv = await readFile(join(deploy, 'scripts', 'init-env.sh'), 'utf8');
  assert.match(initEnv, /install -d -o root -g "\$target_group" -m 0750 "\$target_dir"/);
  assert.match(initEnv, /install -o "\$target_user" -g "\$target_group" -m 0600/);
  assert.match(initEnv, /runuser -u "\$target_user" -- test -r "\$TARGET"/);
  assert.match(initEnv, /--owner\) TARGET_USER=/);
  const deploymentReadme = await readFile(join(deploy, 'README.md'), 'utf8');
  assert.match(deploymentReadme, /四个域名不得残留 AAAA 记录/);
  assert.match(deploymentReadme, /不得混入旧服务器 A 记录/);
  const issueTls = await readFile(join(deploy, 'scripts', 'issue-tls.sh'), 'utf8');
  assert.match(issueTls, /renewal_server[\s\S]*staging[\s\S]*force_renewal=true/);
  assert.match(issueTls, /--server https:\/\/acme-v02\.api\.letsencrypt\.org\/directory/);
  assert.match(issueTls, /certbot_args\+=\(--force-renewal\)/);

  const backupScript = await readFile(join(deploy, 'scripts', 'backup.sh'), 'utf8');
  assert.match(backupScript, /snapshotHasDeployedRelease/);
  assert.match(backupScript, /toolingReleaseSha/);
  assert.match(backupScript, /--ssl-mode="\$1" --ssl-ca=\/run\/secrets\/mysql-ca\.pem/);
  assert.equal((backupScript.match(/--no-tablespaces/g) || []).length, 2);
  assert.match(backupScript, /lingdian_backup_last_attempt_success/);
  assert.match(backupScript, /lingdian_backup_last_success_timestamp_seconds/);
  const cleanupScript = await readFile(join(deploy, 'scripts', 'cleanup.sh'), 'utf8');
  assert.doesNotMatch(cleanupScript, /docker\s+(?:system|image)\s+prune/);
  assert.match(cleanupScript, /releaseSha/);
  const coreDeployScript = await readFile(join(deploy, 'scripts', 'deploy.sh'), 'utf8');
  assert.match(coreDeployScript,
    /exec 7>"\$STATE_DIR\/backup\.lock"[\s\S]*flock -n 7[\s\S]*Applying database migrations/);
  assert.match(coreDeployScript,
    /flock -n 7[\s\S]*compose stop api[\s\S]*run --rm --no-deps migrate/);
  assert.match(coreDeployScript,
    /Database migration failed after the API was stopped[\s\S]*compose stop api app merchant admin[\s\S]*core remains stopped/);
  const migrationFailureBlock = coreDeployScript.slice(
    coreDeployScript.indexOf('if ! compose --profile operations run --rm --no-deps migrate; then'),
    coreDeployScript.indexOf('if [[ ! -r "$STATE_DIR/bootstrap-complete" ]]'),
  );
  assert.doesNotMatch(migrationFailureBlock, /compose (?:up|start)/,
    'an uncertain migration failure must never restart the old API');
  assert.ok(coreDeployScript.indexOf('if [[ "$old_sha" == "$RELEASE_SHA" ]]') <
    coreDeployScript.indexOf("compose build --pull"),
  'same-revision retries must not overwrite rollback image tags');
  assert.match(coreDeployScript, /already current; skipping same-revision rebuild and activation/);
  assert.match(coreDeployScript, /state_read core-config-fingerprint/);
  assert.match(coreDeployScript, /state_write core-config-fingerprint/);
  assert.match(coreDeployScript,
    /state_read observability-core-stopped[\s\S]*state_read observability-pending[\s\S]*allowing the target-release continuation/);
  assert.ok(coreDeployScript.indexOf('run_pre_deploy_backup') <
    coreDeployScript.indexOf("compose pull db"),
  'upgrades must snapshot the running database before pulling a changed local DB image');
  assert.match(coreDeployScript,
    /if ! compose up -d api app merchant admin; then[\s\S]*activation_failed=true/);
  assert.match(coreDeployScript,
    /prisma_migration_sets_match "\$PREPARED_RELEASE" "\$RELEASES_DIR\/\$old_sha"[\s\S]*rollback_schema_compatible=true/);
  assert.match(coreDeployScript,
    /Prisma migration histories differ or are unavailable[\s\S]*compose stop api app merchant admin/);
  assert.match(coreDeployScript,
    /no schema-compatible automatic rollback was available[\s\S]*compose stop api app merchant admin/);
  assert.doesNotMatch(coreDeployScript, /install-nginx\.sh" --env "\$ENV_FILE" --mode http/);
  assert.match(coreDeployScript, /atomic_update_current_release_pointer "\$PREPARED_RELEASE"/);
  assert.match(coreDeployScript, /reconcile_current_release_pointer/);
  const productionCompose = await readFile(join(deploy, 'compose.yml'), 'utf8');
  assert.match(productionCompose, /command: \[node, packages\/db\/scripts\/migrate-deploy-safe\.mjs\]/);
  assert.match(productionCompose, /command: \[node, backend\/scripts\/bootstrap-production\.mjs\]/);
  assert.doesNotMatch(productionCompose, /command: \[corepack, pnpm/);
  const rollbackScript = await readFile(join(deploy, 'scripts', 'rollback.sh'), 'utf8');
  assert.match(rollbackScript,
    /require_observability_transaction_clear rollback[\s\S]*--reason pre-rollback/);
  assert.match(rollbackScript,
    /exec 7>"\$STATE_DIR\/backup\.lock"[\s\S]*flock -n 7[\s\S]*use_release "\$target_release"/);
  assert.match(rollbackScript,
    /prisma_migration_sets_match "\$current_release" "\$target_release"[\s\S]*Rollback refused before activation; the current release and its services remain unchanged/);
  const rollbackCompatibilityBlock = rollbackScript.slice(
    rollbackScript.indexOf('if ! prisma_migration_sets_match "$current_release" "$target_release"; then'),
    rollbackScript.indexOf('use_release "$target_release" "$TARGET_SHA"'),
  );
  assert.doesNotMatch(rollbackCompatibilityBlock, /compose (?:stop|down|rm)/,
    'pre-activation compatibility refusal must not mutate the running release');
  assert.match(rollbackScript,
    /if ! compose up -d api app merchant admin; then[\s\S]*use_release "\$current_release"/);
  assert.doesNotMatch(rollbackScript, /observability\.sh" upgrade/);
  const restoreEntrypoint = await readFile(join(deploy, 'scripts', 'restore.sh'), 'utf8');
  assert.match(restoreEntrypoint,
    /require_observability_transaction_clear restore[\s\S]*--reason pre-restore/);
  assert.match(restoreEntrypoint,
    /if ! compose up -d api app merchant admin; then[\s\S]*manual intervention/);
  const deploymentLib = await readFile(join(deploy, 'scripts', 'lib.sh'), 'utf8');
  assert.match(deploymentLib, /mv -Tf -- "\$temp_link" "\$pointer"/);
  assert.match(deploymentLib, /Release pointer must be absent or a symbolic link/);
  assert.match(deploymentLib,
    /prisma_migration_manifest\(\)[\s\S]*sha256sum[\s\S]*prisma_migration_sets_match\(\)[\s\S]*left_manifest=\$\(prisma_migration_manifest[\s\S]*right_manifest=\$\(prisma_migration_manifest/);
  const nginxInstaller = await readFile(join(deploy, 'scripts', 'install-nginx.sh'), 'utf8');
  assert.match(nginxInstaller, /proxy_backup=.*mktemp/);
  assert.match(nginxInstaller, /tls_backup=.*mktemp/);
  assert.match(nginxInstaller,
    /restore_managed_file "\$proxy_target" "\$proxy_backup" "\$had_proxy"/);
  assert.match(nginxInstaller,
    /restore_managed_file "\$tls_target" "\$tls_backup" "\$had_tls"/);
  const tlsIssuer = await readFile(join(deploy, 'scripts', 'issue-tls.sh'), 'utf8');
  assert.match(tlsIssuer, /trap finish_tls_transition EXIT/);
  assert.match(tlsIssuer, /restore_pre_tls_nginx/);
  assert.match(tlsIssuer, /tls_transition_committed=true/);
  const httpNginxTemplate = await readFile(
    join(deploy, 'nginx', 'templates', 'lingdian-http.conf.template'), 'utf8');
  assert.doesNotMatch(httpNginxTemplate, /proxy_pass/);
  assert.equal((httpNginxTemplate.match(/location \/ \{ return 503; \}/g) || []).length, 4);
  const statusScript = await readFile(join(deploy, 'scripts', 'status.sh'), 'utf8');
  assert.match(statusScript, /state_read observability-current/);
  assert.match(statusScript, /observability disabled by configuration/);
  const observabilityEntrypoint = await readFile(
    join(deploy, 'observability', 'observability.sh'), 'utf8');
  assert.match(observabilityEntrypoint, /docker info --format '\{\{\.DockerRootDir\}\}'/);
  assert.match(observabilityEntrypoint,
    /http:\/\/loki:3100\/ready[\s\S]*http:\/\/alloy:12345\/-\/ready/);

  const unsafeFixture = await mkdtemp(join(testTmpdir, 'lingdian-unsafe-root-test-'));
  t.after(() => rm(unsafeFixture, { recursive: true, force: true }));
  const unsafeRootEnv = join(unsafeFixture, 'unsafe-root.env');
  await writeFile(unsafeRootEnv, template.replace(/^DEPLOY_ROOT=.*$/m, 'DEPLOY_ROOT=/etc'),
    { mode: 0o600 });
  const unsafeRoot = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: unsafeRootEnv },
  });
  assert.notEqual(unsafeRoot.status, 0);
  assert.match(unsafeRoot.stderr, /DEPLOY_ROOT is too broad and unsafe/);

  const dockerRootEnv = join(unsafeFixture, 'docker-root.env');
  await writeFile(dockerRootEnv, template
    .replace(/^DEPLOY_ROOT=.*$/m, 'DEPLOY_ROOT=/private/var/lib/docker')
    .replace(/^DATA_DIR=.*$/m, 'DATA_DIR=/private/var/lib/docker/data')
    .replace(/^BACKUP_DIR=.*$/m, 'BACKUP_DIR=/private/var/lib/docker/backups')
    .replace(/^RELEASES_DIR=.*$/m, 'RELEASES_DIR=/private/var/lib/docker/releases')
    .replace(/^STATE_DIR=.*$/m, 'STATE_DIR=/private/var/lib/docker/state'), { mode: 0o600 });
  const dockerRoot = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: dockerRootEnv },
  });
  assert.notEqual(dockerRoot.status, 0);
  assert.match(dockerRoot.stderr, /final directory must be named lingdian/);

  const symlinkRoot = join(unsafeFixture, 'lingdian-symlink-root');
  await mkdir(symlinkRoot);
  await symlink('/', join(symlinkRoot, 'escape'));
  const symlinkPathEnv = join(unsafeFixture, 'symlink-path.env');
  await writeFile(symlinkPathEnv, template
    .replace(/^DEPLOY_ROOT=.*$/m, `DEPLOY_ROOT=${symlinkRoot}`)
    .replace(/^DATA_DIR=.*$/m, `DATA_DIR=${join(symlinkRoot, 'escape', 'etc')}`)
    .replace(/^BACKUP_DIR=.*$/m, `BACKUP_DIR=${join(symlinkRoot, 'backups')}`)
    .replace(/^RELEASES_DIR=.*$/m, `RELEASES_DIR=${join(symlinkRoot, 'releases')}`)
    .replace(/^STATE_DIR=.*$/m, `STATE_DIR=${join(symlinkRoot, 'state')}`), { mode: 0o600 });
  const symlinkPath = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: symlinkPathEnv },
  });
  assert.notEqual(symlinkPath.status, 0);
  assert.match(symlinkPath.stderr, /must not contain symbolic-link path components/);

  const derivedFixture = await createDeploymentFixture(t, 'lingdian-derived-symlink-test-');
  await rm(join(derivedFixture.data, 'uploads'), { recursive: true });
  await symlink('/', join(derivedFixture.data, 'uploads'));
  const derivedSymlink = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: derivedFixture.envFile },
  });
  assert.notEqual(derivedSymlink.status, 0);
  assert.match(derivedSymlink.stderr, /UPLOADS_DIRECTORY must not contain symbolic-link path components/);

  const envLink = join(unsafeFixture, 'env-link');
  await symlink('/etc', envLink);
  const symlinkEnvFile = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: join(envLink, 'passwd') },
  });
  assert.notEqual(symlinkEnvFile.status, 0);
  assert.match(symlinkEnvFile.stderr, /ENV_FILE must not contain symbolic-link path components/);

  const invalidBooleanEnv = join(unsafeFixture, 'invalid-boolean.env');
  await writeFile(invalidBooleanEnv, template.replace(/^TLS_ENABLED=.*$/m, 'TLS_ENABLED=ture'),
    { mode: 0o600 });
  const invalidBoolean = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: invalidBooleanEnv },
  });
  assert.notEqual(invalidBoolean.status, 0);
  assert.match(invalidBoolean.stderr, /TLS_ENABLED must be exactly true or false/);

  const duplicatePortEnv = join(unsafeFixture, 'duplicate-port.env');
  await writeFile(duplicatePortEnv, template.replace(/^APP_PORT=.*$/m, 'APP_PORT=9000'),
    { mode: 0o600 });
  const duplicatePort = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'ENV_FILE="$TEST_ENV"',
    'load_deploy_config',
  ].join('; ')], {
    env: { ...process.env, TEST_ROOT: root, TEST_ENV: duplicatePortEnv },
  });
  assert.notEqual(duplicatePort.status, 0);
  assert.match(duplicatePort.stderr, /APP_PORT=9000 duplicates another LingDian host port/);

  const unsafeEnvLocation = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'LINGDIAN_ALLOW_TEST_LAYOUT=false',
    'validate_environment_location /home/deploy/lingdian/production.env',
  ].join('; ')], { env: { ...process.env, TEST_ROOT: root } });
  assert.notEqual(unsafeEnvLocation.status, 0);
  assert.match(unsafeEnvLocation.stderr, /must be stored under \/etc\/lingdian/);

  const ephemeralRoot = run('bash', ['-c', [
    'set -Eeuo pipefail',
    'source "$TEST_ROOT/deploy/scripts/lib.sh"',
    'DEPLOY_ROOT="$TEST_FIXTURE"',
    'DATA_DIR="$TEST_FIXTURE/data"',
    'BACKUP_DIR="$TEST_FIXTURE/backups"',
    'RELEASES_DIR="$TEST_FIXTURE/releases"',
    'STATE_DIR="$TEST_FIXTURE/state"',
    'validate_deployment_layout',
  ].join('; ')], {
    env: {
      ...process.env,
      LINGDIAN_ALLOW_TEST_LAYOUT: 'false',
      TEST_ROOT: root,
      TEST_FIXTURE: unsafeFixture,
    },
  });
  assert.notEqual(ephemeralRoot.status, 0);
  assert.match(ephemeralRoot.stderr, /must not use an ephemeral\/private-tmp path/);

  const docker = run('docker', ['compose', 'version']);
  if (docker.status !== 0) {
    t.skip('Docker Compose v2 is unavailable');
    return;
  }
  const fixture = await mkdtemp(join(testTmpdir, 'lingdian-compose-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const envFile = join(fixture, 'production.env');
  await writeFile(envFile, template, { mode: 0o600 });
  const runtimeFile = join(fixture, 'api-runtime.env');
  const dollarSecret = 'Exact$UNSET_tail!123456789';
  await writeFile(runtimeFile, template.replace(/^AUTH_JWT_ACCESS_SECRET=.*$/m,
    `AUTH_JWT_ACCESS_SECRET=${dollarSecret}`), { mode: 0o600 });
  const sha = '1'.repeat(40);
  const result = run('docker', [
    'compose', '--env-file', envFile,
    '--project-directory', deploy,
    '-f', join(deploy, 'compose.yml'),
    '--profile', '*', 'config', '--format', 'json',
  ], {
    env: {
      ...process.env,
      RELEASE_SHA: sha,
      DATA_DIR: join(fixture, 'data'),
      LINGDIAN_ENV_FILE: envFile,
      LINGDIAN_API_ENV_FILE: runtimeFile,
      LINGDIAN_BOOTSTRAP_ENV_FILE: runtimeFile,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(resolve(config.services.api.build.context), root);
  // Compose's rendered model escapes a literal dollar as `$$`; the raw env
  // file itself and the resulting container value remain a single `$`.
  assert.equal(config.services.api.environment.AUTH_JWT_ACCESS_SECRET.replaceAll('$$', '$'), dollarSecret);

  const workflow = await readFile(join(root, '.github', 'workflows', 'deploy.yml'), 'utf8');
  const actionUses = [...workflow.matchAll(/uses:\s+([^\s#]+)/g)].map((match) => match[1]);
  assert.ok(actionUses.length > 0);
  for (const action of actionUses) {
    assert.match(action, /@[0-9a-f]{40}$/, `workflow action must be commit-pinned: ${action}`);
  }
  assert.match(workflow, /image: mysql:8\.4@sha256:[0-9a-f]{64}/);
});

test('backup metadata follows the deployed snapshot and restore is verify-first', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-backup-test-');
  const deployedSha = 'a'.repeat(40);
  const toolingSha = 'b'.repeat(40);
  const deployedRelease = await createMarkedRelease(fixture.releases, deployedSha);
  await mkdir(join(deployedRelease, 'deploy', 'scripts'), { recursive: true });
  for (const script of ['backup.sh', 'lib.sh']) {
    await writeExecutable(join(deployedRelease, 'deploy', 'scripts', script),
      await readFile(join(deploy, 'scripts', script), 'utf8'));
  }
  const toolingRelease = await createMarkedRelease(fixture.releases, toolingSha);
  await writeFile(join(fixture.state, 'current'), `${deployedSha}\n`, { mode: 0o600 });
  await symlink(deployedRelease, join(fixture.fixture, 'current'));
  await writeFile(join(fixture.data, 'uploads', 'receipt.txt'), 'synthetic upload\n');

  await writeExecutable(join(fixture.bin, 'flock'), [
    '#!/bin/sh',
    'exit 0',
    '',
  ].join('\n'));
  await writeExecutable(join(fixture.bin, 'docker'), [
    '#!/bin/sh',
    'set -eu',
    'case "${1:-}" in',
    '  info) exit 0 ;;',
    '  compose)',
    '    case " $* " in',
    '      *" version --short "*) printf "%s\\n" 2.30.0 ;;',
    '      *" version "*) exit 0 ;;',
    '      *" ps -q "*) printf "%s\\n" fake-container ;;',
    '      *mysqldump*) printf "%s\\n" "CREATE TABLE backup_probe (id INT);" ;;',
    '      *" exec -T db "*) cat >/dev/null; exit 0 ;;',
    '      *) exit 0 ;;',
    '    esac',
    '    ;;',
    '  inspect)',
    '    case "$*" in',
    '      *State.Status*) printf "%s\\n" running ;;',
    '      *State.Health*) printf "%s\\n" healthy ;;',
    '      *) exit 1 ;;',
    '    esac',
    '    ;;',
    '  image) [ "${2:-}" = inspect ] && exit 0 ;;',
    '  run)',
    '    backup_src=',
    '    is_archive=false',
    '    for arg in "$@"; do',
    '      case "$arg" in',
    '        type=bind,src=*,dst=/source,readonly) is_archive=true ;;',
    '        type=bind,src=*,dst=/backup)',
    '          backup_src=${arg#type=bind,src=}',
    '          backup_src=${backup_src%,dst=/backup}',
    '          ;;',
    '      esac',
    '    done',
    '    if [ "$is_archive" = true ]; then',
    '      [ -n "$backup_src" ] || exit 2',
    '      tar -czf "$backup_src/uploads.tar.gz" -T /dev/null',
    '    fi',
    '    ;;',
    '  *) exit 0 ;;',
    'esac',
    '',
  ].join('\n'));

  const commandEnv = { ...process.env, PATH: `${fixture.bin}:${process.env.PATH}` };
  const backup = run('bash', [join(deploy, 'scripts', 'backup.sh'),
    '--env', fixture.envFile,
    '--release-dir', toolingRelease,
    '--sha', toolingSha,
    '--reason', 'pre-deploy'], { env: commandEnv });
  assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`);

  const backupPath = (await readFile(join(fixture.state, 'last-backup'), 'utf8')).trim();
  const metadata = JSON.parse(await readFile(join(backupPath, 'metadata.json'), 'utf8'));
  assert.equal(metadata.releaseSha, deployedSha);
  assert.equal(metadata.toolingReleaseSha, toolingSha);
  assert.equal(metadata.snapshotHasDeployedRelease, true);

  const verify = run('bash', [join(deploy, 'scripts', 'restore.sh'),
    '--env', fixture.envFile, '--backup', backupPath], { env: commandEnv });
  assert.equal(verify.status, 0, `${verify.stdout}\n${verify.stderr}`);
  assert.match(verify.stdout, /Verification only; no production data was changed/);

  const missingConfirmation = run('bash', [join(deploy, 'scripts', 'restore.sh'),
    '--env', fixture.envFile, '--backup', backupPath, '--apply-local'], { env: commandEnv });
  assert.notEqual(missingConfirmation.status, 0);
  assert.match(missingConfirmation.stderr, /Destructive restore requires --confirm/);

  const originalEnv = await readFile(fixture.envFile, 'utf8');
  await writeFile(fixture.envFile, originalEnv.replace(/^BACKUP_RETENTION_DAYS=.*$/m,
    'BACKUP_RETENTION_DAYS=0'), { mode: 0o600 });
  const expiredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000);
  await utimes(backupPath, expiredAt, expiredAt);
  const applied = run('bash', [join(deploy, 'scripts', 'restore.sh'),
    '--env', fixture.envFile,
    '--backup', backupPath,
    '--apply-local',
    '--confirm', 'RESTORE_LOCAL_DATABASE_AND_UPLOADS'], { env: commandEnv });
  assert.equal(applied.status, 0, `${applied.stdout}\n${applied.stderr}`);
  await stat(backupPath);
  assert.match(applied.stdout, /Backup retention skipped for this safety snapshot/);

  const backupScript = await readFile(join(deploy, 'scripts', 'backup.sh'), 'utf8');
  const restoreScript = await readFile(join(deploy, 'scripts', 'restore.sh'), 'utf8');
  assert.match(backupScript, /--skip-retention/);
  assert.match(restoreScript, /--reason pre-restore \\\n\s+--skip-retention/);
  assert.match(restoreScript, /flock -n 8[\s\S]*sha256sum -c SHA256SUMS[\s\S]*compose stop api/);

  const databaseDump = join(backupPath, 'database.sql.gz');
  await writeFile(databaseDump, Buffer.concat([await readFile(databaseDump), Buffer.from('tamper')]));
  const tampered = run('bash', [join(deploy, 'scripts', 'restore.sh'),
    '--env', fixture.envFile, '--backup', backupPath], { env: commandEnv });
  assert.notEqual(tampered.status, 0, 'checksum tampering must be rejected');
});

test('cleanup is dry-run by default and retains core, observability, backup, and newest releases', async (t) => {
  const fixture = await createDeploymentFixture(t, 'lingdian-cleanup-test-');
  const currentSha = '1'.repeat(40);
  const previousSha = '2'.repeat(40);
  const backupSha = '3'.repeat(40);
  const newestSha = '4'.repeat(40);
  const removableSha = '5'.repeat(40);
  const observabilitySha = '6'.repeat(40);
  const intentSha = '7'.repeat(40);
  const shas = [currentSha, previousSha, backupSha, newestSha, removableSha, observabilitySha, intentSha];
  const mtimes = new Map([
    [removableSha, 1], [currentSha, 2], [previousSha, 3], [backupSha, 4],
    [observabilitySha, 5], [intentSha, 6], [newestSha, 7],
  ]);
  const releases = new Map();
  for (const sha of shas) {
    const release = await createMarkedRelease(fixture.releases, sha);
    const timestamp = new Date(mtimes.get(sha) * 1_000);
    await utimes(release, timestamp, timestamp);
    releases.set(sha, release);
  }
  await writeFile(join(fixture.state, 'current'), `${currentSha}\n`, { mode: 0o600 });
  await writeFile(join(fixture.state, 'previous'), `${previousSha}\n`, { mode: 0o600 });
  await writeFile(join(fixture.state, 'observability-current'), `${observabilitySha}\n`, { mode: 0o600 });
  await writeFile(join(fixture.state, 'observability-intent'), `${intentSha}\n`, { mode: 0o600 });
  const backupRecord = join(fixture.backups, 'retained-backup');
  await mkdir(backupRecord);
  await writeFile(join(backupRecord, 'metadata.json'), JSON.stringify({
    releaseSha: backupSha,
    toolingReleaseSha: backupSha,
  }));
  const originalEnv = await readFile(fixture.envFile, 'utf8');
  await writeFile(fixture.envFile, originalEnv.replace(/^RELEASE_RETENTION_COUNT=.*$/m,
    'RELEASE_RETENTION_COUNT=1'), { mode: 0o600 });

  await writeExecutable(join(fixture.bin, 'docker'), [
    '#!/bin/sh',
    'case "${1:-}" in',
    '  info) exit 0 ;;',
    '  compose)',
    '    [ "${2:-}" = version ] || exit 0',
    '    [ "${3:-}" != --short ] || printf "%s\\n" 2.30.0',
    '    exit 0',
    '    ;;',
    '  ps) exit 0 ;;',
    '  image) exit 1 ;;',
    '  *) exit 0 ;;',
    'esac',
    '',
  ].join('\n'));
  const commandEnv = { ...process.env, PATH: `${fixture.bin}:${process.env.PATH}` };

  const unconfirmed = run('bash', [join(deploy, 'scripts', 'cleanup.sh'),
    '--env', fixture.envFile, '--apply'], { env: commandEnv });
  assert.notEqual(unconfirmed.status, 0);
  await stat(releases.get(removableSha));

  const dryRun = run('bash', [join(deploy, 'scripts', 'cleanup.sh'),
    '--env', fixture.envFile], { env: commandEnv });
  assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`);
  assert.match(dryRun.stdout, new RegExp(`would remove release/images: ${removableSha}`));
  await stat(releases.get(removableSha));

  const apply = run('bash', [join(deploy, 'scripts', 'cleanup.sh'),
    '--env', fixture.envFile,
    '--apply', '--confirm', 'PRUNE_OLD_LINGDIAN_RELEASES'], { env: commandEnv });
  assert.equal(apply.status, 0, `${apply.stdout}\n${apply.stderr}`);
  await assert.rejects(stat(releases.get(removableSha)), { code: 'ENOENT' });
  for (const sha of [currentSha, previousSha, backupSha, newestSha, observabilitySha, intentSha]) {
    await stat(releases.get(sha));
  }
});
