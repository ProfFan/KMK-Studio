import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compile,
  createProject,
  key,
  validate,
  MODIFIERS,
} from "@kmk/compiler";
import { simulateKarabiner, simulateProject, evaluate } from "@kmk/simulator";
import { fixtureProject, scenarios } from "./fixtures.ts";
import { generatedTraces } from "./generated.ts";
import { layoutRows } from "../apps/editor/src/layouts.ts";
import { minimizeTrace } from "./minimize.ts";
import { mkdirSync, writeFileSync } from "node:fs";
export const presses = (output: ReturnType<typeof simulateProject>["output"]) =>
  output
    .filter(
      (e) =>
        e.type === "down" && !(MODIFIERS as readonly string[]).includes(e.key),
    )
    .map((e) => ({ key: e.key, modifiers: e.modifiers ?? [] }));
const project = fixtureProject();
for (const [name, events] of Object.entries(scenarios))
  test(`semantics: ${name}`, () => {
    const optimized = compile(project),
      plain = compile(project, { optimize: false });
    assert.ok(optimized.ok, JSON.stringify(optimized.diagnostics));
    const a = simulateProject(project, events),
      b = simulateKarabiner(optimized.asset!, events),
      c = simulateKarabiner(plain.asset!, events);
    assert.deepEqual(presses(b.output), presses(a.output));
    assert.deepEqual(b.output, c.output);
    assert.deepEqual(
      b.output.filter(
        (e) =>
          e.type === "down" &&
          !(MODIFIERS as readonly string[]).includes(e.key),
      ),
      a.output.filter(
        (e) =>
          e.type === "down" &&
          !(MODIFIERS as readonly string[]).includes(e.key),
      ),
      "action timing",
    );
    for (const [k, v] of Object.entries(b.variables))
      if (k.includes("_b")) assert.equal(v, 0, `stale variable ${k}`);
  });
test("output is deterministic and IDs are isolated", () => {
  const p = fixtureProject();
  assert.equal(JSON.stringify(compile(p)), JSON.stringify(compile(p)));
  const a = JSON.stringify(compile(p).asset);
  p.id += "2";
  assert.notEqual(a, JSON.stringify(compile(p).asset));
});
test("invalid projects never produce an asset", () => {
  for (const p of [null, [], {}, { ...createProject(), version: 2 }]) {
    const r = compile(p);
    assert.equal(r.ok, false);
    assert.equal(r.asset, undefined);
  }
});
test("conflicts, references, timing, unsupported interruption", () => {
  const p = createProject();
  p.layers[0].bindings = [
    { id: "a", key: "a", behavior: { type: "map", action: key("invalid") } },
    {
      id: "a",
      key: "a",
      behavior: {
        type: "dance",
        steps: [{ tap: key("a"), hold: key("b") }],
        interruption: "hold",
        timing: { holdMs: -1 },
      },
    },
  ];
  const codes = validate(p).map((x) => x.code);
  for (const c of ["KEY", "DUPLICATE_ID", "CONFLICT", "TIMING"])
    assert.ok(codes.includes(c));
});
test("expression evaluator rejects executable code", () => {
  assert.equal(evaluate("a == 0 ? (b + 1) : 4", { a: 0, b: 2 }), 3);
  assert.throws(() => evaluate("process.exit() ;", {}));
});
test("simple remap needs one manipulator and no variables or timers", () => {
  const p = createProject();
  p.layers[0].bindings = [
    { id: "a", key: "a", behavior: { type: "map", action: key("b") } },
  ];
  const s = compile(p).statistics;
  assert.equal(s.manipulators, 1);
  assert.equal(s.variables, 0);
  assert.equal(s.timers, 0);
});
test("unreachable overlays are removed without changing behavior", () => {
  const p = fixtureProject();
  p.layers.push({
    id: "unused",
    name: "Unused",
    bindings: [
      {
        id: "dead",
        key: "a",
        behavior: {
          type: "dance",
          steps: [{ tap: key("b") }, { tap: key("c") }],
        },
      },
    ],
  });
  const a = compile(p),
    b = compile(p, { optimize: false });
  assert.equal(b.statistics.manipulators - a.statistics.manipulators, 2);
  for (const events of Object.values(scenarios))
    assert.deepEqual(
      simulateKarabiner(a.asset!, events).output,
      simulateKarabiner(b.asset!, events).output,
    );
});
test("layouts are stable across rerenders and have unique key identities", () => {
  for (const id of ["mac", "ansi", "tkl", "sixty"]) {
    const a = layoutRows(id)
      .flat()
      .map((k) => k.key);
    assert.deepEqual(
      a,
      layoutRows(id)
        .flat()
        .map((k) => k.key),
    );
    assert.equal(new Set(a).size, a.length, id);
  }
});
test("malformed traces fail before interpretation", () => {
  for (const events of [
    [{ at: 0, type: "bogus" }],
    [{ at: -1, type: "down", key: "a" }],
    [{ at: 0, type: "down", key: "bad" }],
  ]) {
    assert.throws(() => simulateProject(project, events as never));
    assert.throws(() =>
      simulateKarabiner(compile(project).asset!, events as never),
    );
  }
});
test("generated physical traces preserve semantics and optimization", () => {
  const optimized = compile(project).asset!,
    plain = compile(project, { optimize: false }).asset!;
  for (const { name, events } of generatedTraces()) {
    const reference = simulateProject(project, events),
      actual = simulateKarabiner(optimized, events),
      unoptimized = simulateKarabiner(plain, events);
    try {
      assert.deepEqual(presses(actual.output), presses(reference.output));
    } catch (error) {
      const minimal = minimizeTrace(
        events,
        (candidate) =>
          JSON.stringify(
            presses(simulateKarabiner(optimized, candidate).output),
          ) !==
          JSON.stringify(presses(simulateProject(project, candidate).output)),
      );
      mkdirSync(".cache/regressions", { recursive: true });
      writeFileSync(
        `.cache/regressions/${name}.json`,
        JSON.stringify({ project, events: minimal }, null, 2),
      );
      throw error;
    }
    assert.deepEqual(actual.output, unoptimized.output, name);
  }
});

test("optimization reduces conditions and states and does not mutate the source", () => {
  const before = JSON.stringify(project);
  const a = compile(project),
    b = compile(project, { optimize: false });
  assert.equal(JSON.stringify(project), before);
  assert.ok(a.statistics.conditions < b.statistics.conditions);
  assert.ok(a.statistics.states < b.statistics.states);
});

test("many temporal layer toggles have bounded expression growth", () => {
  const p = createProject();
  p.layers.push({
    id: "nav",
    name: "Nav",
    bindings: [
      {
        id: "h",
        key: "h",
        behavior: { type: "map", action: key("left_arrow") },
      },
    ],
  });
  p.layers[0].bindings = [..."abcdefghijklmnopqrstuvwx"].map((k, i) => ({
    id: `toggle${i}`,
    key: k,
    behavior: {
      type: "dance" as const,
      steps: [
        {
          tap: {
            type: "layer" as const,
            layer: "nav",
            mode: "toggle" as const,
          },
        },
        { tap: key("escape") },
      ],
    },
  }));
  const result = compile(p);
  assert.ok(result.ok);
  assert.ok(result.statistics.bytes < 1_000_000);
  for (const k of ["a", "x"]) {
    const events = [
      { at: 0, type: "down" as const, key: k },
      { at: 10, type: "up" as const, key: k },
      { at: 80, type: "down" as const, key: "h" },
      { at: 90, type: "up" as const, key: "h" },
    ];
    assert.deepEqual(
      presses(simulateKarabiner(result.asset!, events).output),
      presses(simulateProject(p, events).output),
    );
  }
});
