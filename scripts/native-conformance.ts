import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  compile,
  MODIFIERS,
  stateName,
  type InputEvent,
  type Project,
} from "@kmk/compiler";
import { simulateProject, simulateKarabiner } from "@kmk/simulator";
import { fixtureProject, scenarios, trace } from "../tests/fixtures.ts";
import { runNative, type NativeCase } from "./oracle.ts";
import { deviceScenarios } from "../tests/device-fixtures.ts";
import {
  oneShotProject,
  oneShotScenarios,
  generatedOneShotTraces,
} from "../tests/oneshot-fixtures.ts";
import { generatedTraces } from "../tests/generated.ts";

const p = fixtureProject();
const assets = [compile(p).asset!, compile(p, { optimize: false }).asset!];
const traces: { name: string; events: InputEvent[]; until?: number }[] = [
  ...Object.entries(scenarios).map(([name, events]) => ({ name, events })),
  ...generatedTraces(),
];
// Observe prefixes around each competing deadline. Native HID report timestamps
// include event-queue spacing, so checking each prefix tests decision time directly.
for (const name of [
  "single",
  "double",
  "triple",
  "hold-alone",
  "hold-second",
  "hold-third",
  "hold-layer",
  "interrupted",
  "roll",
  "held-gesture-shortcut",
]) {
  const events = scenarios[name];
  const points = new Set<number>();
  for (const e of events)
    for (const offset of e.type === "down" ? [0, 200, 250] : [0])
      for (const delta of [-1, 0, 1])
        if (e.at + offset + delta >= 0) points.add(e.at + offset + delta);
  for (const until of [...points].sort((a, b) => a - b))
    traces.push({
      name: `${name} @ ${until}ms`,
      events: events.filter((e) => e.at <= until),
      until,
    });
}
const cases: (NativeCase & { project: Project })[] = assets.flatMap(
  (asset, i) =>
    traces.map((t) => ({
      ...t,
      name: `${i ? "plain" : "optimized"} / ${t.name}`,
      asset,
      project: p,
    })),
);
// Equal hold/window deadlines and small/large timing overrides are separate
// compiler inputs; they must not rely on the default timing in the test harness.
for (const timing of [
  { tapWindowMs: 200, holdMs: 200 },
  { tapWindowMs: 700, holdMs: 300 },
  { tapWindowMs: 20, holdMs: 10 },
]) {
  const project = structuredClone(p);
  project.timing = timing;
  for (const optimize of [true, false])
    for (const [name, events] of Object.entries(scenarios))
      cases.push({
        project,
        asset: compile(project, { optimize }).asset!,
        name: `timing ${timing.tapWindowMs}/${timing.holdMs} ${optimize} / ${name}`,
        events,
      });
}
for (const timeout of [undefined, 300])
  for (const reverse of [false, true]) {
    const project = oneShotProject(timeout, reverse);
    for (const optimize of [true, false]) {
      const asset = compile(project, { optimize }).asset!;
      for (const { name, events } of [
        ...Object.entries(oneShotScenarios).map(([name, t]) => ({
          name,
          ...t,
        })),
        ...generatedOneShotTraces,
      ])
        cases.push({
          project,
          asset,
          events,
          name: `one-shot ${timeout ?? "indefinite"} reverse=${reverse} optimize=${optimize}: ${name}`,
        });
    }
  }
for (const c of deviceScenarios())
  for (const optimize of [true, false])
    cases.push({
      ...c,
      asset: compile(c.project, { optimize }).asset!,
      name: `device filter optimize=${optimize}: ${c.name}`,
    });
const native = runNative(cases);
let failures = 0;
for (const [i, r] of native.entries()) {
  const c = cases[i],
    reference = simulateProject(c.project, c.events, c.until, c.device);
  const expected = reference.output
    .filter(
      (e) =>
        e.type === "down" && !(MODIFIERS as readonly string[]).includes(e.key),
    )
    .map((e) => ({ key: e.key, modifiers: e.modifiers ?? [] }));
  try {
    assert.deepEqual(r.presses, expected);
    if (c.until === undefined) {
      assert.equal(
        r.activeModifierFlags,
        0,
        "unbalanced engine modifier ownership",
      );
      for (const [key, value] of Object.entries(r.variables))
        if (key.includes("_b")) assert.equal(value, 0, `stale ${key}`);
      for (const field of ["keyboard_input", "consumer_input"]) {
        const final = r.reports.filter((r) => r[field]).at(-1)?.[field];
        if (final) {
          assert.deepEqual(final.keys, [], "unreleased output keys");
        }
      }
    }
  } catch (error) {
    failures++;
    console.error(r.name, String(error));
  }
}
// Preserve an engine limitation as a regression, not a supported cleanup promise:
// removing an idle manipulator destroys its pending delayed-action callback.
const invalidated = [
  ...trace("a", "-a"),
  { at: 100, type: "invalidate" as const },
  ...trace(150, "a", "-a"),
];
const [removed] = runNative([
  {
    name: "native rule-removal limitation",
    asset: assets[0],
    events: invalidated,
  },
]);
assert.deepEqual(removed.presses, [{ key: "a", modifiers: [] }]);
assert.equal(removed.variables[stateName(p, p.layers[0].bindings[0])], 12);
assert.deepEqual(
  simulateKarabiner(assets[0], invalidated)
    .output.filter((e) => e.type === "down")
    .map((e) => e.key),
  ["a"],
);
const report = {
  target: "16.3.0",
  revision: "9312593e1a3bf72b94c63c524ebabe2637442e8a",
  cases: cases.length,
  passed: cases.length - failures,
  failures,
  knownLimitationChecks: 1,
  expressionClock: "epoch + dispatcher trace milliseconds",
};
writeFileSync(
  ".cache/native/conformance-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `${report.passed}/${report.cases} native engine cases passed (Karabiner 16.3.0); rule-removal limitation reproduced.`,
);
if (failures) process.exitCode = 1;
