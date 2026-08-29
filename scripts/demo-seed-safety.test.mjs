import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertDemoSeedAllowed,
  clearPrimaryStoreDemoData,
} from '../backend/scripts/demo-seed-safety.mjs';

test('demo seed requires an explicit safe environment and opt-in', () => {
  for (const nodeEnv of [undefined, '', 'prod', 'Production', 'production']) {
    assert.throws(
      () => assertDemoSeedAllowed({ NODE_ENV: nodeEnv, ALLOW_DEMO_SEED: 'true' }),
      /NODE_ENV=development or NODE_ENV=test/,
    );
  }

  assert.throws(
    () => assertDemoSeedAllowed({ NODE_ENV: 'development' }),
    /ALLOW_DEMO_SEED=true/,
  );
  assert.doesNotThrow(() => assertDemoSeedAllowed({
    NODE_ENV: 'development',
    ALLOW_DEMO_SEED: 'true',
  }));
  assert.doesNotThrow(() => assertDemoSeedAllowed({
    NODE_ENV: 'test',
    ALLOW_DEMO_SEED: 'true',
  }));
});

test('demo reset clears restricted payment rows first and scopes every delete to the primary store', async () => {
  const calls = [];
  const modelNames = [
    'paymentTransaction',
    'paymentWebhookEvent',
    'paymentIntent',
    'integrationOutbox',
    'orderStatusLog',
    'orderItemSelection',
    'orderItem',
    'order',
    'productSelectionGroup',
    'selectionOption',
    'selectionGroup',
    'productSKU',
    'product',
    'category',
  ];
  const tx = Object.fromEntries(modelNames.map((model) => [model, {
    deleteMany: async (args) => calls.push({ model, args }),
  }]));

  await clearPrimaryStoreDemoData(tx, 'primary-store');

  assert.deepEqual(calls.map(({ model }) => model), modelNames);
  for (const { args } of calls) {
    assert.match(JSON.stringify(args), /primary-store/);
  }
  assert.deepEqual(calls[0].args, {
    where: { paymentIntent: { order: { storeId: 'primary-store' } } },
  });
  assert.deepEqual(calls[2].args, {
    where: { order: { storeId: 'primary-store' } },
  });
  assert.deepEqual(calls[7].args, {
    where: { storeId: 'primary-store' },
  });
});
