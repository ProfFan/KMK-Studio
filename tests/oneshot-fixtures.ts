import {
  createProject,
  dance,
  key,
  layer,
  oneShot,
  type Project,
  type InputEvent,
} from "@kmk/compiler";
import { trace } from "./fixtures.ts";
import { generatedTraces } from "./generated.ts";

export function oneShotProject(timeoutMs?: number, reverse = false): Project {
  const p = createProject();
  p.id = "oneshot";
  p.layers[0].bindings = [
    {
      id: "leader",
      key: "left_command",
      behavior: dance([
        { tap: { type: "block" }, hold: key("left_command") },
        { tap: oneShot("nav", timeoutMs), hold: key("left_command") },
      ]),
    },
    {
      id: "arm",
      key: "f1",
      behavior: { type: "map", action: oneShot("nav", timeoutMs) },
    },
    {
      id: "pending-arm",
      key: "f2",
      behavior: dance([{ tap: oneShot("nav", timeoutMs) }, { tap: key("z") }]),
    },
    {
      id: "hold-arm",
      key: "f3",
      behavior: dance([{ tap: key("z"), hold: oneShot("nav", timeoutMs) }]),
    },
    {
      id: "other-arm",
      key: "f4",
      behavior: { type: "map", action: oneShot("other", timeoutMs) },
    },
    {
      id: "momentary",
      key: "tab",
      behavior: { type: "map", action: layer("nav") },
    },
    {
      id: "toggle",
      key: "f5",
      behavior: { type: "map", action: layer("nav", "toggle") },
    },
    {
      id: "set",
      key: "f6",
      behavior: { type: "map", action: layer("base", "set") },
    },
    {
      id: "mapped-fallthrough",
      key: "x",
      behavior: { type: "map", action: key("q") },
    },
    {
      id: "dance-fallthrough",
      key: "a",
      behavior: dance([{ tap: key("b") }, { tap: key("c") }]),
    },
    {
      id: "sequence-arm",
      key: "f7",
      behavior: dance([
        {
          tap: {
            type: "sequence",
            actions: [key("v"), oneShot("other"), oneShot("nav", timeoutMs)],
          },
        },
        { tap: key("z") },
      ]),
    },
    {
      id: "modifier-target",
      key: "right_command",
      behavior: dance([{ tap: { type: "block" }, hold: key("right_command") }]),
    },
  ];
  p.layers.push({
    id: "nav",
    name: "Navigation",
    bindings: [
      {
        id: "nav-h",
        key: "h",
        behavior: { type: "map", action: key("left_arrow") },
      },
      {
        id: "nav-s",
        key: "s",
        behavior: dance([
          { tap: key("page_up"), hold: key("left_control") },
          { tap: key("page_down") },
        ]),
      },
      {
        id: "nav-j",
        key: "j",
        behavior: { type: "map", action: { type: "block" } },
      },
      {
        id: "nav-x",
        key: "x",
        behavior: { type: "map", action: { type: "transparent" } },
      },
      {
        id: "chain",
        key: "k",
        behavior: { type: "map", action: oneShot("other", timeoutMs) },
      },
    ],
  });
  p.layers.push({
    id: "other",
    name: "Other",
    bindings: [
      {
        id: "other-h",
        key: "h",
        behavior: { type: "map", action: key("right_arrow") },
      },
    ],
  });
  if (reverse) p.layers.forEach((l) => l.bindings.reverse());
  return p;
}
const leader = trace(
  "left_command",
  "-left_command",
  80,
  "left_command",
  "-left_command",
);
export const oneShotScenarios: Record<
  string,
  { events: InputEvent[]; keys?: string[] }
> = {
  "double command leader": {
    events: [...leader, ...trace(100, "h", "-h", "h", "-h")],
    keys: ["left_arrow", "h"],
  },
  "ordinary command shortcut": {
    events: trace("left_command", 80, "h", "-h", "-left_command"),
    keys: ["h"],
  },
  "held output after expiry": {
    events: trace("f1", "-f1", "h", 1000, "-h", "h", "-h"),
    keys: ["left_arrow", "h"],
  },
  "modifiers preserve activation": {
    events: trace("f1", "-f1", "left_shift", "-left_shift", "h", "-h"),
    keys: ["left_arrow"],
  },
  "unknown key consumes": {
    events: trace("f1", "-f1", "international1", "-international1", "h", "-h"),
    keys: ["international1", "h"],
  },
  "mapped transparent fallthrough": {
    events: trace("f1", "-f1", "x", "-x", "h", "-h"),
    keys: ["q", "h"],
  },
  "blocked consumes": {
    events: trace("f1", "-f1", "j", "-j", "h", "-h"),
    keys: ["h"],
  },
  "escape cancels": {
    events: trace(
      "f1",
      "-f1",
      "escape",
      "-escape",
      "h",
      "-h",
      "escape",
      "-escape",
    ),
    keys: ["h", "escape"],
  },
  "activation replaced": {
    events: trace("f1", "-f1", "f4", "-f4", "h", "-h", "h", "-h"),
    keys: ["right_arrow", "h"],
  },
  "activation chained": {
    events: trace("f1", "-f1", "k", "-k", "h", "-h", "h", "-h"),
    keys: ["right_arrow", "h"],
  },
  "target dance retained": {
    events: trace("f1", "-f1", "s", "-s", 80, "s", "-s", "h", "-h"),
    keys: ["page_down", "h"],
  },
  "target hold retained": {
    events: trace("f1", "-f1", "s", 1000, "h", "-h", "-s"),
    keys: ["h"],
  },
  "momentary ownership retained": {
    events: trace("tab", "f1", "-f1", "h", "-h", "h", "-h", "-tab", "h", "-h"),
    keys: ["left_arrow", "left_arrow", "h"],
  },
  "persistent activation retained": {
    events: trace(
      "f5",
      "-f5",
      "f1",
      "-f1",
      "h",
      "-h",
      "h",
      "-h",
      "f5",
      "-f5",
      "h",
      "-h",
    ),
    keys: ["left_arrow", "left_arrow", "h"],
  },
  "select clears activation": {
    events: trace("f1", "-f1", "f6", "-f6", "h", "-h"),
    keys: ["h"],
  },
  "hold timeout arms": {
    events: trace("f3", 230, "-f3", "h", "-h", "h", "-h"),
    keys: ["left_arrow", "h"],
  },
  "prefix timeout arms": {
    events: trace("f2", "-f2", 270, "h", "-h", "h", "-h"),
    keys: ["left_arrow", "h"],
  },
};
for (const origin of ["f2", "f3", "f7"])
  for (const target of ["s", "a", "h", "escape", "right_command", "left_shift"])
    for (const released of origin === "f3" ? [false] : [true, false])
      oneShotScenarios[
        `interrupt ${origin} ${released ? "released" : "down"} with ${target}`
      ] = {
        events: trace(
          origin,
          ...(released ? [`-${origin}`] : []),
          80,
          target,
          `-${target}`,
          ...(!released ? [`-${origin}`] : []),
          100,
          "h",
          "-h",
          "h",
          "-h",
        ),
      };
for (const at of [309, 310, 311, 10000])
  oneShotScenarios[`expiry ${at}`] = {
    events: trace("f1", "-f1", at, "h", "-h", "h", "-h"),
  };
for (const at of [559, 560, 561])
  oneShotScenarios[`timeout activation expiry ${at}`] = {
    events: trace("f2", "-f2", at, "h", "-h"),
  };

// Exercise overlapping arming, consumption, modifiers, and layer ownership.
export const generatedOneShotTraces = generatedTraces(100).map((t) => ({
  name: `one-shot ${t.name}`,
  events: t.events.map((e) => ({
    ...e,
    key: (
      {
        a: "f2",
        s: "s",
        d: "f3",
        x: "f1",
        h: "h",
        caps_lock: "f7",
        tab: "tab",
        left_shift: "left_shift",
      } as Record<string, string>
    )[e.key!],
  })),
}));

for (const at of [380, 381, 382])
  oneShotScenarios[`terminal release expiry ${at}`] = {
    events: [...leader, ...trace(at, "h", "-h")],
  };
for (const at of [509, 510, 511])
  oneShotScenarios[`hold activation expiry ${at}`] = {
    events: trace("f3", 230, "-f3", at, "h", "-h"),
  };
