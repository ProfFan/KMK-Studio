import type { Action, Behavior, Project, Timing } from "./types.ts";
export const DEFAULT_TIMING: Timing = { tapWindowMs: 250, holdMs: 200 };
export const MODIFIERS = [
  "left_shift",
  "right_shift",
  "left_control",
  "right_control",
  "left_option",
  "right_option",
  "left_command",
  "right_command",
  "fn",
] as const;
export const KEY_CODES = [
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."1234567890".split(""),
  ...Array.from({ length: 24 }, (_, i) => `f${i + 1}`),
  ...MODIFIERS,
  "escape",
  "tab",
  "caps_lock",
  "spacebar",
  "return_or_enter",
  "delete_or_backspace",
  "hyphen",
  "equal_sign",
  "open_bracket",
  "close_bracket",
  "backslash",
  "semicolon",
  "quote",
  "grave_accent_and_tilde",
  "comma",
  "period",
  "slash",
  "left_arrow",
  "right_arrow",
  "up_arrow",
  "down_arrow",
  "home",
  "end",
  "page_up",
  "page_down",
  "delete_forward",
  "insert",
  "print_screen",
  "scroll_lock",
  "pause",
  "keypad_num_lock",
  "keypad_slash",
  "keypad_asterisk",
  "keypad_hyphen",
  "keypad_plus",
  "keypad_enter",
  "keypad_period",
  ...Array.from({ length: 10 }, (_, i) => `keypad_${i}`),
  "non_us_backslash",
  "international1",
  "international2",
  "international3",
  "lang1",
  "lang2",
  "application",
];
export const CONSUMER_KEYS = [
  "mute",
  "volume_increment",
  "volume_decrement",
  "play_or_pause",
  "fast_forward",
  "rewind",
  "display_brightness_increment",
  "display_brightness_decrement",
  "eject",
];
export const key = (
  key: string,
  modifiers?: import("./types.ts").Modifier[],
): Action => ({
  type: "key",
  key,
  ...(modifiers?.length ? { modifiers } : {}),
});
export const layer = (
  layer: string,
  mode: "momentary" | "toggle" | "set" | "oneshot" = "momentary",
): Action => ({ type: "layer", layer, mode });
export const oneShot = (layer: string, timeoutMs?: number): Action => ({
  type: "layer",
  layer,
  mode: "oneshot",
  ...(timeoutMs === undefined ? {} : { timeoutMs }),
});
export const dance = (
  steps: import("./types.ts").DanceStep[],
  options: Omit<Extract<Behavior, { type: "dance" }>, "type" | "steps"> = {},
): Behavior => ({ type: "dance", steps, ...options });
export const isModifier = (a?: Action): boolean =>
  a?.type === "key" && (MODIFIERS as readonly string[]).includes(a.key);
export const holdPolicy = (
  b: Extract<Behavior, { type: "dance" }>,
): "hold" | "tap" =>
  b.interruption ??
  (b.steps.some((s) => isModifier(s.hold) || s.hold?.type === "layer")
    ? "hold"
    : "tap");
export function createProject(): Project {
  return {
    version: 1,
    id: "my-keyboard",
    name: "Default Project",
    layout: "mac",
    timing: { ...DEFAULT_TIMING },
    layers: [{ id: "base", name: "Base", bindings: [] }],
  };
}
export function exampleProject(): Project {
  const p = createProject();
  p.id = "studio";
  p.layers.push({
    id: "nav",
    name: "Navigation",
    bindings: [
      ...(["h", "j", "k", "l"] as const).map((k, i) => ({
        id: `nav-${k}`,
        key: k,
        behavior: {
          type: "map" as const,
          action: key(
            ["left_arrow", "down_arrow", "up_arrow", "right_arrow"][i],
          ),
        },
      })),
      {
        id: "nav-u",
        key: "u",
        behavior: { type: "map", action: key("page_up") },
      },
      {
        id: "nav-o",
        key: "o",
        behavior: { type: "map", action: key("page_down") },
      },
    ],
  });
  p.layers[0].bindings = [
    {
      id: "caps-navigation",
      key: "caps_lock",
      behavior: dance([{ tap: key("escape"), hold: layer("nav") }]),
    },
    {
      id: "space-dance",
      key: "spacebar",
      behavior: dance([
        { tap: key("spacebar") },
        { tap: key("period") },
        { tap: key("return_or_enter") },
      ]),
    },
  ];
  return p;
}
export function actionLabel(a?: Action): string {
  if (!a) return "—";
  if (a.type === "key")
    return [
      ...(a.modifiers ?? []).map(
        (m) =>
          ({
            left_command: "⌘",
            right_command: "⌘",
            left_shift: "⇧",
            right_shift: "⇧",
            left_control: "⌃",
            right_control: "⌃",
            left_option: "⌥",
            right_option: "⌥",
            fn: "fn",
          })[m],
      ),
      keyLabel(a.key),
    ].join(" ");
  if (a.type === "layer")
    return `${a.mode === "momentary" ? "Hold" : a.mode === "toggle" ? "Toggle" : a.mode === "oneshot" ? "Next key ·" : "Set"} ${a.layer}`;
  if (a.type === "consumer") return a.key.replaceAll("_", " ");
  if (a.type === "sequence") return a.actions.map(actionLabel).join(" → ");
  return a.type === "block" ? "Disabled" : "Transparent";
}
export function keyLabel(k: string): string {
  return (
    (
      {
        escape: "esc",
        caps_lock: "caps",
        delete_or_backspace: "⌫",
        return_or_enter: "return",
        spacebar: "space",
        tab: "tab",
        left_shift: "⇧",
        right_shift: "⇧",
        left_command: "⌘",
        right_command: "⌘",
        left_option: "⌥",
        right_option: "⌥",
        left_control: "⌃",
        right_control: "⌃",
        grave_accent_and_tilde: "`",
        hyphen: "−",
        equal_sign: "=",
        open_bracket: "[",
        close_bracket: "]",
        backslash: "\\",
        semicolon: ";",
        quote: "'",
        comma: ",",
        period: ".",
        slash: "/",
        left_arrow: "←",
        right_arrow: "→",
        up_arrow: "↑",
        down_arrow: "↓",
        delete_forward: "del",
        page_up: "pgup",
        page_down: "pgdn",
      } as Record<string, string>
    )[k] ?? k.toUpperCase().replace("KEYPAD_", "")
  );
}
