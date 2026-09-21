import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, oneShot, MODIFIERS, type Action } from "@kmk/compiler";
import { simulateProject, simulateKarabiner } from "@kmk/simulator";
import {
  oneShotProject,
  oneShotScenarios,
  generatedOneShotTraces,
} from "./oneshot-fixtures.ts";
import { trace } from "./fixtures.ts";
const visible = (output: ReturnType<typeof simulateProject>["output"]) =>
  output.filter((e) => !(MODIFIERS as readonly string[]).includes(e.key));
for (const timeout of [undefined, 300])
  for (const reverse of [false, true]) {
    const p = oneShotProject(timeout, reverse);
    const optimized = compile(p),
      plain = compile(p, { optimize: false });
    for (const [name, { events, keys }] of Object.entries(oneShotScenarios))
      test(`one-shot ${timeout ?? "indefinite"} reverse=${reverse}: ${name}`, () => {
        assert.ok(optimized.ok, JSON.stringify(optimized.diagnostics));
        const spec = simulateProject(p, events),
          generated = simulateKarabiner(optimized.asset!, events),
          unoptimized = simulateKarabiner(plain.asset!, events);
        if (keys)
          assert.deepEqual(
            visible(spec.output)
              .filter((e) => e.type === "down")
              .map((e) => e.key),
            keys,
          );
        assert.deepEqual(visible(generated.output), visible(spec.output));
        assert.deepEqual(generated.output, unoptimized.output);
        for (const [k, v] of Object.entries(generated.variables))
          if (k.includes("_b")) assert.equal(v, 0, `stale ${k}`);
      });
  }
test("expiry is exclusive at the exact boundary; omitted expiry stays armed", () => {
  for (const [at, expected] of [
    [309, "left_arrow"],
    [310, "h"],
    [311, "h"],
  ] as const) {
    const p = oneShotProject(300),
      events = trace("f1", "-f1", at, "h", "-h");
    for (const result of [
      simulateProject(p, events),
      simulateKarabiner(compile(p).asset!, events),
    ])
      assert.equal(result.output.find((e) => e.type === "down")?.key, expected);
  }
  const events = trace("f1", "-f1", 100000, "h", "-h");
  assert.equal(
    simulateProject(oneShotProject(), events).output[0].key,
    "left_arrow",
  );
});
test("expiry validation, helper, deterministic output, and no expiry timers", () => {
  assert.deepEqual(oneShot("nav"), {
    type: "layer",
    layer: "nav",
    mode: "oneshot",
  });
  for (const timeout of [0, -1, 1.5, 60001, null, "300"]) {
    const p = oneShotProject();
    p.layers[0].bindings[1].behavior = {
      type: "map",
      action: { ...oneShot("nav"), timeoutMs: timeout } as Action,
    };
    const result = compile(p);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((d) => d.code === "ONESHOT_TIMEOUT"));
  }
  const a = compile(oneShotProject()),
    b = compile(oneShotProject(300));
  assert.equal(a.statistics.timers, b.statistics.timers);
  assert.deepEqual(b, compile(oneShotProject(300)));
});

test("generated one-shot traces preserve action timing, modifiers, and optimization", () => {
  for (const timeout of [undefined, 300])
    for (const reverse of [false, true]) {
      const p = oneShotProject(timeout, reverse),
        a = compile(p).asset!,
        b = compile(p, { optimize: false }).asset!;
      for (const { name, events } of generatedOneShotTraces) {
        const spec = simulateProject(p, events),
          optimized = simulateKarabiner(a, events),
          plain = simulateKarabiner(b, events);
        assert.deepEqual(
          visible(optimized.output),
          visible(spec.output),
          `${name} ${timeout} ${reverse}`,
        );
        assert.deepEqual(optimized.output, plain.output);
      }
    }
});
