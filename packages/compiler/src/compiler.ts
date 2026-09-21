import { holdPolicy, isModifier, MODIFIERS } from "./model.ts";
import { validate } from "./validate.ts";
import { normalize, elaborate, simplifyMachines } from "./passes.ts";
export { normalize, elaborate, simplifyMachines } from "./passes.ts";
import type {
  Action,
  Binding,
  CompileOptions,
  CompileResult,
  Condition,
  Layer,
  Manipulator,
  Project,
  SourceMapping,
  Statistics,
  ToEvent,
} from "./types.ts";

// UTF-16 encoding is injective (unlike a shortened hash) and valid in ExprTk identifiers.
const encode = (s: string) =>
  Array.from({ length: s.length }, (_, i) =>
    s.charCodeAt(i).toString(16).padStart(4, "0"),
  ).join("");
export const namespace = (p: Project) => `kmk_${encode(p.id)}`;
export const stateName = (p: Project, b: Binding) =>
  `${namespace(p)}_b${encode(b.id)}`;
export const toggleName = (p: Project, l: string) =>
  `${namespace(p)}_l${encode(l)}`;
export const ownerName = (p: Project, b: Binding, l: string) =>
  `${stateName(p, b)}_o${encode(l)}`;
const set = (name: string, value: number | string): ToEvent => ({
  set_variable: {
    name,
    ...(typeof value === "number" ? { value } : { expression: value }),
  },
});
const eq = (name: string, value: number): Condition => ({
  type: "variable_if",
  name,
  value,
});
const expr = (expression: string): Condition => ({
  type: "expression_if",
  expression,
});
const guarded = (events: ToEvent[], conditions: Condition[]): ToEvent[] =>
  events.map((e) => ({
    ...e,
    conditions: [...(e.conditions ?? []), ...conditions],
  }));
const flatten = (a: Action): Action[] =>
  a.type === "sequence" ? a.actions.flatMap(flatten) : [a];
export const actionsOf = (b: Binding): Action[] =>
  b.behavior.type === "map"
    ? flatten(b.behavior.action)
    : b.behavior.steps.flatMap((s) => [
        ...flatten(s.tap),
        ...(s.hold ? flatten(s.hold) : []),
      ]);

export function compile(
  input: unknown,
  options: CompileOptions = {},
): CompileResult {
  const diagnostics = validate(input);
  const empty: Statistics = {
    manipulators: 0,
    timers: 0,
    conditions: 0,
    variables: 0,
    bytes: 0,
    states: 0,
  };
  if (diagnostics.some((d) => d.severity === "error"))
    return {
      ok: false,
      diagnostics,
      sourceMap: [],
      statistics: empty,
      machines: [],
      passes: [],
    };
  const p = normalize(input as Project);
  const reachable = new Set([p.layers[0].id]);
  for (let size = -1; size !== reachable.size;) {
    size = reachable.size;
    for (const l of p.layers)
      if (reachable.has(l.id))
        for (const b of l.bindings)
          for (const a of actionsOf(b))
            if (a.type === "layer") reachable.add(a.layer);
  }
  const removedLayers =
    options.optimize === false
      ? 0
      : p.layers.filter((l) => !reachable.has(l.id)).length;
  if (options.optimize !== false)
    p.layers = p.layers.filter((l) => reachable.has(l.id));
  const machines =
      options.optimize === false
        ? elaborate(p)
        : simplifyMachines(elaborate(p)),
    sourceMap: SourceMapping[] = [],
    manipulators: Manipulator[] = [];
  const all = p.layers.flatMap((l) => l.bindings.map((b) => ({ l, b })));
  const shotOrigin = all.find(({ b }) =>
    actionsOf(b).some((a) => a.type === "layer" && a.mode === "oneshot"),
  );
  const shot = `${namespace(p)}_oneshot_layer`,
    expiry = `${namespace(p)}_oneshot_deadline`;
  const acknowledged = `${namespace(p)}_oneshot_consumed_from`;
  const shotId = (id: string) => p.layers.findIndex((l) => l.id === id) + 1;
  const bindingId = (b: Binding) => all.findIndex((x) => x.b === b) + 1;
  const hasShot = (a: Action) =>
    flatten(a).some((x) => x.type === "layer" && x.mode === "oneshot");
  const needsAck = all.some(
    ({ b }) => b.behavior.type === "dance" && actionsOf(b).some(hasShot),
  );
  const isMod = (k: string) => (MODIFIERS as readonly string[]).includes(k);
  const shotLive = `(${shot} != 0 and (${expiry} == -1 or ${expiry} > system.now.milliseconds))`;
  const clearShot = (): ToEvent[] =>
    shotOrigin ? [set(shot, 0), set(expiry, 0)] : [];
  const consume = (k: string) =>
    !isMod(k) ? guarded(clearShot(), [expr(`${shot} != 0`)]) : [];
  // Canceled callbacks can run before or after selection of the incoming rule.
  // Mark the pending arm as consumed before changing the incoming gesture phase.
  const branches = (incoming: string) =>
    all.flatMap(({ b }) => {
      if (b.key === incoming || b.behavior.type !== "dance") return [];
      const behavior = b.behavior;
      return behavior.steps.flatMap((step, i) => [
        {
          b,
          guard: `${stateName(p, b)} == ${(i + 1) * 10 + 2}`,
          action: step.tap,
        },
        {
          b,
          guard: `${stateName(p, b)} == ${(i + 1) * 10 + 1}`,
          action:
            holdPolicy(behavior) === "hold" && step.hold ? step.hold : step.tap,
        },
      ]);
    });
  const acknowledge = (k: string): ToEvent[] =>
    needsAck
      ? [
          set(
            acknowledged,
            isMod(k)
              ? 0
              : branches(k)
                  .filter((x) => hasShot(x.action))
                  .map((x) => `((${x.guard}) ? ${bindingId(x.b)} : 0)`)
                  .join(" + ") || 0,
          ),
        ]
      : [];
  // Last one-shot/set in a sequence determines the pending activation.
  const projectedShot = (action: Action): string | undefined => {
    let target: string | undefined;
    for (const a of flatten(action))
      if (a.type === "layer") {
        if (a.mode === "set") target = "0";
        if (a.mode === "oneshot") target = String(shotId(a.layer));
      }
    return target;
  };
  const shotAvailable = (incoming: string): string => {
    const changes = branches(incoming)
      .map((x) => ({ ...x, target: projectedShot(x.action) }))
      .filter((x) => x.target !== undefined);
    return changes.length
      ? `((${shotLive} and (${changes.map((x) => `(${x.guard})`).join(" or ")}) == 0) or ${changes.map((x) => `((${x.guard}) and ${x.target} != 0)`).join(" or ")})`
      : shotLive;
  };
  const owners = (l: string) =>
    all
      .filter(({ b }) =>
        actionsOf(b).some(
          (a) => a.type === "layer" && a.layer === l && a.mode === "momentary",
        ),
      )
      .map(({ b }) => ownerName(p, b, l));
  const output = (
    a: Action,
    b: Binding,
    held = false,
    canceled = false,
  ): ToEvent[] => {
    switch (a.type) {
      case "key":
        return [
          {
            key_code: a.key,
            ...(a.modifiers?.length
              ? { modifiers: [...new Set(a.modifiers)] }
              : {}),
            ...(!held ? { repeat: false } : {}),
          },
        ];
      case "consumer":
        return [
          { consumer_key_code: a.key, ...(!held ? { repeat: false } : {}) },
        ];
      case "sequence":
        return a.actions.flatMap((x) => output(x, b, false, canceled));
      case "layer":
        if (a.mode === "oneshot")
          return guarded(
            [
              set(shot, shotId(a.layer)),
              set(
                expiry,
                a.timeoutMs === undefined
                  ? -1
                  : `system.now.milliseconds + ${a.timeoutMs}`,
              ),
            ],
            canceled && needsAck
              ? [expr(`${acknowledged} != ${bindingId(b)}`)]
              : [],
          );
        if (a.mode === "momentary") return [set(ownerName(p, b, a.layer), 1)];
        if (a.mode === "toggle")
          return [
            set(
              toggleName(p, a.layer),
              `${toggleName(p, a.layer)} == 0 ? 1 : 0`,
            ),
          ];
        return [
          ...clearShot(),
          ...p.layers.flatMap((l) => owners(l.id).map((v) => set(v, 0))),
          ...p.layers.map((l) =>
            set(toggleName(p, l.id), l.id === a.layer ? 1 : 0),
          ),
        ];
      case "block":
      case "transparent":
        return [];
    }
  };
  const cleanOwners = (b: Binding) =>
    [
      ...new Set(
        actionsOf(b)
          .filter((a) => a.type === "layer" && a.mode === "momentary")
          .map((a) => (a as Extract<Action, { type: "layer" }>).layer),
      ),
    ].map((l) => set(ownerName(p, b, l), 0));
  // Predict the layer effects of an interruption at rule-selection time. This avoids
  // relying on the canceled callback's position relative to the incoming binding.
  const active = (layer: Layer, incoming: string): string => {
    if (layer === p.layers[0]) return "1";
    const toggled = toggleName(p, layer.id);
    const ownerActive =
      owners(layer.id)
        .map((v) => `${v} != 0`)
        .join(" or ") || "0";
    const currentShot = shotOrigin
      ? `(${shot} == ${shotId(layer.id)} and ${shotLive})`
      : "0";
    const base = `(${toggled} != 0 or (${ownerActive})${shotOrigin ? ` or ${currentShot}` : ""})`;
    const overrides: string[] = [],
      effects: string[] = [];
    // Every unrelated down resolves the previous gesture, so pending guards are
    // mutually exclusive. Compose each branch once, keeping expression growth
    // linear instead of duplicating nested toggle expressions exponentially.
    for (const { b } of all) {
      if (b.key === incoming || b.behavior.type !== "dance") continue;
      const phase = stateName(p, b),
        policy = holdPolicy(b.behavior);
      b.behavior.steps.forEach((step, i) => {
        const n = (i + 1) * 10;
        const alternatives = [
          { guard: `${phase} == ${n + 2}`, action: step.tap },
          {
            guard: `${phase} == ${n + 1}`,
            action: policy === "hold" && step.hold ? step.hold : step.tap,
          },
        ];
        for (const { guard, action } of alternatives) {
          let bit: "same" | "invert" | 0 | 1 = "same",
            owned: "same" | 0 | 1 = "same";
          for (const a of flatten(action))
            if (a.type === "layer") {
              if (a.mode === "set") {
                bit = a.layer === layer.id ? 1 : 0;
                owned = 0;
              }
              if (a.mode === "momentary" && a.layer === layer.id) owned = 1;
              if (a.mode === "toggle" && a.layer === layer.id)
                bit =
                  bit === "same"
                    ? "invert"
                    : bit === "invert"
                      ? "same"
                      : bit === 0
                        ? 1
                        : 0;
            }
          const target = shotOrigin ? projectedShot(action) : undefined;
          if (bit === "same" && owned === "same" && target === undefined)
            continue;
          const value =
            owned === 1
              ? "1"
              : `(${bit === "same" ? `${toggled} != 0` : bit === "invert" ? `${toggled} == 0` : bit}${owned === "same" ? ` or (${ownerActive})` : ""})`;
          const withShot = shotOrigin
            ? `(${value} or ${target === undefined ? currentShot : Number(target) === shotId(layer.id) ? "1" : "0"})`
            : value;
          overrides.push(`(${guard})`);
          effects.push(`((${guard}) and ${withShot})`);
        }
      });
    }
    return overrides.length
      ? `((${base} and (${overrides.join(" or ")}) == 0) or ${effects.join(" or ")})`
      : base;
  };
  const layerConditions = (l: Layer, b: Binding): Condition[] => {
    const li = p.layers.indexOf(l);
    const parts: string[] = [];
    if (li > 0) parts.push(active(l, b.key));
    for (const higher of p.layers.slice(li + 1))
      if (
        higher.bindings.some(
          (x) =>
            x.key === b.key &&
            !(
              x.behavior.type === "map" &&
              x.behavior.action.type === "transparent"
            ),
        )
      )
        parts.push(`(${active(higher, b.key)}) == 0`);
    return parts.length ? [expr(parts.join(" and "))] : [];
  };
  const emit = (m: Manipulator, l: Layer, b: Binding, phase: string) => {
    sourceMap.push({
      manipulator: manipulators.length,
      bindingId: b.id,
      layerId: l.id,
      phase,
    });
    manipulators.push(m);
  };
  const from = (b: Binding): Manipulator["from"] => ({
    key_code: b.key,
    modifiers: { optional: ["any"] },
  });
  if (shotOrigin)
    emit(
      {
        type: "basic",
        description: "One-shot · Escape cancels",
        from: { key_code: "escape", modifiers: { optional: ["any"] } },
        conditions: [expr(shotAvailable("escape"))],
        to: [...acknowledge("escape"), ...clearShot()],
      },
      shotOrigin.l,
      shotOrigin.b,
      "oneshot-cancel",
    );
  // Continuations from every binding precede every entry rule. A canceled old timer
  // sees the new phase and cannot emit a shorter prefix or erase the new gesture.
  const danceEntries = all
    .filter((x) => x.b.behavior.type === "dance")
    .map((entry) => ({
      ...entry,
      machine: machines.find((m) => m.bindingId === entry.b.id)!,
    }));
  for (let stage = 3; stage >= 1; stage--)
    for (const { l, b, machine } of danceEntries) {
      if (b.behavior.type !== "dance" || stage > b.behavior.steps.length)
        continue;
      const behavior = b.behavior,
        step = machine.stages[stage - 1],
        name = stateName(p, b),
        n = stage * 10;
      const terminal = step.terminal;
      const time = step.timing;
      const waiting = [eq(name, n + 2)],
        down = [eq(name, n + 1)];
      const lazy = holdPolicy(behavior) === "hold" && isModifier(step.hold);
      const heldAction = step.hold ? output(step.hold, b, true) : [];
      const cancel = [
        ...guarded(output(step.tap, b, false, true), waiting),
        ...guarded(
          holdPolicy(behavior) === "hold" && step.hold
            ? lazy
              ? []
              : output(step.hold, b, false, true)
            : output(step.tap, b, false, true),
          down,
        ),
        ...guarded([set(name, 0)], waiting),
        ...guarded(
          [
            set(
              name,
              holdPolicy(behavior) === "hold" && step.hold ? n + 5 : n + 4,
            ),
          ],
          down,
        ),
      ];
      const release = [
        ...(terminal ? guarded(output(step.tap, b), down) : []),
        // Conditions are snapshotted before this action list. A terminal release
        // needs one reset; writing a transient waiting phase is redundant.
        ...(!terminal || options.optimize === false
          ? guarded([set(name, n + 2)], down)
          : []),
        ...guarded(
          [set(name, 0)],
          terminal ? [] : [expr(`${name} != ${n + 1}`)],
        ),
        ...cleanOwners(b),
      ];
      const timeout =
        options.optimize !== false && step.hold
          ? terminal
            ? []
            : [
                ...guarded(output(step.tap, b), waiting),
                ...guarded([set(name, 0)], waiting),
              ]
          : [
              ...guarded(output(step.tap, b), [
                expr(`${name} == ${n + 1} or ${name} == ${n + 2}`),
              ]),
              ...guarded([set(name, 0)], waiting),
              ...guarded([set(name, n + 4)], down),
            ];
      const m: Manipulator = {
        type: "basic",
        description: `${l.name} · ${b.key} · ${stage} ${stage === 1 ? "press" : "presses"}`,
        from: from(b),
        conditions:
          stage > 1 ? [eq(name, (stage - 1) * 10 + 2)] : layerConditions(l, b),
        // A terminal release action has no continuation deadline. Keep its cancellation
        // hook armed for the engine's maximum int32 duration (about 24 days).
        parameters: {
          "basic.to_delayed_action_delay_milliseconds":
            terminal && !step.hold ? 2147483647 : time.tapWindowMs,
          ...(step.hold
            ? { "basic.to_if_held_down_threshold_milliseconds": time.holdMs }
            : {}),
        },
        to: [
          ...acknowledge(b.key),
          ...consume(b.key),
          set(name, n + 1),
          ...(lazy ? heldAction.map((e) => ({ ...e, lazy: true })) : []),
        ],
        to_after_key_up: release,
        to_delayed_action: {
          to_if_invoked: timeout,
          to_if_canceled: cancel,
        },
        ...(step.hold
          ? {
              to_if_held_down: [
                ...guarded([set(name, n + 5), ...heldAction], down),
              ],
            }
          : {}),
      };
      emit(m, l, b, stage > 1 ? `continue-${stage}` : "begin");
    }
  for (const { l, b } of [...all].reverse())
    if (b.behavior.type === "map" && b.behavior.action.type !== "transparent") {
      const a = b.behavior.action;
      emit(
        {
          type: "basic",
          description: `${l.name} · ${b.key}`,
          from: from(b),
          conditions: layerConditions(l, b),
          to: [...consume(b.key), ...output(a, b, a.type !== "sequence")],
          ...(cleanOwners(b).length ? { to_after_key_up: cleanOwners(b) } : {}),
        },
        l,
        b,
        "map",
      );
    }
  if (shotOrigin) {
    // Unknown/unbound keys still consume; modifiers pass through without consuming.
    for (const key of MODIFIERS)
      emit(
        {
          type: "basic",
          description: "One-shot · preserve modifier",
          from: { key_code: key, modifiers: { optional: ["any"] } },
          conditions: [expr(`${shot} != 0`)],
          to: [{ key_code: key }],
        },
        shotOrigin.l,
        shotOrigin.b,
        "oneshot-modifier",
      );
    emit(
      {
        type: "basic",
        description: "One-shot · consume fallthrough",
        from: { any: "key_code", modifiers: { optional: ["any"] } },
        conditions: [expr(`${shot} != 0`)],
        to: [...clearShot(), { from_event: true }],
      },
      shotOrigin.l,
      shotOrigin.b,
      "oneshot-fallthrough",
    );
  }
  if (options.optimize !== false)
    for (const m of manipulators) {
      if (!m.conditions?.length) delete m.conditions;
      for (const field of ["to", "to_after_key_up", "to_if_held_down"] as const)
        if (m[field]?.length === 0) delete m[field];
      for (const list of [
        m.to,
        m.to_after_key_up,
        m.to_if_held_down,
        m.to_delayed_action?.to_if_invoked,
        m.to_delayed_action?.to_if_canceled,
      ])
        if (list)
          for (const event of list) {
            if (event.conditions)
              event.conditions = [
                ...new Map(
                  event.conditions.map((c) => [JSON.stringify(c), c]),
                ).values(),
              ];
          }
    }
  const asset = {
    title: p.name,
    rules: [
      { description: `KMK · ${p.name} (Karabiner 16.3.0)`, manipulators },
    ],
  };
  const json = JSON.stringify(asset);
  const vars = new Set<string>();
  let conditions = 0,
    timers = 0;
  for (const m of manipulators) {
    timers += Number(!!m.to_delayed_action) + Number(!!m.to_if_held_down);
    conditions += m.conditions?.length ?? 0;
    for (const list of [
      m.to,
      m.to_after_key_up,
      m.to_if_held_down,
      m.to_delayed_action?.to_if_invoked,
      m.to_delayed_action?.to_if_canceled,
    ])
      for (const e of list ?? []) {
        if (e.set_variable) vars.add(e.set_variable.name);
        conditions += e.conditions?.length ?? 0;
      }
  }
  return {
    ok: true,
    diagnostics,
    asset,
    sourceMap,
    machines,
    statistics: {
      manipulators: manipulators.length,
      timers,
      conditions,
      variables: vars.size,
      bytes: new TextEncoder().encode(json).length,
      states: machines.reduce((n, m) => n + m.states.length, 0),
    },
    passes: [
      {
        name: "validate / normalize",
        detail: `${all.length} bindings; defaults resolved; identifiers isolated by project.`,
      },
      {
        name: "elaborate",
        detail: `${machines.length} timed gesture machines with explicit output ownership.`,
      },
      {
        name: "analyze interactions",
        detail:
          "Continuation priority and projected layer effects across the whole program.",
      },
      {
        name: "simplify",
        detail: `Terminal waiting states and unused hold states omitted; ${removedLayers} unreachable layers removed.`,
      },
      {
        name: "lower",
        detail:
          "Native mappings, phase-guarded timers, lazy modifier ownership, and layer expressions.",
      },
      {
        name: "optimize / emit",
        detail:
          options.optimize === false
            ? "Unoptimized, deterministic output."
            : "Unreachable timeout actions, transient writes, empty fields, and duplicate conditions removed; stable source maps.",
      },
    ],
  };
}
