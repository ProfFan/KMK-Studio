import type { InputEvent } from "@kmk/compiler";

/** Delta debugging keeps timestamps intact and never synthesizes new input. */
export function minimizeTrace(
  events: InputEvent[],
  fails: (candidate: InputEvent[]) => boolean,
): InputEvent[] {
  let result = [...events];
  for (
    let width = Math.max(1, Math.floor(result.length / 2));
    width >= 1;
    width = Math.floor(width / 2)
  ) {
    for (let start = 0; start < result.length;) {
      const candidate = [
        ...result.slice(0, start),
        ...result.slice(start + width),
      ];
      if (candidate.length < result.length && fails(candidate))
        result = candidate;
      else start += width;
    }
  }
  return result;
}
