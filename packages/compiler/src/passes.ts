import { holdPolicy } from "./model.ts";
import type { Action, Machine, Project } from "./types.ts";

/** Resolve defaults without changing the caller's serializable project. */
export function normalize(input: Project): Project {
  const p = structuredClone(input);
  const action = (a: Action): Action =>
    a.type === "key"
      ? {
          ...a,
          ...(a.modifiers
            ? { modifiers: [...new Set(a.modifiers)].sort() }
            : {}),
        }
      : a.type === "sequence"
        ? { ...a, actions: a.actions.map(action) }
        : a;
  for (const l of p.layers)
    for (const b of l.bindings) {
      const behavior = b.behavior;
      b.behavior =
        behavior.type === "map"
          ? { type: "map", action: action(behavior.action) }
          : {
              ...behavior,
              timing: { ...p.timing, ...behavior.timing },
              interruption: holdPolicy(behavior),
              steps: behavior.steps.map((s) => ({
                tap: action(s.tap),
                ...(s.hold ? { hold: action(s.hold) } : {}),
              })),
            };
    }
  return p;
}

export function elaborate(project: Project): Machine[] {
  return project.layers.flatMap((l) =>
    l.bindings
      .filter((b) => b.behavior.type === "dance")
      .map((b) => {
        if (b.behavior.type !== "dance") throw new Error("unreachable");
        const behavior = b.behavior;
        const stages = behavior.steps.map((step, i) => ({
          ...step,
          index: i + 1,
          terminal: i === behavior.steps.length - 1,
          timing: { ...project.timing, ...behavior.timing },
          interruption: holdPolicy(behavior),
        }));
        const states: Machine["states"] = [
          {
            id: "idle",
            transitions: [
              { event: "down", to: "down-1", effect: "start gesture" },
            ],
          },
        ];
        b.behavior.steps.forEach((s, i) => {
          const n = i + 1;
          const terminal =
            n === (b.behavior.type === "dance" ? b.behavior.steps.length : 0);
          states.push({
            id: `down-${n}`,
            transitions: [
              {
                event: "up",
                to: terminal ? "idle" : `wait-${n}`,
                effect: terminal ? "emit tap" : "await continuation",
              },
              ...(!terminal
                ? [
                    {
                      event: "timeout" as const,
                      to: "resolved",
                      effect: "commit tap when continuation becomes impossible",
                    },
                  ]
                : []),
              {
                event: "interrupt",
                to: "resolved",
                effect: "resolve interruption",
              },
              ...(s.hold
                ? [
                    {
                      event: "hold" as const,
                      to: `held-${n}`,
                      effect: "activate hold",
                    },
                  ]
                : []),
            ],
          });
          states.push({
            id: `wait-${n}`,
            transitions: [
              {
                event: "down",
                to: terminal ? "idle" : `down-${n + 1}`,
                effect: "continue",
              },
              { event: "timeout", to: "idle", effect: "emit tap" },
              { event: "interrupt", to: "idle", effect: "emit tap" },
            ],
          });
          states.push({
            id: `held-${n}`,
            transitions: [
              { event: "up", to: "idle", effect: "release owned output" },
            ],
          });
        });
        states.push({
          id: "resolved",
          transitions: [{ event: "up", to: "idle", effect: "cleanup" }],
        });
        return { bindingId: b.id, layerId: l.id, states, stages };
      }),
  );
}

/** Remove unreachable states, then bisimilar states with equal observable actions,
 * deadlines, and owner identity. Lowering may retain distinct callback phases. */
export function simplifyMachines(machines: Machine[]): Machine[] {
  return machines.map((m) => {
    const reachable = new Set<string>();
    const queue = ["idle"];
    while (queue.length) {
      const id = queue.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const t of m.states.find((s) => s.id === id)?.transitions ?? [])
        queue.push(t.to);
    }
    const states = m.states.filter((s) => reachable.has(s.id));
    const observation = (id: string) => {
      const [kind, index] = id.split("-");
      const stage = m.stages[Number(index) - 1];
      return JSON.stringify([
        kind,
        m.bindingId,
        kind === "held" ? stage?.hold : stage,
      ]);
    };
    let classes = new Map(states.map((s) => [s.id, observation(s.id)]));
    for (let iteration = 0; iteration < states.length; iteration++) {
      const signatures = states.map((s) =>
        JSON.stringify([
          observation(s.id),
          s.transitions.map((t) => [t.event, t.effect, classes.get(t.to)]),
        ]),
      );
      const labels = [...new Set(signatures)];
      const next = new Map(
        states.map((s, i) => [s.id, String(labels.indexOf(signatures[i]))]),
      );
      if (states.every((s) => next.get(s.id) === classes.get(s.id))) break;
      classes = next;
    }
    const representative = new Map<string, string>();
    for (const s of states)
      if (!representative.has(classes.get(s.id)!))
        representative.set(classes.get(s.id)!, s.id);
    const target = (id: string) => representative.get(classes.get(id)!)!;
    return {
      ...m,
      states: states
        .filter((s) => target(s.id) === s.id)
        .map((s) => ({
          ...s,
          transitions: s.transitions.map((t) => ({ ...t, to: target(t.to) })),
        })),
    };
  });
}
