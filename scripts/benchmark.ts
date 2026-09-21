import { performance } from "node:perf_hooks";
import {
  compile,
  createProject,
  dance,
  KEY_CODES,
  key,
  layer,
  oneShot,
} from "@kmk/compiler";
const report = [];
for (const oneshot of [false, true])
  for (const count of [16, 64, 128]) {
    const p = createProject();
    p.layers.push({ id: "nav", name: "Nav", bindings: [] });
    p.layers[0].bindings = [
      {
        id: "activate",
        key: "caps_lock",
        behavior: {
          type: "map",
          action: oneshot ? oneShot("nav", 1000) : layer("nav"),
        },
      },
      ...KEY_CODES.filter((k) => k !== "caps_lock")
        .slice(0, count)
        .map((k, i) => ({
          id: `b${i}`,
          key: k,
          behavior:
            i % 8 === 0
              ? dance([{ tap: key(k) }, { tap: key("escape") }], {
                  interruption: "tap",
                })
              : { type: "map" as const, action: key("spacebar") },
        })),
    ];
    let result = compile(p);
    const begin = performance.now();
    for (let i = 0; i < 50; i++) result = compile(p);
    report.push({
      activation: oneshot ? "one-shot" : "momentary",
      bindings: p.layers.reduce((n, l) => n + l.bindings.length, 0),
      meanCompileMs: Number(((performance.now() - begin) / 50).toFixed(2)),
      ...result.statistics,
    });
  }
console.table(report);
