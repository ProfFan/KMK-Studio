import type { ReactNode } from "react";
import { Mermaid } from "./Mermaid.tsx";
import { diagrams } from "./diagrams.ts";
import screenshots from "./screenshots.json";

export interface Guide {
  id: string;
  title: string;
  group: string;
  keywords: string;
  summary: string;
  body: ReactNode;
}

function Shot({
  name,
  caption,
  narrow = false,
}: {
  name: keyof typeof screenshots;
  caption: string;
  narrow?: boolean;
}) {
  return (
    <figure className={`docs-shot${narrow ? " docs-shot-narrow" : ""}`}>
      <a
        href={`/help/docs/${name}.png`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Enlarge screenshot: ${caption}`}
      >
        <img
          src={`/help/docs/${name}.png`}
          alt={caption}
          loading="lazy"
          width={screenshots[name].width}
          height={screenshots[name].height}
        />
      </a>
      <figcaption>
        {caption} <span>Click to enlarge.</span>
      </figcaption>
    </figure>
  );
}
function Recipe({ name }: { name: string }) {
  return (
    <p className="docs-recipe">
      <a href={`/help/docs/recipes/${name}.kmk.json`} download>
        ↓ Download this example project
      </a>
      <span>
        Use Import project in the studio. Save your current project first.
      </span>
    </p>
  );
}
function Code({ children }: { children: string }) {
  return (
    <pre>
      <code>{children}</code>
    </pre>
  );
}
function Note({ children }: { children: ReactNode }) {
  return <aside className="docs-note">{children}</aside>;
}

export const guides: Guide[] = [
  {
    id: "start",
    title: "Your first configuration",
    group: "Start here",
    keywords: "getting started quick start setup install introduction",
    summary: "Choose a key, give it a job, try it, then export.",
    body: (
      <>
        <p>
          KMK Studio turns a keyboard project into a Karabiner-Elements Complex
          Modifications rule. Build ordinary remaps, exclusive tap dances, and
          layers in your browser. Compilation and simulation run on your device,
          without an account or server.
        </p>
        <ol>
          <li>
            Open the <a href="/">studio</a> and select <strong>Base</strong> in
            the layer sidebar.
          </li>
          <li>
            Click a key on the keyboard, or find its Karabiner name with{" "}
            <strong>Find any key…</strong>.
          </li>
          <li>
            In the inspector, set <strong>Behavior → Remap</strong>. Choose{" "}
            <strong>Key / shortcut</strong> and an output key.
          </li>
          <li>
            Try the key in the <strong>Gesture playground</strong>. Resolve any
            validation messages.
          </li>
          <li>
            Choose <strong>Export to Karabiner</strong>, copy the rule, and
            paste it into Karabiner’s rule editor. See{" "}
            <a href="#export">installation</a>.
          </li>
        </ol>
        <Note>
          The initial project is an editable example: Caps Lock taps Escape and
          holds Navigation; Space has single, double, and triple taps. Use{" "}
          <strong>Default / inherit</strong> to remove an assignment you do not
          want.
        </Note>
        <Shot
          name="workspace"
          caption="The studio: layers on the left, your keyboard in the middle, and the selected key’s actions on the right."
        />
      </>
    ),
  },
  {
    id: "workspace",
    title: "Projects & global settings",
    group: "Start here",
    keywords:
      "save load autosave undo redo layout ANSI TKL 60 Mac name keyboard import export local privacy device filter vendor product VID PID built-in device_if is_built_in_keyboard",
    summary: "Keep your work, choose a layout, and set project-wide timing.",
    body: (
      <>
        <p>
          Edit the project name above the layer list.{" "}
          <strong>Save project</strong> downloads editable KMK source as{" "}
          <code>.kmk.json</code>; <strong>Import project</strong> opens a saved
          project after validation. A project file is different from the
          generated Karabiner rule.
        </p>
        <p>
          Valid changes autosave in this browser’s local storage. Another
          browser or device has its own copy. Private browsing, clearing site
          data, or unavailable storage can remove that copy, so download
          projects you want to keep. Invalid drafts are not autosaved. Use{" "}
          <strong>Undo</strong> and <strong>Redo</strong> in the top bar for
          edits in the current session; that history does not survive a reload.
        </p>
        <p>
          Open <strong>⚙ Global Settings</strong> to choose Mac laptop, ANSI
          full-size, TKL, or 60% geometry and the global tap window and hold
          threshold. Layout changes only the drawing: bindings keep their
          Karabiner key identities. Use search for keys that are not pictured.
        </p>
        <Shot
          name="settings"
          caption="Global Settings controls keyboard geometry, default timing, and which devices use the generated rule."
        />
        <h3>Apply modifications to one device</h3>
        <p>
          Under <strong>Apply modifications to</strong>, choose{" "}
          <strong>All devices</strong> (the default),{" "}
          <strong>Specific device (VID / PID)</strong>, or{" "}
          <strong>Built-in keyboard</strong>. For VID/PID, enter both
          nonnegative whole-number IDs in decimal, as shown in{" "}
          <strong>Karabiner-EventViewer → Devices</strong>. Both IDs must match;
          identical keyboard models sharing those IDs are included. Built-in
          keyboard uses Karabiner’s <code>is_built_in_keyboard: true</code>{" "}
          classification.
        </p>
        <Shot
          name="device-filter"
          caption="Limit the whole project to a VID/PID pair. Choose Built-in keyboard instead to use Karabiner’s built-in keyboard flag."
        />
        <p>
          The filter is saved with the project and applies to every generated
          manipulator, including tap-dance continuations and one-shot helpers,
          through <code>device_if</code>. The playground assumes input from the
          selected device because browsers cannot identify individual keyboards.
          Karabiner can still resolve an already pending gesture when another
          device sends input; held modifiers affect the shared keyboard state.
        </p>
        <Note>
          Before leaving the editor, apply a valid Project JSON draft or keep a
          separate copy of it. An unapplied text draft is not your saved
          project.
        </Note>
      </>
    ),
  },
  {
    id: "actions",
    title: "Remaps, shortcuts & sequences",
    group: "Key patterns",
    keywords:
      "key modifiers command control shift option media consumer volume macro sequence block transparent repeat",
    summary:
      "Give a physical key one output, a shortcut, or a finite sequence.",
    body: (
      <>
        <p>
          Select a key and set <strong>Behavior → Remap</strong>. The action
          runs on press. A held key output releases with the physical key,
          retaining normal repeat behavior where Karabiner supports it.
        </p>
        <div className="docs-table">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>How it works</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Key / shortcut</td>
                <td>
                  Choose an output key. Toggle ⌘, ⇧, ⌥, or ⌃ to add explicit
                  left-side modifiers to that output. Right-side modifiers and
                  Fn are also available through Project JSON.
                </td>
              </tr>
              <tr>
                <td>Media key</td>
                <td>
                  Send a consumer key such as play/pause, mute, volume,
                  brightness, or eject.
                </td>
              </tr>
              <tr>
                <td>Sequence</td>
                <td>
                  Add discrete actions in order, for example Cmd+C then Cmd+V.
                  Each output is a tap; sequences have no configurable delays
                  and cannot be held.
                </td>
              </tr>
              <tr>
                <td>Layer</td>
                <td>
                  Activate, toggle, exclusively select, or arm a layer for one
                  use. See <a href="#layers">layers</a>.
                </td>
              </tr>
              <tr>
                <td>Do nothing</td>
                <td>
                  Consume the input without output. This blocks a lower-layer
                  mapping too.
                </td>
              </tr>
              <tr>
                <td>Transparent</td>
                <td>
                  Look through this layer to the next active layer. Available
                  for a whole remap, not inside a tap dance or sequence.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <h3>Recipe: one key for Cmd+Shift+P</h3>
        <ol>
          <li>
            Select <strong>F</strong>, then{" "}
            <strong>Remap → Key / shortcut</strong>.
          </li>
          <li>
            Set Output to <strong>P</strong>, then enable <strong>⌘</strong> and{" "}
            <strong>⇧</strong>.
          </li>
          <li>
            F now sends the shortcut. Its meaning depends on the receiving
            application.
          </li>
        </ol>
        <Shot
          name="shortcuts"
          narrow
          caption="F remapped to P with Command and Shift enabled."
        />
        <Recipe name="shortcuts" />
        <p>
          <strong>Default / inherit</strong> and <strong>Reset this key</strong>{" "}
          remove the binding. On an overlay, that exposes lower layers; on Base,
          the original key passes through.
        </p>
        <Note>
          Generated keys do not trigger other KMK bindings in the same Complex
          Modifications pass. An A → B mapping does not invoke your B tap dance.
          Shortcut modifiers affect the generated action; use a modifier key as
          a <a href="#holds">hold action</a> to modify subsequent physical
          input.
        </Note>
      </>
    ),
  },
  {
    id: "taps",
    title: "Single, double & triple taps",
    group: "Key patterns",
    keywords:
      "tap dance doubletap tripletap exclusive prefix release timeout space period return",
    summary:
      "Choose one action by tap count, without emitting shorter prefixes.",
    body: (
      <>
        <p>
          Set <strong>Behavior → Tap dance</strong>. Every stage has a tap
          action and an optional hold action. Use{" "}
          <strong>+ Add triple tap</strong> (or double tap) to extend the
          gesture; use the × on its last stage to remove it. There can be one,
          two, or three stages.
        </p>
        <h3>Recipe: Space → space, period, or Return</h3>
        <ol>
          <li>
            Select Space and choose <strong>Tap dance</strong>.
          </li>
          <li>
            Set Single tap to <code>spacebar</code> and Double tap to{" "}
            <code>period</code>.
          </li>
          <li>
            Add Triple tap and set its output to <code>return_or_enter</code>.
          </li>
          <li>
            Try the Single tap, Double tap, and Triple tap playground presets.
          </li>
        </ol>
        <Shot
          name="taps"
          narrow
          caption="A three-stage Space tap dance. Only the recognized stage’s action is emitted."
        />
        <Recipe name="taps" />
        <p>
          A double tap emits only the double action; a triple tap emits only the
          triple action. Earlier tap actions wait while another tap is possible.
          The last available stage commits on release, unless a hold or
          interruption has already decided it. Every additional tap requires a
          physical release; OS auto-repeat is not another tap.
        </p>
        <Mermaid
          source={diagrams.taps}
          caption="A two-stage tap dance without holds, using Commit tap interruption. The first deadline is 250 ms after the first key-down."
        />
        <p>
          For three taps, the second stage has its own waiting state and a fresh
          key-down-anchored continuation window. If that window ends, the double
          tap commits. A later press starts a new gesture.
        </p>
      </>
    ),
  },
  {
    id: "holds",
    title: "Tap / hold & staged holds",
    group: "Key patterns",
    keywords:
      "dual role mod tap ctrl escape control rollover tap then hold double tap then hold modifier",
    summary: "Hold a modifier or layer while preserving a separate tap action.",
    body: (
      <>
        <h3>Recipe: tap Caps Lock for Escape, hold for Control</h3>
        <ol>
          <li>
            Select Caps Lock and choose <strong>Tap dance</strong>. Remove the
            Double tap stage with its ×, leaving one stage.
          </li>
          <li>
            Set Single tap to <code>escape</code>. Enable{" "}
            <strong>Add a hold action</strong> and set that output to{" "}
            <code>left_control</code>.
          </li>
          <li>
            Use <strong>Activate hold</strong> as the interruption policy. Hold
            Caps Lock and press another key: Control activates before that key.
          </li>
        </ol>
        <Shot
          name="holds"
          narrow
          caption="A single-stage Caps Lock dual-role key, with a 200 ms Control hold and Activate hold interruption."
        />
        <Recipe name="holds" />
        <Mermaid
          source={diagrams.holds}
          caption="Caps Lock as Escape / Control: releasing before the threshold taps Escape; holding or pressing another key activates Control until Caps Lock releases."
        />
        <h3>Tap-then-hold and double-tap-then-hold</h3>
        <p>
          Enable a hold action under <strong>Double tap</strong> to recognize
          tap → release → press and hold. Enable one under{" "}
          <strong>Triple tap</strong> to recognize two taps → third press and
          hold. Each hold’s threshold starts at that stage’s key-down, and
          recognizing it suppresses all shorter tap actions.
        </p>
        <p>
          The next example uses Escape / Control at stage one, Tab / Option at
          stage two, and Return / Shift at stage three. Configure each stage’s
          tap and its <strong>Add a hold action</strong> output.
        </p>
        <Shot
          name="stages"
          narrow
          caption="Separate holds under Single, Double, and Triple tap let the same key select three modifiers."
        />
        <Recipe name="stages" />
        <Mermaid
          source={diagrams.stages}
          caption="The uninterrupted paths of a three-stage dance with a hold at every stage. Interruption is handled by the binding’s policy at any pending stage."
        />
        <Note>
          A hold belongs to its originating physical key. Releasing another key,
          consuming a one-shot, or changing layer priority does not transfer its
          release. A modifier hold affects subsequent input; a held ordinary key
          or media key requires <strong>Commit tap</strong> interruption and
          activates after the threshold.
        </Note>
      </>
    ),
  },
  {
    id: "timing",
    title: "Timing & interruptions",
    group: "Key patterns",
    keywords:
      "250 200 milliseconds window deadline threshold boundary default cancel interruption lost tap latency",
    summary: "Know exactly when KMK makes a decision.",
    body: (
      <>
        <p>
          The defaults are a <strong>250 ms tap window</strong> and{" "}
          <strong>200 ms hold threshold</strong>. Change them in Global
          Settings, or override them for a selected dance under Timing &amp;
          Interruption. Values must be integer milliseconds from 1 to 5000. If
          any stage has a hold, its threshold must be no greater than the tap
          window.
        </p>
        <p>
          Both clocks begin at the corresponding <strong>key-down</strong>, not
          the release. With a 250 ms window, pressing at 0 ms and releasing at
          180 ms leaves only 70 ms for another press. A press at 249 ms can
          continue; at 250 ms the due timer has already run. At equal deadlines,
          hold takes precedence.
        </p>
        <div className="docs-table">
          <table>
            <thead>
              <tr>
                <th>When another key presses…</th>
                <th>Activate hold</th>
                <th>Commit tap</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Original key is still down</td>
                <td>
                  Start its current hold, or commit its tap if no hold is
                  configured.
                </td>
                <td>
                  Commit the current tap; a later release will not emit it
                  again.
                </td>
              </tr>
              <tr>
                <td>Original key already released</td>
                <td colSpan={2}>
                  Commit the completed tap before handling the new key. A
                  released tap is never promoted to a hold.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Modifier and layer holds default to Activate hold. Typing holds
          default to Commit tap. Activate hold on interruption supports modifier
          keys, momentary or one-shot layers, and Do nothing; unsupported held
          outputs produce a diagnostic.
        </p>
        <p>
          An earlier stage reaching its continuation deadline commits its tap
          even if still physically down and it has no recognized hold. A last
          stage without a hold waits for release or interruption. Tap and
          sequence actions are discrete; they do not auto-repeat.
        </p>
        <h3>Modifier timing</h3>
        <p>
          Delayed or interrupted taps restore the modifier snapshot from that
          stage’s key-down. A terminal tap committed by release uses the
          modifiers active at release. To check rollover, test both orders of
          releasing the dance key and the other key in the playground.
        </p>
      </>
    ),
  },
  {
    id: "layers",
    title: "Overlay layers & priority",
    group: "Layers",
    keywords:
      "base navigation transparent blocked priority overlay toggle momentary while held select only exclusive ownership",
    summary:
      "Reuse the keyboard with explicit priority and predictable fallthrough.",
    body: (
      <>
        <p>
          Use <strong>+</strong> beside Layers to add an overlay. Select it to
          rename it and edit its bindings. Clicking a layer in the editor
          chooses what you edit; it does not activate that layer in Karabiner or
          the playground.
        </p>
        <p>
          Base is always active. Later layers in the list have higher priority;
          use the priority controls to move an overlay. An unassigned or
          transparent key falls through to the next active layer.{" "}
          <strong>Do nothing</strong> consumes the key instead. Base cannot be
          deleted.
        </p>
        <Mermaid
          source={diagrams.layers}
          caption="Binding selection searches active layers from highest to lowest. Once selected, a gesture retains its binding across layer changes."
        />
        <div className="docs-table">
          <table>
            <thead>
              <tr>
                <th>Layer mode</th>
                <th>Behavior</th>
                <th>Where to use it</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>While held</td>
                <td>Active until the originating physical key releases.</td>
                <td>A remap or a dance hold.</td>
              </tr>
              <tr>
                <td>Toggle</td>
                <td>Flip persistent activation on or off.</td>
                <td>A remap, tap, or sequence action.</td>
              </tr>
              <tr>
                <td>Select only</td>
                <td>
                  Clear all persistent, momentary, and one-shot activation, then
                  select this layer alongside Base. Selecting Base returns to
                  Base alone.
                </td>
                <td>A remap, tap, or sequence action.</td>
              </tr>
              <tr>
                <td>One-shot</td>
                <td>
                  Arm the overlay for one non-modifier key. Optional expiry.
                </td>
                <td>A remap, tap, hold, or sequence action.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h3>Recipe: a Navigation layer on H / J / K / L</h3>
        <ol>
          <li>
            Add a layer named <strong>Navigation</strong>. Remap H → left arrow,
            J → down arrow, K → up arrow, and L → right arrow.
          </li>
          <li>
            Return to Base. Select Caps Lock and set{" "}
            <strong>Remap → Layer → Navigation → While held</strong>.
          </li>
          <li>
            For a toggle, map Tab to{" "}
            <strong>Layer → Navigation → Toggle</strong>.
          </li>
          <li>
            On Navigation, map Escape to{" "}
            <strong>Layer → Base → Select only</strong> for a return-to-base
            action.
          </li>
        </ol>
        <Shot
          name="layers"
          caption="The Navigation overlay gives H, J, K, and L arrow outputs; unassigned keys inherit their normal bindings."
        />
        <Shot
          name="momentary"
          narrow
          caption="The Base-layer Caps Lock mapping activates Navigation only while held."
        />
        <Recipe name="layers" />
        <p>
          Two keys can hold the same layer independently. Releasing either one
          leaves the other owner active. A toggle’s persistent bit is also
          independent: releasing a momentary key does not clear it.{" "}
          <strong>Select only</strong> deliberately clears all these
          activations; future presses can activate overlays again.
        </p>
        <Note>
          Deleting a referenced layer leaves actions that must be retargeted or
          removed. Follow the validation messages before exporting. Keep stable
          layer IDs when editing JSON; actions refer to IDs, not display names.
        </Note>
      </>
    ),
  },
  {
    id: "oneshot",
    title: "One-shot layers & leader keys",
    group: "Layers",
    keywords:
      "lead leader double command cmd expiry expiration timeout no expiry armed next key escape cancel",
    summary: "Double-tap Command, then choose the next key’s meaning.",
    body: (
      <>
        <p>
          A one-shot layer gives the next non-modifier press an alternate
          binding. You can release the activator before pressing that key. It
          can wait indefinitely or expire after a chosen number of milliseconds.
        </p>
        <h3>Recipe: double-tap Command, then H / J / K / L</h3>
        <ol>
          <li>
            Create the Navigation overlay and its arrow mappings as described{" "}
            <a href="#layers">above</a>.
          </li>
          <li>
            On Base, select <code>left_command</code> and choose{" "}
            <strong>Tap dance</strong> with two stages.
          </li>
          <li>
            Set Single tap to <strong>Do nothing</strong>. Give{" "}
            <strong>both stages</strong> a hold action of{" "}
            <code>left_command</code> and use <strong>Activate hold</strong>{" "}
            interruption. Command shortcuts still work when you hold Command and
            press another key.
          </li>
          <li>
            Set Double tap to <strong>Layer → Navigation → One-shot</strong>.
          </li>
          <li>
            Enable <strong>Expire if unused</strong> and set{" "}
            <strong>1000 ms</strong>, or uncheck it to wait until the next key
            with no expiry.
          </li>
        </ol>
        <Shot
          name="leader"
          narrow
          caption="Double-tap left Command to arm Navigation for one second. Both stages retain a Command hold for ordinary shortcuts."
        />
        <Recipe name="leader" />
        <p>
          Double-tap and release Command, then press H: you get one left arrow.
          The following H is normal. The one-second expiry starts when the
          double-tap action fires, not on the first Command press. At the exact
          expiry time, the one-shot is already inactive.
        </p>
        <Mermaid
          source={diagrams.oneshot}
          caption="One-shot lifecycle. The next key chooses its binding before the activation is consumed, so a chosen hold or tap dance can finish normally."
        />
        <ul>
          <li>
            Command, Control, Shift, Option, and Fn do not consume a one-shot.
            Caps Lock is a non-modifier here and does consume it.
          </li>
          <li>
            <strong>Escape cancels</strong> an active one-shot and is swallowed.
            Without an active one-shot, Escape behaves normally.
          </li>
          <li>
            An unassigned, transparent, or blocked key still consumes it. Normal
            overlay priority applies; a higher active layer can win.
          </li>
          <li>
            Only one one-shot can be armed at once. A new activation replaces
            it; the consuming action can arm another for a chain.
          </li>
          <li>
            Consumption or expiry leaves independent momentary owners and toggle
            activation intact. A chosen held output releases with its physical
            key, even after expiry.
          </li>
        </ul>
        <p>
          For a dedicated leader key, use{" "}
          <strong>Remap → Layer → One-shot</strong> without a tap dance. For no
          expiry in JSON, omit <code>timeoutMs</code>; zero does not mean
          “forever.”
        </p>
        <Code>{`{ "type": "layer", "layer": "nav", "mode": "oneshot" }
{ "type": "layer", "layer": "nav", "mode": "oneshot", "timeoutMs": 1000 }`}</Code>
      </>
    ),
  },
  {
    id: "playground",
    title: "The gesture playground",
    group: "Test & export",
    keywords:
      "timeline trace simulation record keys browser testing pending active layer event script reset invalidate",
    summary:
      "Inspect outputs, active layers, and pending decisions on a deterministic timeline.",
    body: (
      <>
        <p>
          The playground simulates the current project; it does not install
          rules or send real key outputs. Select a key, then use the{" "}
          <strong>Single tap</strong>, <strong>Double tap</strong>,{" "}
          <strong>Triple tap</strong>, or <strong>Hold + key</strong> preset.
          Hold + key uses H as the unrelated key.
        </p>
        <p>
          <strong>Record keys</strong> captures input while the page is focused.
          Stop recording to resume ordinary page shortcuts. Recording also stops
          on focus loss or opening the export dialog. macOS shortcuts, Command
          combinations, Fn, and browser-reserved keys may not reach the page
          reliably; use <strong>Edit trace</strong> for those cases.
        </p>
        <p>
          Expand <strong>Inspect layer and pending-state transitions</strong> to
          see why an output occurred. <strong>Edit trace → Apply trace</strong>{" "}
          runs a JSON list of input events. Timestamps are nonnegative,
          nondecreasing integer milliseconds; use Karabiner key identities.
          Duplicate downs and unmatched ups do not create extra taps.
        </p>
        <Shot
          name="timeline"
          caption="A double Space tap emits a period. The expanded trace shows pending gesture decisions alongside layer state."
        />
        <h3>Script: double Command, then H</h3>
        <p>
          Import the leader example above and apply this trace. The one-shot
          arms at 140 ms and H at 200 ms consumes it, producing a left arrow.
        </p>
        <Code>{`[
  { "at": 0,   "type": "down", "key": "left_command" },
  { "at": 40,  "type": "up",   "key": "left_command" },
  { "at": 100, "type": "down", "key": "left_command" },
  { "at": 140, "type": "up",   "key": "left_command" },
  { "at": 200, "type": "down", "key": "h" },
  { "at": 240, "type": "up",   "key": "h" }
]`}</Code>
        <p>
          Probe timing boundaries with presses immediately before, at, and after
          a deadline. Add another key before and after release to check
          interruptions. <code>reset</code> starts a fresh simulated session;{" "}
          <code>invalidate</code> models disabling the rule. They are test
          events, not actions your generated configuration can send.
        </p>
      </>
    ),
  },
  {
    id: "json",
    title: "Project JSON & validation",
    group: "Test & export",
    keywords:
      "advanced source version schema stable id errors diagnostics bindings references import export",
    summary: "Visual editing and JSON share one versioned project model.",
    body: (
      <>
        <p>
          The <strong>Project JSON</strong> tab shows the editable source. Make
          changes and choose <strong>Apply JSON</strong> to validate and adopt
          them. An unapplied or invalid JSON draft disables export. Visual edits
          regenerate the source from the project, so apply your text changes
          before editing visually.
        </p>
        <Code>{`{
  "version": 1,
  "id": "my-keyboard",
  "name": "My keyboard",
  "layout": "mac",
  "timing": { "tapWindowMs": 250, "holdMs": 200 },
  "layers": [{
    "id": "base",
    "name": "Base",
    "bindings": [{
      "id": "caps-escape",
      "key": "caps_lock",
      "behavior": {
        "type": "map",
        "action": { "type": "key", "key": "escape" }
      }
    }]
  }]
}`}</Code>
        <p>
          <code>layers[0]</code> is Base; later entries take higher priority.
          Use stable, unique IDs for the project, layers, and bindings. Key
          names are Karabiner identities such as <code>spacebar</code>,{" "}
          <code>left_command</code>, and <code>return_or_enter</code>, not the
          label printed on a keycap. Layout values are <code>mac</code>,{" "}
          <code>ansi</code>, <code>tkl</code>, and <code>sixty</code>.
        </p>
        <p>
          A dance uses{" "}
          <code>{`{ "type": "dance", "steps": [{ "tap": action, "hold": action }], "interruption": "hold", "timing": { "tapWindowMs": 250 } }`}</code>
          . Each step requires a tap; hold, interruption, and per-binding timing
          are optional. Omitted timing fields inherit the global setting. Remove
          an override in JSON to inherit again.
        </p>
        <h3>Fixing diagnostics</h3>
        <ul>
          <li>
            A missing layer reference: select an existing target or remove the
            action.
          </li>
          <li>
            A conflicting binding: keep only one binding for a given key within
            each layer.
          </li>
          <li>
            Invalid timing: use the allowed integer range and keep hold
            threshold within the tap window.
          </li>
          <li>
            An unsupported hold: use one output, move sequences to taps, and use
            Commit tap for ordinary key or media holds.
          </li>
          <li>
            An invalid import: correct the file; the editor retains the current
            project when import fails.
          </li>
        </ul>
        <p>
          Errors prevent Karabiner export. Diagnostic codes and source paths
          appear in the compiler report. Version 1 does not accept arbitrary
          Karabiner objects as source actions.
        </p>
      </>
    ),
  },
  {
    id: "export",
    title: "Install in Karabiner",
    group: "Test & export",
    keywords:
      "export copy clipboard add your own rule edit paste install save complex modifications title rules one rule",
    summary: "Copy one complete rule into Karabiner’s built-in editor.",
    body: (
      <>
        <ol>
          <li>
            Resolve errors and apply any pending JSON edits. Choose{" "}
            <strong>Export to Karabiner</strong>.
          </li>
          <li>
            Choose <strong>Copy JSON</strong>. If clipboard access is denied,
            select the read-only JSON and copy it manually.
          </li>
          <li>
            Open{" "}
            <strong>Karabiner-Elements Settings → Complex Modifications</strong>
            .
          </li>
          <li>
            For a new configuration, click <strong>Add your own rule</strong>.
            To replace an existing KMK configuration, click that rule’s{" "}
            <strong>Edit</strong> button.
          </li>
          <li>
            Replace the entire editor contents with the copied JSON, save, and
            enable the rule.
          </li>
        </ol>
        <figure className="docs-shot">
          <img
            src="/help/karabiner-add-rule.png"
            width="1210"
            height="268"
            loading="lazy"
            alt="Karabiner Complex Modifications settings, with Add your own rule beside Add predefined rule."
          />
          <figcaption>
            Choose Add your own rule in Complex Modifications.
          </figcaption>
        </figure>
        <figure className="docs-shot">
          <img
            src="/help/karabiner-edit-rule.png"
            width="1550"
            height="162"
            loading="lazy"
            alt="An existing KMK rule with its enable switch and Edit button on the right."
          />
          <figcaption>Or Edit an existing KMK rule to replace it.</figcaption>
        </figure>
        <p>
          The modal contains one rule object with <code>description</code> and{" "}
          <code>manipulators</code>. The compiler’s full asset is{" "}
          <code>{`{ "title": "…", "rules": [rule] }`}</code>; the modal copies
          only <code>rules[0]</code>, which is what the built-in rule editor
          expects.
        </p>
        <Note>
          Keep the project together as one ordered rule. Temporal handlers and
          layer selectors depend on that order. Updating the existing rule
          avoids running two copies of the same configuration. KMK only prepares
          JSON; it never modifies your live Karabiner profile.
        </Note>
        <p>
          Save the KMK project separately for future editing. A generated
          Karabiner rule cannot be imported back as KMK source. The compiler
          targets <strong>Karabiner 16.3.0</strong>.
        </p>
      </>
    ),
  },
  {
    id: "compiler",
    title: "Compiler & reports",
    group: "Reference",
    keywords:
      "passes source map optimize metrics statistics efficient minimal report",
    summary: "Inspect how your specification becomes an ordered ruleset.",
    body: (
      <>
        <p>
          The <strong>Compiler</strong> tab shows manipulator count, timer
          sites, variables, and output size. Expand Generated Karabiner JSON,
          Source map, or State machines to inspect the result.{" "}
          <strong>Download report</strong> saves diagnostics, passes,
          statistics, and mappings separately from the installable rule.
        </p>
        <ol>
          <li>
            <strong>Validate and normalize:</strong> resolve defaults and
            references; reject invalid combinations.
          </li>
          <li>
            <strong>Elaborate:</strong> build timed states for presses,
            releases, holds, continuation, interruption, and cleanup.
          </li>
          <li>
            <strong>Analyze interactions:</strong> resolve layer precedence,
            ownership, and ordering between bindings.
          </li>
          <li>
            <strong>Simplify:</strong> remove unreachable or equivalent states
            conservatively.
          </li>
          <li>
            <strong>Lower:</strong> choose native primitives or guarded
            variables and delayed actions, with continuation handlers before
            initiation.
          </li>
          <li>
            <strong>Optimize and emit:</strong> remove proven redundancies,
            preserve dependencies, and emit deterministic JSON with source
            mappings.
          </li>
        </ol>
        <p>
          “Minimal” means conservative optimization, not a proof of the smallest
          possible program. The priorities are fewer manipulators, timers,
          condition evaluations, then variables. Timer sites are static counts,
          not the number of callbacks scheduled by a particular input trace.
        </p>
      </>
    ),
  },
  {
    id: "limits",
    title: "Limits & troubleshooting",
    group: "Reference",
    keywords:
      "unsupported caps stuck modifier delayed lag lost disconnect device version troubleshooting limits sequence raw",
    summary: "Understand supported behavior and engine boundaries.",
    body: (
      <>
        <div className="docs-table">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Version 1 limit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Project</td>
                <td>16 layers, 512 bindings; one binding per key per layer.</td>
              </tr>
              <tr>
                <td>Tap dance</td>
                <td>
                  1–3 contiguous stages, each with a tap and optional hold.
                </td>
              </tr>
              <tr>
                <td>Gesture timing</td>
                <td>1–5000 ms, anchored at key-down.</td>
              </tr>
              <tr>
                <td>One-shot expiry</td>
                <td>1–60000 ms, or omit expiry to wait indefinitely.</td>
              </tr>
              <tr>
                <td>Sequences</td>
                <td>
                  1–32 actions per sequence; nesting depth limited to 4. No held
                  sequences, momentary layers, or transparent actions inside
                  them.
                </td>
              </tr>
              <tr>
                <td>Input scope</td>
                <td>
                  One logical keyboard stream. Concurrent identical key
                  identities from multiple physical keyboards are outside the
                  supported contract.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Version 1 does not support simultaneous multi-key input chords,
          arbitrary state-machine authoring, per-binding app/device selectors,
          release-anchored gesture timers, or unrestricted raw Karabiner
          insertion. Output modifier shortcuts are supported.
        </p>
        <h3>Why does a single tap feel delayed?</h3>
        <p>
          If a longer tap gesture exists, KMK waits until it is impossible
          before committing the shorter tap. Reduce the tap window, remove
          unused later stages, or use a simple remap when immediate output
          matters.
        </p>
        <h3>Why did the next key use Base?</h3>
        <p>
          Check whether the layer was activated, whether a higher-priority layer
          won, whether the key is transparent, and whether a one-shot expired or
          was consumed. Selecting a layer in the sidebar only changes what you
          edit. The playground’s state transitions make these decisions visible.
        </p>
        <h3>What if I change rules or disconnect a keyboard mid-gesture?</h3>
        <p>
          Finish gestures before enabling, disabling, or replacing rules.
          Karabiner can destroy pending callbacks when a rule is disabled and
          key-up contexts when a device disappears, leaving a pending tap lost
          or custom state uncleared. Restart Karabiner if abnormal teardown
          leaves stale state. These engine lifecycle cases are outside the
          uninterrupted-session guarantee.
        </p>
        <p>
          A terminal stage without a hold uses the engine’s maximum delay to
          retain its cancellation hook. Holding it continuously for more than
          about 24.8 days is outside the supported trace horizon. Expired
          one-shot variables may remain inert until the next consuming key; they
          do not keep the layer logically active.
        </p>
      </>
    ),
  },
];
