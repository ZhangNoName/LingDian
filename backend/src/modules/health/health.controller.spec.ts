import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { HealthController } from './health.controller';

test('liveness does not query the database and readiness delegates to store context', async () => {
  let readinessChecks = 0;
  const controller = new HealthController({
    assertReady: async () => { readinessChecks += 1; },
  } as never);

  assert.equal(controller.getHealth().status, 'ok');
  assert.equal(controller.getLiveness().status, 'ok');
  assert.equal(readinessChecks, 0);
  assert.equal((await controller.getReadiness()).status, 'ready');
  assert.equal(readinessChecks, 1);
});
