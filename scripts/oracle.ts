import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { Asset, InputEvent } from "@kmk/compiler";
export interface NativeCase {
  name: string;
  asset: Asset;
  events: InputEvent[];
  until?: number;
}
export interface NativeResult {
  name: string;
  presses: { key: string; modifiers: string[] }[];
  reports: Record<string, any>[];
  variables: Record<string, number>;
  activeModifierFlags: number;
}
export function runNative(cases: NativeCase[]): NativeResult[] {
  const root = resolve(".cache/native/cases");
  mkdirSync(root, { recursive: true });
  if (!existsSync(".cache/native/kmk-oracle"))
    throw new Error(
      "Build the pinned engine adapter first: npm run native:build",
    );
  const suite = cases.map((c, i) => {
    const prefix = resolve(root, String(i));
    writeFileSync(
      `${prefix}-rules.json`,
      JSON.stringify(c.asset.rules.flatMap((r) => r.manipulators)),
    );
    const events: unknown[] = [];
    const until = c.until ?? Math.max(0, ...c.events.map((e) => e.at)) + 1000;
    // Advance to potential deadlines even when no input arrives there. Otherwise
    // callbacks would read the next input's wall clock when arming an expiry.
    const delays = [
      ...new Set(
        c.asset.rules.flatMap((r) =>
          r.manipulators.flatMap((m) => Object.values(m.parameters ?? {})),
        ),
      ),
    ];
    const checkpoints = [
      ...new Set(
        c.events
          .filter((e) => e.type === "down")
          .flatMap((e) => delays.map((d) => e.at + d))
          .filter((t) => t <= until),
      ),
    ].sort((a, b) => a - b);
    const drain = (at: number) => {
      while (checkpoints.length && checkpoints[0] <= at)
        events.push({
          action: "invoke_dispatcher",
          time_stamp: checkpoints.shift()!,
        });
    };
    // Explicitly drain due callbacks BEFORE input at the same timestamp.
    for (const e of c.events) {
      drain(e.at);
      events.push({ action: "invoke_dispatcher", time_stamp: e.at });
      if (e.type === "reset")
        throw new Error(
          "Reset starts a fresh simulated session; use invalidate for native rule invalidation.",
        );
      if (e.type === "invalidate") {
        events.push({ action: "invalidate_manipulators", time_stamp: e.at });
        continue;
      }
      const event = {
        type: "momentary_switch_event",
        momentary_switch_event: { key_code: e.key },
      };
      events.push({
        device_id: 1,
        event,
        original_event: event,
        event_time_stamp: { time_stamp: e.at },
        event_type: e.type === "down" ? "key_down" : "key_up",
        lazy: false,
        validity: true,
      });
    }
    drain(until);
    events.push({
      action: "invoke_dispatcher",
      time_stamp: until,
    });
    writeFileSync(`${prefix}-input.json`, JSON.stringify(events));
    return {
      description: c.name,
      rules: [`${prefix}-rules.json`],
      input_event_queue: `${prefix}-input.json`,
      expected_post_event_to_virtual_devices_queue: `${prefix}-output.json`,
      kmk_variables: `${prefix}-vars.json`,
    };
  });
  const path = resolve(root, "suite.json");
  writeFileSync(path, JSON.stringify(suite));
  const r = spawnSync(resolve(".cache/native/kmk-oracle"), [path], {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw new Error(
      `Native oracle failed (${r.status}): ${r.stderr}\n${r.stdout}`,
    );
  return cases.map((c, i) => {
    const reports = JSON.parse(
      readFileSync(resolve(root, `${i}-output.json`), "utf8"),
    ) as Record<string, any>[];
    const priorByType = new Map<string, Set<string>>();
    const presses: { key: string; modifiers: string[] }[] = [];
    for (const report of reports) {
      const body = report.keyboard_input ?? report.consumer_input;
      if (!body) continue;
      const keys = new Set<string>(
        (body.keys ?? []).map(
          (k: Record<string, string>) => k.key_code ?? k.consumer_key_code,
        ),
      );
      const type = String(report.type),
        prior = priorByType.get(type) ?? new Set<string>();
      for (const key of keys)
        if (!prior.has(key))
          presses.push({ key, modifiers: body.modifiers ?? [] });
      priorByType.set(type, keys);
    }
    const state = JSON.parse(
      readFileSync(resolve(root, `${i}-vars.json`), "utf8"),
    );
    return { name: c.name, presses, reports, ...state };
  });
}
