# KMK / Keyboard studio

A local visual configurator and independent TypeScript compiler for **Karabiner-Elements 16.3.0**. Configure momentary, toggle, and one-shot overlay layers, remaps, exclusive single/double/triple taps, and holds at every tap stage. Export one ordered Complex Modifications rule with a separate compiler report.

## Run

Requires Node.js 22+ and npm. The editor needs no account, backend, or external service. Dependencies are downloaded during setup; application assets and compilation run locally.

```sh
npm ci
npm run dev
# Open http://127.0.0.1:5173
```

The sample project has Caps Lock → Escape / hold Navigation, Space → space / double period / triple Return, and navigation on H/J/K/L/U/O. The four keyboard presets are presentation geometry; the searchable key list exposes all supported Karabiner identities.

Select a layer and key, then configure the inspector. Later layers have higher priority. The playground accepts preset traces, timestamped JSON, and recorded browser input. Browser-reserved shortcuts and Fn may require scripted traces. Valid projects autosave on this device. Save project downloads the editable source; Export to Karabiner opens a dialog with the complete rule JSON and a Copy JSON button. The JSON tab applies edits only after validation. Undo/redo covers applied project changes.

To install from the editor, click **Export to Karabiner → Copy JSON**. In **Karabiner-Elements Settings → Complex Modifications**, click **Add your own rule**, or **Edit** beside the existing KMK rule to update it. Replace all text in the rule editor with the copied JSON, then click **Save**. The dialog includes screenshots of both entry points and a selectable JSON field for manual copying if clipboard access is unavailable. It copies only the single rule object (`rules[0]`), which is the format Karabiner's rule editor expects.

## One-shot leaders

In any action editor, choose **Layer → One-shot** and select the target layer. Leave **Expire if unused** unchecked to wait indefinitely, or enable it and enter a timeout (1–60000 ms). The next non-modifier key uses the layer and consumes it; Escape cancels. Unassigned keys still run their ordinary mapping and consume the activation. Holds and tap-dance continuations keep the binding they started with.

Import [Double Command leader](examples/command-leader.kmk.json) for an example: double-tap left Command, then H for Left Arrow or S for Page Up / double S for Page Down. Normal Command shortcuts retain Command hold behavior. The example expires after one second; uncheck expiry to make it indefinite. The playground's **Edit trace** supports scripted Command events that a browser might reserve.

JSON uses `{"type":"layer","layer":"nav","mode":"oneshot","timeoutMs":1000}`. Omit `timeoutMs` for no expiry; TypeScript constructors are `oneShot("nav", 1000)` and `oneShot("nav")`.

## CLI

```sh
npm run kmk -- check examples/studio.kmk.json
npm run kmk -- compile examples/studio.kmk.json -o /tmp/studio.karabiner.json
npm run kmk -- explain examples/studio.kmk.json --json -o /tmp/studio.report.json
npm run kmk -- compile examples/studio.kmk.json --no-optimize
```

`packages/cli/bin/kmk.mjs` also runs directly. `compile` writes only JSON to stdout unless `-o` is supplied. Errors prevent export; file output uses an atomic rename and cannot overwrite the source project. `explain` includes pass explanations, statistics, source mappings, and gesture machines. No command writes a live Karabiner profile.

To install a file exported by the CLI, copy it into `~/.config/karabiner/assets/complex_modifications/`, then add its **complete KMK rule** in Karabiner Settings → Complex Modifications. Keep the project together: rule order carries dependencies. Release keys and finish pending gestures before replacing or disabling a rule. Use distinct project IDs for projects enabled together. Other enabled Karabiner rules can consume input before KMK; conformance is for the complete generated asset in isolation.

## TypeScript API

```ts
import { createProject, dance, key, compile } from "@kmk/compiler";
import { simulateProject, simulateKarabiner } from "@kmk/simulator";

const project = createProject();
project.layers[0].bindings.push({
  id: "a-dance",
  key: "a",
  behavior: dance([
    { tap: key("a"), hold: key("left_control") },
    { tap: key("escape"), hold: key("left_shift") },
    { tap: key("return_or_enter") },
  ]),
});
const result = compile(project);
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
const trace = [
  { at: 0, type: "down", key: "a" },
  { at: 30, type: "up", key: "a" },
  { at: 100, type: "down", key: "a" },
  { at: 140, type: "up", key: "a" },
] as const;
simulateProject(project, [...trace]);
simulateKarabiner(result.asset!, [...trace]);
```

The compiler has no filesystem or browser imports. Workspace packages expose TypeScript source for bundlers/TypeScript consumers. JSON version 1 uses stable project/layer/binding IDs, `layout`, global `timing`, and ordered `layers`. See [types](packages/compiler/src/types.ts), the [sample project](examples/studio.kmk.json), and [semantic contract](docs/semantics.md).

## Verify

```sh
npm test                 # independent interpreters, traces, CLI, validation
npm run build            # strict TypeScript + production editor build
npm run browser:install  # official isolated Chromium, stored in .cache/
npm run test:browser     # editor flows, persistence, downloads, mobile layout
npm run native:build     # macOS + Xcode CLI tools + git + Python 3; initial network fetch
npm run test:native      # pinned upstream engine, synthetic events only
npm run benchmark
npm run format:check
```

The native adapter fetches the exact 16.3.0 revision and executes upstream's controlled-time test harness without connecting a virtual device. It does not install rules or inject keystrokes. Native sources, binary, test runtime, and generated reports are development caches, not application dependencies.

[Verification details](docs/verification.md) explain what is compared, reproducible counts, and the native rule-removal limitation. [Compiler architecture](docs/architecture.md) explains the passes and independent design lessons from existing projects. “Verified” means conformance over the supported subset and this test suite, not a proof over every possible trace or third-party rule interaction.
