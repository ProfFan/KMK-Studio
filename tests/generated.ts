import type { InputEvent } from "@kmk/compiler";
/** Deterministic physical traces, including overlapping keys and threshold-adjacent gaps. */
export function generatedTraces(
  count = 200,
): { name: string; events: InputEvent[] }[] {
  let seed = 0x4b4d4b;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const keys = ["a", "s", "d", "x", "h", "caps_lock", "tab", "left_shift"];
  const gaps = [1, 30, 80, 199, 200, 201, 249, 250, 251, 350];
  return Array.from({ length: count }, (_, i) => {
    let at = 0;
    const down = new Set<string>(),
      events: InputEvent[] = [];
    for (let j = 0; j < 12; j++) {
      at += gaps[Math.floor(random() * gaps.length)];
      const k = keys[Math.floor(random() * keys.length)];
      const type = down.has(k) ? "up" : "down";
      if (type === "up") down.delete(k);
      else down.add(k);
      events.push({ at, key: k, type });
    }
    for (const k of down) {
      at += 30;
      events.push({ at, key: k, type: "up" });
    }
    return { name: `seed-4b4d4b-${i}`, events };
  });
}
