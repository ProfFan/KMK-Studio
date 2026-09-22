import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compile,
  createProject,
  deviceIdentifier,
  key,
  type DeviceFilter,
  type Project,
  MODIFIERS,
} from "@kmk/compiler";
import { simulateKarabiner, simulateProject } from "@kmk/simulator";
import { oneShotProject } from "./oneshot-fixtures.ts";
import { trace } from "./fixtures.ts";
import { deviceScenarios } from "./device-fixtures.ts";

test("device filter guards every entry, continuation, and one-shot helper in both modes", () => {
  for (const filter of [
    { type: "vendor_product", vendorId: 1452, productId: 832 },
    { type: "built_in_keyboard" },
  ] satisfies DeviceFilter[]) {
    const p = oneShotProject(300);
    const before = structuredClone(p);
    p.deviceFilter = filter;
    for (const optimize of [false, true]) {
      const a = compile(p, { optimize }),
        b = compile(before, { optimize });
      assert.ok(a.ok, JSON.stringify(a.diagnostics));
      assert.equal(a.asset!.rules.length, 1);
      assert.equal(
        a.statistics.conditions,
        b.statistics.conditions + b.statistics.manipulators,
      );
      for (const metric of [
        "timers",
        "manipulators",
        "variables",
        "states",
      ] as const)
        assert.equal(a.statistics[metric], b.statistics[metric]);
      const restored = structuredClone(a.asset);
      for (const m of restored!.rules[0].manipulators) {
        assert.deepEqual(m.conditions![0], {
          type: "device_if",
          identifiers: [deviceIdentifier(filter)],
        });
        m.conditions!.shift();
        if (optimize && !m.conditions!.length) delete m.conditions;
      }
      assert.deepEqual(restored, b.asset);
      assert.deepEqual(
        a,
        compile(p, { optimize }),
        "deterministic compilation",
      );
    }
    assert.deepEqual(
      p,
      { ...before, deviceFilter: filter },
      "input stays untouched",
    );
  }
});

test("invalid or ambiguous device filters never export", () => {
  const invalid: unknown[] = [
    null,
    [],
    {},
    { type: "all" },
    { type: "device_if" },
    { type: "built_in_keyboard", vendorId: 1452 },
    { type: "built_in_keyboard", is_built_in_keyboard: false },
  ];
  for (const field of ["vendorId", "productId"])
    for (const value of [
      undefined,
      null,
      "1452",
      -1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ])
      invalid.push({
        type: "vendor_product",
        vendorId: 1452,
        productId: 832,
        [field]: value,
      });
  for (const deviceFilter of invalid) {
    const result = compile({ ...createProject(), deviceFilter });
    assert.equal(result.ok, false, JSON.stringify(deviceFilter));
    assert.equal(result.asset, undefined);
    assert.ok(
      result.diagnostics.some((d) => d.path.startsWith("/deviceFilter")),
    );
  }
  for (const value of [0, 65535, Number.MAX_SAFE_INTEGER])
    assert.ok(
      compile({
        ...createProject(),
        deviceFilter: {
          type: "vendor_product",
          vendorId: value,
          productId: value,
        },
      }).ok,
    );
});

test("matching devices preserve semantics; excluded and unknown devices pass through", () => {
  const visible = (output: ReturnType<typeof simulateProject>["output"]) =>
    output.filter((e) => !(MODIFIERS as readonly string[]).includes(e.key));
  for (const c of deviceScenarios()) {
    const baseline: Project = c.matches
      ? { ...c.project, deviceFilter: undefined }
      : createProject();
    const expected = simulateProject(baseline, c.events);
    const spec = simulateProject(c.project, c.events, undefined, c.device);
    assert.deepEqual(spec.output, expected.output, c.name);
    const optimized = simulateKarabiner(
      compile(c.project).asset!,
      c.events,
      undefined,
      c.device,
    );
    const plain = simulateKarabiner(
      compile(c.project, { optimize: false }).asset!,
      c.events,
      undefined,
      c.device,
    );
    assert.deepEqual(visible(optimized.output), visible(spec.output), c.name);
    assert.deepEqual(optimized.output, plain.output, c.name);
    for (const [name, value] of Object.entries(optimized.variables))
      if (name.includes("_b"))
        assert.equal(value, 0, `stale gesture: ${c.name}`);
    if (!c.matches) assert.deepEqual(optimized.variables, {}, c.name);
  }
});

test("reset retains the device restriction", () => {
  const p = createProject();
  p.deviceFilter = { type: "built_in_keyboard" };
  p.layers[0].bindings.push({
    id: "a",
    key: "a",
    behavior: { type: "map", action: key("b") },
  });
  const events = [
    ...trace("a", "-a"),
    { at: 30, type: "reset" as const },
    ...trace(40, "a", "-a"),
  ];
  for (const result of [
    simulateProject(p, events),
    simulateKarabiner(compile(p).asset!, events),
  ])
    assert.deepEqual(
      result.output.filter((e) => e.type === "down").map((e) => e.key),
      ["a", "a"],
    );
});
