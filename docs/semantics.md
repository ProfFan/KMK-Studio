# Version 1 semantic contract

## Gestures

Each dance has one to three contiguous stages, each with a required `tap` and optional `hold`. A new physical press chooses its binding from the active layers; continuations retain that binding even if layers change. A repeated OS key-down while the key is still held is not another tap. Every additional tap needs an intervening release.

Defaults are a 250 ms continuation window and 200 ms hold threshold. Global settings and per-binding overrides accept integer milliseconds from 1 through 5000. Each stage anchors both timers at its own key-down. Due timers run before input with the same timestamp. Hold wins when its threshold equals the continuation deadline.

| Situation                                               | Decision                                                |
| ------------------------------------------------------- | ------------------------------------------------------- |
| Last available stage releases before its hold threshold | Emit that stage's tap immediately                       |
| Earlier stage releases                                  | Wait for a continuation, timeout, or unrelated press    |
| Earlier stage reaches the continuation deadline         | Emit its tap, even if still physically down             |
| Stage reaches its hold threshold while down             | Activate hold; suppress every tap prefix                |
| Same key presses again after release, before deadline   | Continue to next stage; suppress the previous tap       |
| Unrelated press while waiting after release             | Commit the completed tap before handling the other key  |
| Unrelated press while down, policy `tap`                | Commit the current tap before handling the other key    |
| Unrelated press while down, policy `hold`               | Activate its hold, if present; otherwise commit its tap |

Terminal stages without holds have no ordinary continuation timeout. The backend keeps their cancellation hook armed with Karabiner's maximum signed 32-bit millisecond delay (about 24.8 days). A continuously held terminal input beyond that duration is outside the supported trace horizon.

The default interruption policy is `hold` when any stage holds a modifier or layer; otherwise it is `tap`. Policy is per binding. Hold-on-interruption supports modifier keys, momentary or one-shot layers, and blocked output. Ordinary held keys and consumer keys require `tap` interruption: they can still activate at the hold threshold. Unsupported combinations produce errors rather than approximate output. Where any stage has a hold, its threshold must be no later than the continuation window.

Held outputs are tied to the originating physical key and end on its release. A discrete tap or sequence does not repeat; an ordinary held mapping retains Karabiner's normal repeat behavior. The simulators show physical press/release decisions, not OS-generated auto-repeat events.

## Actions and modifiers

Actions are `key` (optional explicit left/right modifiers), `consumer`, finite `sequence`, `layer`, `block`, and `transparent`. Sequences emit discrete actions in order. Momentary layers and transparency cannot appear in sequences. A hold selects one output; sequences are not hold actions.

Modifier behavior deliberately follows the pinned native engine. Delayed/canceled taps restore the modifier snapshot captured at the corresponding stage's key-down. Terminal release-triggered taps use modifiers active at release. Explicit shortcut modifiers apply to the generated action; they do not turn later unrelated input into part of that shortcut. A modifier **key** used as a hold does modify subsequent input. Karabiner can defer a modifier HID update while retaining correct logical modifier ownership.

Generated output is not fed back through the same Complex Modifications pass. Mapping A → B does not invoke a KMK binding on B.

## Layers

`layers[0]` is the always-active base. Later entries have higher priority. Missing keys and transparent bindings fall through; blocked bindings consume the key. Priority is explicit in array order and can be adjusted in the editor.

- `momentary`: activate an overlay until its originating key releases. Each binding has its own ownership variable; overlapping activators do not cancel each other.
- `toggle`: flip the overlay's persistent activation bit. Releasing a momentary owner does not clear that bit.
- `set`: clear all other persistent, momentary, and one-shot activation, then select this layer. Selecting base returns to base alone. Subsequent key-downs can activate overlays again.

- `oneshot`: activate an overlay for the next non-modifier key-down. Omit `timeoutMs` to wait indefinitely, or use an integer from 1 through 60000 ms. Expiry starts when the action fires, not when its gesture begins. At the exact expiry timestamp the overlay is inactive. Expiry produces no output.

One-shot activation follows the same layer priority as every other overlay. A key chooses its binding before consuming the one-shot activation. Missing/transparent keys use their normal lower-layer binding and still consume it; blocked keys also consume it. Command, Control, Shift, Option, and Fn do not consume it. Escape cancels an active one-shot and is swallowed; without an active one-shot Escape behaves normally. A single one-shot can be armed at a time: another activation replaces it. The consuming binding can arm a new one-shot for the following key. Momentary owners and toggle bits remain intact when a one-shot is consumed or expires.

A selected tap dance retains its complete continuation/hold/release behavior after consumption. A held output remains held until its original physical key releases, even after the expiry time. A pending gesture that arms a one-shot on interruption makes that activation available to the interrupting key; late cancellation callbacks cannot re-arm the consumed activation.

Use `{ "type": "layer", "layer": "nav", "mode": "oneshot", "timeoutMs": 1000 }` as a mapping, tap, hold, or sequence action. TypeScript helpers are `oneShot("nav", 1000)` and `oneShot("nav")`. The latter has no expiry. A one-shot hold fires at the hold decision and persists after the activator releases, unlike a momentary hold.

Expiry uses Karabiner's `system.now.milliseconds` clock. No expiry callback is scheduled: selectors ignore an expired deadline, and a later consuming key clears the stored activation. Consequently an idle expired activation can leave inert variable values in the engine; it does not leave an active layer. The specification timeline shows the logical expiration.

Layers and gesture phases are separate. Continuation handlers run before initiation handlers. When an unrelated key resolves a pending layer action, selection for that key accounts for that layer effect even when its cancellation callback occurs later in Karabiner's manipulator loop. Releases always use the binding that consumed the original key-down.

## Global device filter

Omitting `Project.deviceFilter` keeps the existing all-device behavior. `{ "type": "vendor_product", "vendorId": 1452, "productId": 832 }` requires both decimal IDs to match; `{ "type": "built_in_keyboard" }` selects Karabiner's built-in keyboard flag. IDs must be nonnegative safe integers. A VID/PID identifies a device model, not one unique physical unit.

Every generated manipulator has the same `device_if` condition, including continuation, one-shot cancellation, modifier pass-through, and catch-all handlers. Selection is gated at key-down; existing release contexts and timer callbacks retain their original ownership. This follows native Karabiner semantics: input from another device can still interrupt an already pending gesture, and held modifier outputs affect the shared modifier state. The filter is not per-device isolation of gesture or layer variables.

The specification and generated-rule simulators accept device properties as an optional fourth argument: `simulateProject(project, events, until, device)` and `simulateKarabiner(asset, events, until, device)`. The device describes one logical stream with `vendor_id`, `product_id`, and/or `is_built_in_keyboard`. Omitted properties mean an unknown device, which does not match the corresponding filter. The editor playground supplies the selected target's properties because a browser cannot identify physical keyboards.

## Trace and lifecycle boundaries

Both simulators accept `{at, type, key}` events with nonnegative, nondecreasing integer millisecond timestamps. Keys use Karabiner identities. Duplicate physical downs and unmatched ups are ignored. `until` observes a prefix at or after the last input; otherwise the simulator advances enough to settle all normal timers.

`reset` starts a fresh simulator session, releasing simulated outputs and clearing state. It is not a claim that a generated rule can observe an operating-system reset. `invalidate` models disabling the rule: existing held key contexts retain their key-up cleanup, while new presses pass through.

**Native limitation:** disabling a rule after a key releases can destroy its pending delayed-action callback. The engine may discard that pending tap and retain its custom variables. Device removal can likewise remove key-up contexts without executing custom variable cleanup. A compiler cannot execute callbacks in a rule the engine has deleted. Finish gestures before changing the enabled configuration; restart Karabiner after abnormal device/rule teardown if stale state remains. These cases are documented and tested as engine boundaries, not included in the supported uninterrupted-session guarantee.

V1 uses one logical keyboard stream. Concurrent presses of the same key identity from multiple physical keyboards, per-binding app/device selectors, multi-key chords, release-anchored timers, arbitrary state machines, and raw Karabiner insertion are outside scope. Source fields outside the typed version-1 model are not an escape hatch for raw rules. Validation limits projects to 16 layers and 512 bindings.
