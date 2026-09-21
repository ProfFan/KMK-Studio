import { MODIFIERS } from "@kmk/compiler";
import type {
  Asset,
  Condition,
  InputEvent,
  Manipulator,
  OutputEvent,
  SimulationFrame,
  SimulationResult,
  ToEvent,
} from "@kmk/compiler";
import { evaluate } from "./expression.ts";
import { validateTrace } from "./trace.ts";
interface Context {
  key: string;
  mods: string[];
  downAt: number;
  owned: Held[];
  otherOwned: Held[];
  alive: boolean;
  otherFired: boolean;
  alone: boolean;
}
interface Held {
  key: string;
  modifiers: string[];
  lazy: boolean;
  emitted: boolean;
}
interface Runtime {
  m: Manipulator;
  keys: Map<string, Context>;
  delayed?: { due: number; ctx: Context };
  held?: { due: number; ctx: Context };
}

/** Interpreter of the supported KE JSON subset. Knows nothing about KMK gesture states. */
export function simulateKarabiner(
  asset: Asset,
  events: InputEvent[],
  until?: number,
): SimulationResult {
  validateTrace(events, until);
  const rules: Runtime[] = asset.rules
    .flatMap((r) => r.manipulators)
    .map((m) => ({ m, keys: new Map() }));
  const variables: Record<string, number> = {},
    output: OutputEvent[] = [],
    frames: SimulationFrame[] = [];
  const passthrough = new Map<string, Held>();
  const physical = new Set<string>();
  let now = 0,
    enabled = true;
  const isMod = (k: string) => (MODIFIERS as readonly string[]).includes(k);
  const mods = () =>
    [
      ...new Set(
        [
          ...rules.flatMap((r) =>
            [...r.keys.values()].flatMap((c) => [...c.owned, ...c.otherOwned]),
          ),
          ...passthrough.values(),
        ]
          .filter((h) => isMod(h.key))
          .map((h) => h.key),
      ),
    ].sort();
  const conditions = (
    cs: Condition[] | undefined,
    snapshot = variables,
  ): boolean =>
    (cs ?? []).every((c) =>
      c.type === "expression_if"
        ? !!evaluate(c.expression!, {
            ...snapshot,
            "system.now.milliseconds": now,
          })
        : c.type === "variable_if"
          ? (snapshot[c.name!] ?? 0) === c.value
          : (snapshot[c.name!] ?? 0) !== c.value,
    );
  const record = (h: Held, type: "down" | "up") => {
    output.push({
      at: now,
      type,
      key: h.key,
      ...(!isMod(h.key) && h.modifiers.length
        ? { modifiers: [...h.modifiers].sort() }
        : {}),
    });
    h.emitted = type === "down";
  };
  const wakeLazy = () => {
    for (const r of rules)
      for (const c of r.keys.values())
        for (const h of [...c.owned, ...c.otherOwned])
          if (h.lazy && !h.emitted) record(h, "down");
  };
  const release = (list: Held[]) => {
    for (const h of list) if (h.emitted) record(h, "up");
    list.length = 0;
  };
  const send = (
    list: ToEvent[] | undefined,
    c: Context,
    kind: "normal" | "extra" | "release" | "other",
    target: Held[] = c.owned,
  ) => {
    const snapshot = { ...variables };
    const selected = (list ?? []).filter((e) =>
      conditions(e.conditions, snapshot),
    );
    for (let i = 0; i < selected.length; i++) {
      const e = selected[i];
      if (e.set_variable) {
        const s = e.set_variable;
        variables[s.name] =
          s.expression === undefined
            ? (s.value ?? 0)
            : evaluate(s.expression, {
                ...variables,
                "system.now.milliseconds": now,
              });
        continue;
      }
      const key = e.from_event ? c.key : (e.key_code ?? e.consumer_key_code);
      if (!key || key === "vk_none") continue;
      const extra = kind === "extra" ? c.mods : mods();
      const h: Held = {
        key,
        modifiers: [...new Set([...extra, ...(e.modifiers ?? [])])].sort(),
        lazy: !!e.lazy && isMod(key),
        emitted: false,
      };
      if (!isMod(key)) wakeLazy();
      if (!h.lazy) record(h, "down");
      const held =
        kind !== "extra" &&
        kind !== "release" &&
        i === selected.length - 1 &&
        e.repeat !== false;
      if (held) target.push(h);
      else if (h.emitted) record(h, "up");
    }
  };
  const frame = (event: string) =>
    frames.push({
      at: now,
      event,
      activeLayers: [],
      pending: rules.flatMap((r) =>
        r.delayed ? [`${r.m.from.key_code}: timer @ ${r.delayed.due}`] : [],
      ),
      variables: { ...variables },
    });
  const advance = (at: number) => {
    if (!Number.isFinite(at) || at < now)
      throw new Error("Trace timestamps must be finite and nondecreasing.");
    for (;;) {
      const tasks = rules
        .flatMap((r) => [
          ...(r.held ? [{ r, type: "held" as const, ...r.held }] : []),
          ...(r.delayed ? [{ r, type: "delayed" as const, ...r.delayed }] : []),
        ])
        .filter((t) => t.due <= at)
        .sort((a, b) => a.due - b.due || (a.type === "held" ? -1 : 1));
      const task = tasks[0];
      if (!task) break;
      now = task.due;
      if (task.type === "held") {
        task.r.held = undefined;
        if (task.ctx.alive) {
          release(task.ctx.owned);
          send(task.r.m.to_if_held_down, task.ctx, "normal");
        }
      } else {
        task.r.delayed = undefined;
        send(task.r.m.to_delayed_action?.to_if_invoked, task.ctx, "extra");
      }
      frame(task.type);
    }
    now = at;
  };
  for (const e of events) {
    advance(e.at);
    if (e.type === "invalidate") {
      enabled = false;
      for (const r of rules)
        if (!r.keys.size) {
          r.delayed = undefined;
          r.held = undefined;
        }
      frame("invalidate");
      continue;
    }
    if (e.type === "reset") {
      for (const r of rules) {
        for (const c of r.keys.values()) {
          release(c.owned);
          release(c.otherOwned);
        }
        r.keys.clear();
        r.held = undefined;
        r.delayed = undefined;
      }
      for (const h of passthrough.values()) if (h.emitted) record(h, "up");
      passthrough.clear();
      physical.clear();
      for (const k of Object.keys(variables)) delete variables[k];
      enabled = true;
      frame("reset");
      continue;
    }
    if (!e.key) throw new Error("Key events need a key.");
    const k = e.key;
    if (e.type === "down" && physical.has(k)) continue;
    if (e.type === "up" && !physical.has(k)) continue;
    if (e.type === "down") physical.add(k);
    else physical.delete(k);
    let valid = true;
    for (const r of rules) {
      if (e.type === "down") {
        for (const c of r.keys.values()) c.alone = false;
        r.held = undefined;
        if (r.delayed) {
          const c = r.delayed.ctx;
          r.delayed = undefined;
          send(r.m.to_delayed_action?.to_if_canceled, c, "extra");
        }
      }
      if (!valid) continue;
      if (e.type === "down" && r.m.to_if_other_key_pressed) {
        for (const c of r.keys.values())
          if (!c.otherFired) {
            c.otherFired = true;
            release(c.owned);
            send(r.m.to_if_other_key_pressed[0].to, c, "other", c.otherOwned);
          }
      }
      if (
        enabled &&
        e.type === "down" &&
        (r.m.from.key_code === k || r.m.from.any === "key_code") &&
        conditions(r.m.conditions)
      ) {
        const c: Context = {
          key: k,
          mods: mods(),
          downAt: now,
          owned: [],
          otherOwned: [],
          alive: true,
          otherFired: false,
          alone: true,
        };
        r.keys.set(k, c);
        send(r.m.to, c, "normal");
        valid = false;
        if (r.m.to_delayed_action)
          r.delayed = {
            ctx: c,
            due:
              now +
              (r.m.parameters?.["basic.to_delayed_action_delay_milliseconds"] ??
                500),
          };
        if (r.m.to_if_held_down)
          r.held = {
            ctx: c,
            due:
              now +
              (r.m.parameters?.[
                "basic.to_if_held_down_threshold_milliseconds"
              ] ?? 500),
          };
      } else if (e.type === "up" && r.keys.has(k)) {
        const c = r.keys.get(k)!;
        release(c.owned);
        release(c.otherOwned);
        c.alive = false;
        r.keys.delete(k);
        if (
          c.alone &&
          now - c.downAt <
            (r.m.parameters?.["basic.to_if_alone_timeout_milliseconds"] ?? 1000)
        )
          send(r.m.to_if_alone, c, "extra");
        send(r.m.to_after_key_up, c, "release");
        valid = false;
        if (!enabled && !r.keys.size) {
          r.delayed = undefined;
          r.held = undefined;
        }
      }
    }
    if (valid) {
      if (e.type === "down") {
        wakeLazy();
        const h: Held = {
          key: k,
          modifiers: mods(),
          lazy: false,
          emitted: false,
        };
        record(h, "down");
        passthrough.set(k, h);
      } else {
        const h = passthrough.get(k);
        if (h) {
          record(h, "up");
          passthrough.delete(k);
        }
      }
    }
    frame(`${e.type} ${k}`);
  }
  advance(until ?? now + 5000);
  frame("settled");
  return { output, frames, variables };
}
