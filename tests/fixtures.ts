import {
  createProject,
  dance,
  key,
  layer,
  type Project,
  type InputEvent,
} from "@kmk/compiler";
export function trace(...items: (string | number)[]): InputEvent[] {
  let at = 10;
  return items.flatMap((item) => {
    if (typeof item === "number") {
      at = item;
      return [];
    }
    return [
      {
        at: at++,
        type: item[0] === "-" ? ("up" as const) : ("down" as const),
        key: item.replace(/^[-+]/, ""),
      },
    ];
  });
}
export function fixtureProject(): Project {
  const p = createProject();
  p.id = "conformance";
  p.name = "Conformance";
  p.layers[0].bindings = [
    {
      id: "a",
      key: "a",
      behavior: dance([
        { tap: key("a") },
        { tap: key("b") },
        { tap: key("c") },
      ]),
    },
    {
      id: "s",
      key: "s",
      behavior: dance([
        { tap: key("s"), hold: key("left_control") },
        { tap: key("escape"), hold: key("left_shift") },
        { tap: key("tab"), hold: key("left_option") },
      ]),
    },
    {
      id: "d",
      key: "d",
      behavior: dance([{ tap: key("d") }, { tap: key("e") }]),
    },
    {
      id: "caps",
      key: "caps_lock",
      behavior: dance([{ tap: key("escape"), hold: layer("nav") }]),
    },
    { id: "tab", key: "tab", behavior: { type: "map", action: layer("nav") } },
    {
      id: "toggle",
      key: "f1",
      behavior: { type: "map", action: layer("nav", "toggle") },
    },
    {
      id: "seq",
      key: "f2",
      behavior: {
        type: "map",
        action: { type: "sequence", actions: [key("x"), key("y")] },
      },
    },
    {
      id: "hold-key",
      key: "f3",
      behavior: dance([{ tap: key("escape"), hold: key("z") }], {
        interruption: "tap",
      }),
    },
    {
      id: "select-base",
      key: "f4",
      behavior: { type: "map", action: layer("base", "set") },
    },
    {
      id: "media",
      key: "f5",
      behavior: {
        type: "map",
        action: { type: "consumer", key: "play_or_pause" },
      },
    },
    {
      id: "shortcut",
      key: "f6",
      behavior: { type: "map", action: key("c", ["left_command"]) },
    },
    {
      id: "hold-shortcut",
      key: "f7",
      behavior: dance(
        [{ tap: key("escape"), hold: key("z", ["left_command"]) }],
        { interruption: "tap" },
      ),
    },
    {
      id: "tap-layer",
      key: "f8",
      behavior: dance([
        { tap: layer("nav", "toggle") },
        { tap: layer("base", "set") },
      ]),
    },
    {
      id: "upper-layer",
      key: "f11",
      behavior: { type: "map", action: layer("upper") },
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
      { id: "nav-a", key: "a", behavior: { type: "map", action: key("home") } },
      {
        id: "nav-s",
        key: "s",
        behavior: dance([{ tap: key("page_up") }, { tap: key("page_down") }]),
      },
      {
        id: "nav-block",
        key: "j",
        behavior: { type: "map", action: { type: "block" } },
      },
      {
        id: "nav-transparent",
        key: "d",
        behavior: { type: "map", action: { type: "transparent" } },
      },
    ],
  });
  p.layers.push({
    id: "upper",
    name: "Upper",
    bindings: [
      {
        id: "upper-h",
        key: "h",
        behavior: { type: "map", action: key("right_arrow") },
      },
      {
        id: "upper-j",
        key: "j",
        behavior: { type: "map", action: { type: "transparent" } },
      },
    ],
  });
  return p;
}
export const scenarios: Record<string, InputEvent[]> = {
  single: trace("a", "-a"),
  double: trace("a", "-a", 80, "a", "-a"),
  triple: trace("a", "-a", 80, "a", "-a", 150, "a", "-a"),
  interrupted: trace("a", "-a", 80, "x", "-x"),
  roll: trace("a", 80, "x", "-a", "-x"),
  "reverse-roll": trace("d", 80, "a", "-d", "-a"),
  "late-roll": trace("a", 350, "x", "-a", "-x"),
  "late-reverse-roll": trace("d", 350, "a", "-d", "-a"),
  "two-dances": trace("a", "-a", 80, "d", "-d"),
  "two-dances-reverse": trace("d", "-d", 80, "a", "-a"),
  "hold-alone": trace("s", 350, "-s"),
  "hold-other": trace("s", 80, "x", "-x", "-s"),
  "hold-layer": trace("caps_lock", 80, "h", "-h", "-caps_lock"),
  "hold-layer-timer": trace("caps_lock", 350, "h", "-h", "-caps_lock"),
  "hold-second": trace("s", "-s", 80, "s", 350, "x", "-x", "-s"),
  "hold-third": trace("s", "-s", 80, "s", "-s", 150, "s", 400, "x", "-x", "-s"),
  "hold-key": trace("f3", 350, "x", "-x", "-f3"),
  "tap-hold-roll": trace("f3", 80, "x", "-f3", "-x"),
  "layer-overlap": trace(
    "tab",
    "caps_lock",
    350,
    "h",
    "-h",
    "-tab",
    400,
    "h",
    "-h",
    "-caps_lock",
    450,
    "h",
    "-h",
  ),
  "layer-toggle": trace("f1", "-f1", "h", "-h", "f1", "-f1", "h", "-h"),
  "frozen-binding": trace("tab", "s", "-s", "-tab", 80, "s", "-s"),
  "modified-tap": trace("left_shift", "a", "-a", "-left_shift"),
  "modified-interrupt": trace(
    "left_shift",
    "a",
    "-a",
    "-left_shift",
    80,
    "x",
    "-x",
  ),
  "modified-roll": trace("left_shift", "a", "-left_shift", 80, "x", "-a", "-x"),
  sequence: trace("f2", "-f2"),
  blocked: trace("tab", "j", "-j", "-tab"),
  transparent: trace("tab", "d", "-d", "-tab"),
  "terminal-modifier-release": trace(
    "left_shift",
    "caps_lock",
    "-left_shift",
    80,
    "-caps_lock",
  ),
  "invalidate-layer": [
    { at: 10, type: "down", key: "caps_lock" },
    { at: 300, type: "invalidate" },
    ...trace(350, "-caps_lock", 400, "h", "-h"),
  ],
  "invalidate-modifier": [
    { at: 10, type: "down", key: "s" },
    { at: 300, type: "invalidate" },
    ...trace(350, "-s", 400, "x", "-x"),
  ],
  "exclusive-layer": trace(
    "tab",
    "caps_lock",
    300,
    "f4",
    "-f4",
    "h",
    "-h",
    "-tab",
    "-caps_lock",
  ),
  "tap-layer-interrupt": trace("f8", "-f8", 80, "h", "-h"),
  "tap-layer-double": trace(
    "tab",
    "f8",
    "-f8",
    80,
    "f8",
    "-f8",
    "h",
    "-h",
    "-tab",
  ),
  "layer-priority": trace(
    "tab",
    "f11",
    "h",
    "-h",
    "j",
    "-j",
    "-f11",
    "h",
    "-h",
    "-tab",
  ),
  consumer: trace("f5", "-f5"),
  "held-shortcut": trace("f6", 80, "x", "-x", "-f6"),
  "held-gesture-shortcut": trace("f7", 350, "x", "-x", "-f7"),
};
for (const t of [199, 200, 201, 249, 250, 251]) {
  scenarios[`tap-boundary-${t}`] = trace("a", "-a", 10 + t, "a", "-a");
  scenarios[`hold-boundary-${t}`] = trace("s", 10 + t, "-s");
}
