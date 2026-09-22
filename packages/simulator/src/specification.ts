import { holdPolicy, MODIFIERS, validate } from "@kmk/compiler";
import type {
  Action,
  Binding,
  DeviceIdentifier,
  InputEvent,
  OutputEvent,
  Project,
  SimulationFrame,
  SimulationResult,
} from "@kmk/compiler";
import { validateTrace } from "./trace.ts";

/** Behavioral oracle. This intentionally does not use compiler phases or emitted variables. */
export function simulateProject(
  project: Project,
  events: InputEvent[],
  until?: number,
  device?: DeviceIdentifier,
): SimulationResult {
  validateTrace(events, until);
  const errors = validate(project).filter((d) => d.severity === "error");
  if (errors.length) throw new Error(errors.map((d) => d.message).join("\n"));
  const output: OutputEvent[] = [],
    frames: SimulationFrame[] = [];
  const toggles = new Set<string>(),
    owners = new Map<string, Set<string>>(),
    pressed = new Set<string>();
  const modifiers = new Map<string, number>();
  const releases = new Map<string, (() => void)[]>();
  const filter = project.deviceFilter;
  const deviceMatches =
    !filter ||
    (filter.type === "built_in_keyboard"
      ? device?.is_built_in_keyboard === true
      : device?.vendor_id === filter.vendorId &&
        device?.product_id === filter.productId);
  let now = 0,
    enabled = deviceMatches;
  type Gesture = {
    b: Binding;
    stage: number;
    downAt: number;
    released: boolean;
    expired: boolean;
    mods: string[];
  };
  let pending: Gesture | undefined;
  let oneShot: { layer: string; expiresAt?: number } | undefined;
  const isMod = (k: string) => (MODIFIERS as readonly string[]).includes(k);
  const mods = () =>
    [...modifiers.entries()]
      .filter(([, n]) => n > 0)
      .map(([k]) => k)
      .sort();
  const active = (id: string) =>
    id === project.layers[0].id ||
    toggles.has(id) ||
    oneShot?.layer === id ||
    (owners.get(id)?.size ?? 0) > 0;
  const frame = (event: string) =>
    frames.push({
      at: now,
      event,
      activeLayers: project.layers.filter((l) => active(l.id)).map((l) => l.id),
      pending: [
        ...(pending
          ? [
              `${pending.b.key}: ${pending.stage + 1} ${pending.released ? "waiting" : "pressed"}`,
            ]
          : []),
        ...(oneShot
          ? [
              `Next key: ${oneShot.layer} (${oneShot.expiresAt === undefined ? "no expiry" : `until ${oneShot.expiresAt} ms`})`,
            ]
          : []),
      ],
    });
  const send = (key: string, type: "down" | "up", extra: string[] = []) => {
    if (isMod(key))
      modifiers.set(
        key,
        (modifiers.get(key) ?? 0) + (type === "down" ? 1 : -1),
      );
    output.push({
      at: now,
      type,
      key,
      ...(!isMod(key) && extra.length
        ? { modifiers: [...new Set(extra)].sort() }
        : {}),
    });
  };
  const emit = (
    a: Action,
    owner: string,
    held: boolean,
    originalMods: string[] = mods(),
  ) => {
    if (a.type === "key" || a.type === "consumer") {
      const extra =
        a.type === "key"
          ? [...originalMods, ...(a.modifiers ?? [])]
          : originalMods;
      send(a.key, "down", extra);
      if (held) {
        const list = releases.get(owner) ?? [];
        list.push(() => send(a.key, "up", extra));
        releases.set(owner, list);
      } else send(a.key, "up", extra);
    } else if (a.type === "sequence")
      for (const x of a.actions) emit(x, owner, false, originalMods);
    else if (a.type === "layer") {
      if (a.mode === "toggle") {
        if (toggles.has(a.layer)) toggles.delete(a.layer);
        else toggles.add(a.layer);
      }
      if (a.mode === "oneshot")
        oneShot = {
          layer: a.layer,
          ...(a.timeoutMs === undefined
            ? {}
            : { expiresAt: now + a.timeoutMs }),
        };
      if (a.mode === "set") {
        oneShot = undefined;
        toggles.clear();
        owners.clear();
        toggles.add(a.layer);
      }
      if (a.mode === "momentary") {
        const set = owners.get(a.layer) ?? new Set();
        set.add(owner);
        owners.set(a.layer, set);
        const list = releases.get(owner) ?? [];
        list.push(() => set.delete(owner));
        releases.set(owner, list);
      }
    }
  };
  const finish = (hold: boolean, onRelease = false) => {
    if (!pending || pending.b.behavior.type !== "dance") return;
    const g = pending;
    const step = pending.b.behavior.steps[g.stage];
    pending = undefined;
    emit(
      hold && step.hold ? step.hold : step.tap,
      g.b.key,
      hold && !!step.hold,
      hold || onRelease ? mods() : g.mods,
    );
    frame(hold ? "hold resolved" : "tap resolved");
  };
  const advance = (at: number) => {
    if (!Number.isFinite(at) || at < now)
      throw new Error("Trace timestamps must be finite and nondecreasing.");
    for (;;) {
      let hold = Infinity,
        end = Infinity;
      if (pending?.b.behavior.type === "dance") {
        const g = pending,
          b = pending.b.behavior;
        const timing = { ...project.timing, ...b.timing };
        if (!g.released && b.steps[g.stage].hold)
          hold = g.downAt + timing.holdMs;
        if (g.stage < b.steps.length - 1) end = g.downAt + timing.tapWindowMs;
      }
      const expiry = oneShot?.expiresAt ?? Infinity;
      const deadline = Math.min(hold, end, expiry);
      if (deadline > at) break;
      now = deadline;
      if (expiry <= hold && expiry <= end) {
        oneShot = undefined;
        frame("one-shot expired");
      } else finish(hold <= end);
    }
    now = at;
  };
  for (const e of events) {
    advance(e.at);
    if (e.type === "invalidate") {
      enabled = false;
      if (pending?.released) pending = undefined;
      frame("invalidate");
      continue;
    }
    if (e.type === "reset") {
      pending = undefined;
      oneShot = undefined;
      for (const list of releases.values())
        for (const release of list) release();
      releases.clear();
      toggles.clear();
      owners.clear();
      pressed.clear();
      modifiers.clear();
      enabled = deviceMatches;
      frame("reset");
      continue;
    }
    if (!e.key) throw new Error("Key events need a key.");
    const k = e.key;
    if (e.type === "down") {
      if (pressed.has(k)) continue; // OS repeat is not an additional physical tap.
      pressed.add(k);
      if (pending) {
        const g = pending,
          b = g.b.behavior;
        if (
          enabled &&
          k === g.b.key &&
          g.released &&
          !g.expired &&
          b.type === "dance" &&
          g.stage + 1 < b.steps.length
        ) {
          g.stage++;
          g.downAt = now;
          g.released = false;
          g.expired = false;
          g.mods = mods();
          frame(`down ${k}`);
          continue;
        }
        finish(
          !g.released &&
            b.type === "dance" &&
            holdPolicy(b) === "hold" &&
            !!b.steps[g.stage].hold,
        );
      }
      if (enabled && oneShot && k === "escape") {
        oneShot = undefined;
        frame("one-shot canceled");
        continue;
      }
      let binding: Binding | undefined;
      for (const l of [...project.layers].reverse()) {
        if (!enabled) break;
        if (!active(l.id)) continue;
        const b = l.bindings.find((b) => b.key === k);
        if (
          b &&
          !(
            b.behavior.type === "map" &&
            b.behavior.action.type === "transparent"
          )
        ) {
          binding = b;
          break;
        }
      }
      if (enabled && !isMod(k)) oneShot = undefined;
      if (binding?.behavior.type === "dance")
        pending = {
          b: binding,
          stage: 0,
          downAt: now,
          released: false,
          expired: false,
          mods: mods(),
        };
      else
        emit(
          binding?.behavior.type === "map"
            ? binding.behavior.action
            : { type: "key", key: k },
          k,
          true,
        );
    } else {
      if (!pressed.has(k)) continue;
      pressed.delete(k);
      for (const release of releases.get(k) ?? []) release();
      releases.delete(k);
      if (pending?.b.key === k && pending.b.behavior.type === "dance") {
        pending.released = true;
        if (
          pending.expired ||
          pending.stage === pending.b.behavior.steps.length - 1
        )
          finish(false, true);
        if (!enabled) pending = undefined;
      }
    }
    frame(`${e.type} ${k}`);
  }
  advance(
    until ??
      now + Math.max(project.timing.holdMs, project.timing.tapWindowMs, 5000),
  );
  frame("settled");
  return {
    output,
    frames,
    variables: Object.fromEntries(
      project.layers.map((l) => [l.id, Number(active(l.id))]),
    ),
  };
}
