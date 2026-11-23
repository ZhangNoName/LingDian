import assert from "node:assert/strict";
import test from "node:test";
import { createClientLogReporter } from "../dist/index.js";

test("does not drop reports while an earlier send is pending", async () => {
  const events = [];
  let releaseFirst;
  const firstPending = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const reporter = createClientLogReporter("MINIAPP", async (event) => {
    events.push(event);
    if (events.length === 1) await firstPending;
  });

  reporter.report(new Error("first"));
  reporter.report(new Error("second"));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events.map((event) => event.message), ["first", "second"]);
  releaseFirst();
});

test("swallows synchronous sender failures", async () => {
  const reporter = createClientLogReporter("MINIAPP", () => {
    throw new Error("sender failed");
  });

  assert.doesNotThrow(() => reporter.report(new Error("application failed")));
  await new Promise((resolve) => setImmediate(resolve));
});
