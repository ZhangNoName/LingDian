import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('observability images are pinned and Docker access is isolated behind a read-only proxy', async () => {
  const compose = await read('deploy/observability/compose.yml');
  assert.match(compose, /x-service-defaults:[\s\S]*cap_drop:\s*\[ALL\]/);
  const imageRefs = [...compose.matchAll(/^\s*image:\s*(\S+)/gm)].map((match) => match[1]);
  assert.equal(imageRefs.length, 9);
  for (const imageRef of imageRefs) {
    assert.match(imageRef, /:[A-Za-z0-9_.-]+@sha256:[0-9a-f]{64}$/);
  }
  assert.match(compose, /docker-socket-proxy:[\s\S]*POST:\s*"0"/);
  assert.match(compose, /docker-socket-proxy:[\s\S]*networks:\s*\n\s*- docker_socket/);
  assert.match(compose, /docker_socket:\s*\n\s*internal:\s*true/);
  assert.match(compose, /entrypoint: \[\/usr\/local\/sbin\/haproxy\]/);
  assert.match(compose, /docker-socket-proxy\/haproxy\.cfg:\/usr\/local\/etc\/haproxy\/lingdian\.cfg:ro/);
  assert.doesNotMatch(compose, /OBSERVABILITY_STATE_DIR[^\n]*haproxy\.cfg/);
  const proxyConfig = await read('deploy/observability/docker-socket-proxy/haproxy.cfg');
  assert.match(proxyConfig, /bind :2375/);
  assert.match(proxyConfig, /http-request deny unless METH_GET/);

  const alertmanagerService = compose.match(/\n  alertmanager:\n([\s\S]*?)\n  loki:/)?.[1] ?? '';
  assert.match(alertmanagerService, /\n\s*- observability_egress/);

  const grafanaService = compose.match(/\n  grafana:\n([\s\S]*?)\n  node-exporter:/)?.[1] ?? '';
  assert.match(grafanaService, /\n\s*- observability_egress/);

  const alloyService = compose.match(/\n  alloy:\n([\s\S]*?)\n  grafana:/)?.[1] ?? '';
  assert.doesNotMatch(alloyService, /docker\.sock/);
  assert.doesNotMatch(alloyService, /\n\s*- lingdian/);
  assert.match(alloyService, /\/var\/log\/lingdian\/nginx:\/var\/log\/nginx:ro/);
  assert.match(alloyService, /user:\s*"473:473"/);
  assert.match(alloyService, /NGINX_LOG_GROUP_GID:-4/);
  assert.match(alloyService, /--disable-reporting/);
});

test('observability persistence, retention, and loopback-only management ports stay configured', async () => {
  const compose = await read('deploy/observability/compose.yml');
  const script = await read('deploy/observability/observability.sh');
  assert.match(compose, /OBSERVABILITY_STATE_DIR/);
  assert.match(compose, /127\.0\.0\.1:\$\{GRAFANA_PORT:-3001\}:3000/);
  assert.match(compose, /storage\.tsdb\.retention\.size=\$\{PROMETHEUS_RETENTION_SIZE:-20GB\}/);
  assert.match(compose, /LOKI_RETENTION:-336h/);
  assert.match(compose, /max-size:\s*"20m"/);
  assert.match(compose, /max-file:\s*"5"/);
  assert.match(compose, /--collector\.textfile\.directory=\/textfile/);
  assert.match(compose, /node-exporter-textfile:\/textfile:ro/);
  assert.match(script, /CORE_COMPOSE_PROJECT_NAME 只支持 lingdian/);
  assert.match(script, /validate_port_layout/);
  assert.match(script, /与另一个 LingDian 宿主端口重复/);
  assert.match(script, /mkdir -p "\$GENERATED_DIR\/node-exporter-textfile"/);
});

test('Grafana overview dashboard and both provisioned data sources are valid artifacts', async () => {
  const dashboard = JSON.parse(await read('deploy/observability/grafana/dashboards/lingdian-overview.json'));
  const datasources = await read('deploy/observability/grafana/provisioning/datasources/datasources.yml');
  const prometheusRules = await read('deploy/observability/prometheus/rules/lingdian.yml');

  assert.equal(dashboard.uid, 'lingdian-overview');
  assert.ok(dashboard.panels.some((panel) => panel.type === 'logs'));
  assert.ok(dashboard.panels.some((panel) => panel.title.includes('API 响应延迟')));
  assert.match(datasources, /uid:\s*prometheus/);
  assert.match(datasources, /uid:\s*loki/);
  assert.match(prometheusRules, /LingDianExporterDown[\s\S]*blackbox-http/);
  assert.match(prometheusRules, /LingDianBackupLastAttemptFailed/);
  assert.match(prometheusRules, /LingDianBackupStale/);
  assert.match(prometheusRules, /LingDianBackupMetricMissing/);
});

test('API metrics labels use route templates and never raw URLs or request ids', async () => {
  const middleware = await read('backend/src/common/observability/http-observability.middleware.ts');
  const service = await read('backend/src/modules/metrics/metrics.service.ts');
  const exceptionFilter = await read('backend/src/common/filters/all-exceptions.filter.ts');

  assert.match(service, /labelNames:\s*\['method', 'route', 'status_code'\]/);
  assert.doesNotMatch(service, /request[_-]?id|user[_-]?id|originalUrl/i);
  assert.match(middleware, /return 'unmatched'/);
  assert.match(middleware, /route !== '\/api\/metrics'/);
  assert.match(exceptionFilter, /resolveRouteTemplate\(request\)/);
  assert.doesNotMatch(exceptionFilter, /request\.url/);
});

test('Nginx access logs never persist query strings or referrers', async () => {
  const templates = await Promise.all([
    read('deploy/nginx/templates/lingdian-http.conf.template'),
    read('deploy/nginx/templates/lingdian-https.conf.template'),
  ]);
  const alloy = await read('deploy/observability/alloy/config.alloy');

  for (const template of templates) {
    const logFormat = template.split('\n', 1)[0];
    assert.match(logFormat, /"method":"\$request_method"/);
    assert.match(logFormat, /"uri":"\$uri"/);
    assert.match(logFormat, /"protocol":"\$server_protocol"/);
    assert.doesNotMatch(logFormat, /\$request(?=")|\$request_uri|\$args|\$http_referer/);
  }

  assert.match(alloy, /method\s*= "method"/);
  assert.match(alloy, /protocol\s*= "protocol"/);
  assert.match(alloy, /uri\s*= "uri"/);
  assert.doesNotMatch(alloy, /request\s*= "request"/);
});
