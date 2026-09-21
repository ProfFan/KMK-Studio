import { KEY_CODES, type InputEvent } from "@kmk/compiler";

/** Validate trace shape before either independent interpreter executes it. */
export function validateTrace(
  events: unknown,
  until?: number,
): asserts events is InputEvent[] {
  if (!Array.isArray(events)) throw new Error("A trace must be an array.");
  let previous = 0;
  for (const [i, e] of events.entries()) {
    if (!e || !Number.isSafeInteger(e.at) || e.at < previous)
      throw new Error(
        `Trace event ${i}: timestamps must be nonnegative, nondecreasing integer milliseconds.`,
      );
    if (!["down", "up", "reset", "invalidate"].includes(e.type))
      throw new Error(`Trace event ${i}: use down, up, reset, or invalidate.`);
    if ((e.type === "down" || e.type === "up") && !KEY_CODES.includes(e.key))
      throw new Error(`Trace event ${i}: use a supported Karabiner key code.`);
    previous = e.at;
  }
  if (until !== undefined && (!Number.isSafeInteger(until) || until < previous))
    throw new Error(
      "The simulation end must be an integer at or after the last input.",
    );
}
