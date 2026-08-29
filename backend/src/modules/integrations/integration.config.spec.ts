import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readConnectorSettings, validateIntegrationEnv } from './integration.config';

test('optional integrations are disabled and unavailable by default', () => {
  const settings = readConnectorSettings({});
  assert.equal(settings.length, 4);
  assert.ok(settings.every((item) => !item.deploymentEnabled && !item.endpoint && !item.signingSecret));
});

test('an enabled connector requires an endpoint and a strong signing secret', () => {
  const errors: string[] = [];
  validateIntegrationEnv({ INTEGRATION_CASHIER_ENABLED: 'true' }, errors);
  assert.ok(errors.some((message) => message.includes('INTEGRATION_CASHIER_CONNECTOR_URL')));
  assert.ok(errors.some((message) => message.includes('INTEGRATION_CASHIER_SIGNING_SECRET')));
});

test('production connectors require HTTPS while complete development connectors are accepted', () => {
  const developmentErrors: string[] = [];
  const base = {
    INTEGRATION_RECEIPT_ENABLED: 'true',
    INTEGRATION_RECEIPT_CONNECTOR_URL: 'http://127.0.0.1:9100/events',
    INTEGRATION_RECEIPT_SIGNING_SECRET: 'a-secure-development-secret-of-32-chars',
  };
  validateIntegrationEnv(base, developmentErrors);
  assert.deepEqual(developmentErrors, []);

  const productionErrors: string[] = [];
  validateIntegrationEnv({ ...base, NODE_ENV: 'production' }, productionErrors);
  assert.ok(productionErrors.some((message) => message.includes('HTTPS')));
});
