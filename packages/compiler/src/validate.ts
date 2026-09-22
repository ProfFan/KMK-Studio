import {
  CONSUMER_KEYS,
  KEY_CODES,
  MODIFIERS,
  holdPolicy,
  isModifier,
} from "./model.ts";
import type { Diagnostic, Project } from "./types.ts";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function validate(input: unknown): Diagnostic[] {
  const d: Diagnostic[] = [];
  const err = (code: string, path: string, message: string) =>
    d.push({ severity: "error", code, path, message });
  if (!object(input)) {
    err("PROJECT", "/", "Expected a project object.");
    return d;
  }
  if (input.version !== 1)
    err("VERSION", "/version", "This compiler accepts project version 1.");
  const id = (v: unknown, path: string) => {
    if (typeof v !== "string" || !v.length || v.length > 100)
      err("ID", path, "Use a nonempty ID of at most 100 characters.");
  };
  id(input.id, "/id");
  if (typeof input.name !== "string" || !input.name.trim())
    err("NAME", "/name", "Give the project a name.");
  if (!["mac", "ansi", "tkl", "sixty"].includes(String(input.layout)))
    err("LAYOUT", "/layout", "Choose mac, ansi, tkl, or sixty.");
  const timing = (v: unknown, path: string, partial = false) => {
    if (!object(v)) {
      err("TIMING", path, "Expected timing settings.");
      return;
    }
    for (const field of ["tapWindowMs", "holdMs"])
      if (!partial || field in v) {
        const n = v[field];
        if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 5000)
          err(
            "TIMING",
            `${path}/${field}`,
            "Timing must be an integer from 1 to 5000 ms.",
          );
      }
  };
  timing(input.timing, "/timing");
  if (input.deviceFilter !== undefined) {
    const filter = input.deviceFilter;
    if (
      !object(filter) ||
      !["vendor_product", "built_in_keyboard"].includes(String(filter.type))
    ) {
      err(
        "DEVICE_FILTER",
        "/deviceFilter",
        "Choose a VID/PID device or the built-in keyboard, or omit deviceFilter for all devices.",
      );
    } else {
      const allowed =
        filter.type === "vendor_product"
          ? ["type", "vendorId", "productId"]
          : ["type"];
      for (const field of Object.keys(filter))
        if (!allowed.includes(field))
          err(
            "DEVICE_FILTER",
            `/deviceFilter/${field}`,
            "This field is not supported by the selected device filter.",
          );
      if (filter.type === "vendor_product")
        for (const field of ["vendorId", "productId"])
          if (
            typeof filter[field] !== "number" ||
            !Number.isSafeInteger(filter[field]) ||
            filter[field] < 0
          )
            err(
              "DEVICE_ID",
              `/deviceFilter/${field}`,
              "Vendor ID and Product ID must both be nonnegative safe integers (decimal).",
            );
    }
  }
  if (!Array.isArray(input.layers) || !input.layers.length) {
    err("LAYERS", "/layers", "At least one base layer is required.");
    return d;
  }
  if (input.layers.length > 16)
    err("LIMIT", "/layers", "v1 supports up to 16 layers.");
  const layerIds = new Set(input.layers.filter(object).map((l) => l.id));
  const ids = new Set<string>();
  const bindingIds = new Set<string>();
  const action = (
    a: unknown,
    path: string,
    context: "map" | "tap" | "hold" | "sequence",
    depth = 0,
  ): void => {
    if (!object(a)) {
      err("ACTION", path, "Expected an action object.");
      return;
    }
    switch (a.type) {
      case "key":
        if (typeof a.key !== "string" || !KEY_CODES.includes(a.key))
          err("KEY", `${path}/key`, "Choose a supported Karabiner key code.");
        if (
          a.modifiers !== undefined &&
          (!Array.isArray(a.modifiers) ||
            a.modifiers.some(
              (m) => !(MODIFIERS as readonly unknown[]).includes(m),
            ))
        )
          err("MODIFIERS", path, "Use explicit left/right modifier key names.");
        break;
      case "consumer":
        if (!(CONSUMER_KEYS as readonly unknown[]).includes(a.key))
          err("KEY", path, "Choose a supported consumer key.");
        break;
      case "layer":
        if (!layerIds.has(a.layer))
          err("LAYER_REFERENCE", path, `Unknown layer ${String(a.layer)}.`);
        if (!["momentary", "toggle", "set", "oneshot"].includes(String(a.mode)))
          err("LAYER_MODE", path, "Choose momentary, toggle, set, or oneshot.");
        if (a.mode === "momentary" && context !== "map" && context !== "hold")
          err(
            "MOMENTARY_TAP",
            path,
            "A momentary layer needs a held input; use one-shot, toggle, or set for taps.",
          );
        if (
          context === "hold" &&
          a.mode !== "momentary" &&
          a.mode !== "oneshot"
        )
          err(
            "HOLD_LAYER",
            path,
            "Hold actions support momentary or one-shot layers; put toggle/set on a tap.",
          );
        if (
          a.timeoutMs !== undefined &&
          (a.mode !== "oneshot" ||
            typeof a.timeoutMs !== "number" ||
            !Number.isInteger(a.timeoutMs) ||
            a.timeoutMs < 1 ||
            a.timeoutMs > 60000)
        )
          err(
            "ONESHOT_TIMEOUT",
            `${path}/timeoutMs`,
            "Only one-shot layers accept expiry: use an integer from 1 to 60000 ms, or omit timeoutMs for no expiry.",
          );
        break;
      case "sequence":
        if (context === "hold")
          err(
            "HOLD_SEQUENCE",
            path,
            "Choose one held output; sequences are discrete tap actions.",
          );
        if (
          depth > 3 ||
          !Array.isArray(a.actions) ||
          a.actions.length < 1 ||
          a.actions.length > 32
        ) {
          err(
            "SEQUENCE",
            path,
            "Use 1–32 actions and at most four levels of nesting.",
          );
          break;
        }
        a.actions.forEach((x, i) =>
          action(x, `${path}/actions/${i}`, "sequence", depth + 1),
        );
        break;
      case "block":
        break;
      case "transparent":
        if (context !== "map")
          err(
            "TRANSPARENT",
            path,
            "Transparency applies to a whole binding, not a gesture branch.",
          );
        break;
      default:
        err("ACTION", path, `Unknown action type ${String(a.type)}.`);
    }
  };
  input.layers.forEach((l, li) => {
    const lp = `/layers/${li}`;
    if (!object(l)) {
      err("LAYER", lp, "Expected a layer object.");
      return;
    }
    id(l.id, `${lp}/id`);
    if (ids.has(String(l.id)))
      err("DUPLICATE_ID", lp, "Layer IDs must be unique.");
    ids.add(String(l.id));
    if (typeof l.name !== "string" || !l.name.trim())
      err("NAME", lp, "Give the layer a name.");
    if (!Array.isArray(l.bindings)) {
      err("BINDINGS", lp, "Expected a bindings array.");
      return;
    }
    const keys = new Set<string>();
    l.bindings.forEach((b, bi) => {
      const bp = `${lp}/bindings/${bi}`;
      if (!object(b)) {
        err("BINDING", bp, "Expected a binding.");
        return;
      }
      id(b.id, `${bp}/id`);
      if (bindingIds.has(String(b.id)))
        err(
          "DUPLICATE_ID",
          bp,
          "Binding IDs must be unique across the project.",
        );
      bindingIds.add(String(b.id));
      if (typeof b.key !== "string" || !KEY_CODES.includes(b.key))
        err("KEY", bp, "Choose a supported Karabiner input key.");
      if (keys.has(String(b.key)))
        err("CONFLICT", bp, "This layer already defines this key.");
      keys.add(String(b.key));
      if (!object(b.behavior)) {
        err("BEHAVIOR", bp, "Expected a behavior.");
        return;
      }
      const beh = b.behavior;
      if (beh.type === "map")
        action(beh.action, `${bp}/behavior/action`, "map");
      else if (beh.type === "dance") {
        if (
          !Array.isArray(beh.steps) ||
          beh.steps.length < 1 ||
          beh.steps.length > 3
        ) {
          err("STEPS", bp, "Define one to three contiguous tap stages.");
          return;
        }
        if (beh.timing !== undefined)
          timing(beh.timing, `${bp}/behavior/timing`, true);
        if (
          beh.interruption !== undefined &&
          !["tap", "hold"].includes(String(beh.interruption))
        )
          err("INTERRUPTION", bp, "Choose tap or hold.");
        beh.steps.forEach((s, si) => {
          const sp = `${bp}/behavior/steps/${si}`;
          if (!object(s)) {
            err("STEP", sp, "Expected a tap/hold step.");
            return;
          }
          action(s.tap, `${sp}/tap`, "tap");
          if (s.hold !== undefined) action(s.hold, `${sp}/hold`, "hold");
        });
        if (!d.some((x) => x.path.startsWith(bp))) {
          const typed = (input as unknown as Project).layers[li].bindings[bi]
            .behavior;
          if (typed.type === "dance" && typed.steps.some((s) => s.hold)) {
            const settings = {
              ...(input as unknown as Project).timing,
              ...typed.timing,
            };
            if (settings.holdMs > settings.tapWindowMs)
              err(
                "HOLD_WINDOW",
                bp,
                "The hold threshold must not exceed the continuation window. This keeps interruption resolution armed until the hold decision.",
              );
          }
          if (typed.type === "dance" && holdPolicy(typed) === "hold")
            typed.steps.forEach((s, si) => {
              if (
                s.hold &&
                !isModifier(s.hold) &&
                s.hold.type !== "layer" &&
                s.hold.type !== "block"
              )
                err(
                  "UNSUPPORTED_INTERRUPTED_HOLD",
                  `${bp}/behavior/steps/${si}/hold`,
                  "Hold-on-other-key supports modifiers and momentary layers. Use commit-tap interruption for ordinary held keys.",
                );
            });
        }
      } else err("BEHAVIOR", bp, "Choose map or dance.");
    });
  });
  if (bindingIds.size > 512)
    err("LIMIT", "/layers", "v1 supports up to 512 bindings.");
  return d;
}
