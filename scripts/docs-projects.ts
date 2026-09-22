import {
  createProject,
  dance,
  key,
  layer,
  oneShot,
  type Project,
} from "@kmk/compiler";

const project = (id: string, name: string): Project => ({
  ...createProject(),
  id,
  name,
});
const navigation = () => ({
  id: "nav",
  name: "Navigation",
  bindings: ["h", "j", "k", "l"].map((input, i) => ({
    id: `nav-${input}`,
    key: input,
    behavior: {
      type: "map" as const,
      action: key(["left_arrow", "down_arrow", "up_arrow", "right_arrow"][i]),
    },
  })),
});
const shortcuts = project("docs-shortcuts", "A shortcut on one key");
shortcuts.layers[0].bindings.push({
  id: "command-palette",
  key: "f",
  behavior: { type: "map", action: key("p", ["left_command", "left_shift"]) },
});
const taps = project("docs-taps", "Three taps, three actions");
taps.layers[0].bindings.push({
  id: "space-dance",
  key: "spacebar",
  behavior: dance([
    { tap: key("spacebar") },
    { tap: key("period") },
    { tap: key("return_or_enter") },
  ]),
});
const holds = project("docs-holds", "Escape when tapped, Control when held");
holds.layers[0].bindings.push({
  id: "caps-control",
  key: "caps_lock",
  behavior: dance([{ tap: key("escape"), hold: key("left_control") }], {
    interruption: "hold",
  }),
});
const stages = project("docs-stages", "Holds at every stage");
stages.layers[0].bindings.push({
  id: "caps-stages",
  key: "caps_lock",
  behavior: dance(
    [
      { tap: key("escape"), hold: key("left_control") },
      { tap: key("tab"), hold: key("left_option") },
      { tap: key("return_or_enter"), hold: key("left_shift") },
    ],
    { interruption: "hold" },
  ),
});
const layers = project("docs-layers", "Navigation under your fingertips");
layers.layers.push(navigation());
layers.layers[0].bindings.push(
  {
    id: "caps-nav",
    key: "caps_lock",
    behavior: { type: "map", action: layer("nav") },
  },
  {
    id: "tab-toggle",
    key: "tab",
    behavior: { type: "map", action: layer("nav", "toggle") },
  },
);
layers.layers[1].bindings.push({
  id: "escape-base",
  key: "escape",
  behavior: { type: "map", action: layer("base", "set") },
});
const leader = project("docs-leader", "Double Command, then a direction");
leader.layers.push(navigation());
leader.layers[0].bindings.push({
  id: "command-leader",
  key: "left_command",
  behavior: dance(
    [
      { tap: { type: "block" }, hold: key("left_command") },
      { tap: oneShot("nav", 1000), hold: key("left_command") },
    ],
    { interruption: "hold" },
  ),
});
export const recipes = { shortcuts, taps, holds, stages, layers, leader };
