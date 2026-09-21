export const TARGET_VERSION = "16.3.0";
export type LayoutId = "mac" | "ansi" | "tkl" | "sixty";
export type Modifier =
  | "left_shift"
  | "right_shift"
  | "left_control"
  | "right_control"
  | "left_option"
  | "right_option"
  | "left_command"
  | "right_command"
  | "fn";
export type Action =
  | { type: "key"; key: string; modifiers?: Modifier[] }
  | { type: "consumer"; key: string }
  | { type: "sequence"; actions: Action[] }
  | {
      type: "layer";
      layer: string;
      mode: "momentary" | "toggle" | "set" | "oneshot";
      timeoutMs?: number;
    }
  | { type: "block" }
  | { type: "transparent" };
export interface Timing {
  tapWindowMs: number;
  holdMs: number;
}
export interface DanceStep {
  tap: Action;
  hold?: Action;
}
export type Behavior =
  | { type: "map"; action: Action }
  | {
      type: "dance";
      steps: DanceStep[];
      interruption?: "hold" | "tap";
      timing?: Partial<Timing>;
    };
export interface Binding {
  id: string;
  key: string;
  behavior: Behavior;
}
export interface Layer {
  id: string;
  name: string;
  bindings: Binding[];
}
export interface Project {
  version: 1;
  id: string;
  name: string;
  layout: LayoutId;
  timing: Timing;
  layers: Layer[];
}
export interface Diagnostic {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
}
export interface Condition {
  type: "variable_if" | "variable_unless" | "expression_if";
  name?: string;
  value?: number;
  expression?: string;
}
export interface ToEvent {
  key_code?: string;
  consumer_key_code?: string;
  from_event?: boolean;
  modifiers?: Modifier[];
  lazy?: boolean;
  repeat?: boolean;
  halt?: boolean;
  set_variable?: {
    name: string;
    value?: number;
    expression?: string;
    key_up_value?: number;
  };
  conditions?: Condition[];
}
export interface Manipulator {
  type: "basic";
  description?: string;
  from: {
    key_code?: string;
    any?: "key_code";
    modifiers: { optional: ["any"] };
  };
  conditions?: Condition[];
  parameters?: Record<string, number>;
  to?: ToEvent[];
  to_after_key_up?: ToEvent[];
  to_if_alone?: ToEvent[];
  to_if_held_down?: ToEvent[];
  to_if_other_key_pressed?: {
    other_keys: { any: "key_code"; modifiers: { optional: ["any"] } }[];
    to: ToEvent[];
  }[];
  to_delayed_action?: { to_if_invoked: ToEvent[]; to_if_canceled: ToEvent[] };
}
export interface Asset {
  title: string;
  rules: { description: string; manipulators: Manipulator[] }[];
}
export interface SourceMapping {
  manipulator: number;
  bindingId: string;
  layerId: string;
  phase: string;
}
export interface Statistics {
  manipulators: number;
  timers: number;
  conditions: number;
  variables: number;
  bytes: number;
  states: number;
}
export interface Transition {
  event: "down" | "up" | "timeout" | "hold" | "interrupt";
  to: string;
  effect: string;
}
export interface State {
  id: string;
  transitions: Transition[];
}
export interface GestureStage extends DanceStep {
  index: number;
  terminal: boolean;
  timing: Timing;
  interruption: "hold" | "tap";
}
export interface Machine {
  stages: GestureStage[];
  bindingId: string;
  layerId: string;
  states: State[];
}
export interface CompileResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  asset?: Asset;
  sourceMap: SourceMapping[];
  statistics: Statistics;
  machines: Machine[];
  passes: { name: string; detail: string }[];
}
export interface CompileOptions {
  optimize?: boolean;
}
export interface InputEvent {
  at: number;
  type: "down" | "up" | "reset" | "invalidate";
  key?: string;
}
export interface OutputEvent {
  at: number;
  type: "down" | "up";
  key: string;
  modifiers?: string[];
}
export interface SimulationFrame {
  at: number;
  event: string;
  activeLayers: string[];
  pending: string[];
  variables?: Record<string, number>;
}
export interface SimulationResult {
  output: OutputEvent[];
  frames: SimulationFrame[];
  variables: Record<string, number>;
}
