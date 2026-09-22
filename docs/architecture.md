# Compiler architecture and provenance

The runtime compiler is independent TypeScript. It does not use Goku, karabiner.ts, or Greg's extensions as implementation dependencies. Those projects informed the research; the pinned Karabiner engine determines backend behavior.

## Passes

1. **Validate and normalize.** Validate identities, references, key/action catalogs, duplicate bindings, timings, and supported interruption/hold combinations. Clone the source, resolve timings and policies, and canonicalize modifier sets. Invalid inputs return diagnostics without an asset.
2. **Elaborate.** Produce a finite gesture-template IR containing stage actions, timing, interruption, owner identity, and explicit down/wait/held/resolved transitions. This IR drives temporal lowering and is returned in explanations. The language deliberately does not expose arbitrary automata.
3. **Analyze interactions.** Compute layer reachability, owner variables, layer precedence, and global continuation-before-initiation dependencies. Layer selectors project the effects of pending interruptions, which removes dependence on the incoming binding's position relative to a cancellation callback.
4. **Simplify.** Remove unreachable template states and overlays. Partition-refine states using observable actions, timing, owner identity, and transition signatures; merge only equivalent states. Lowering can retain separate stage phases to protect callback lifetimes even when semantic states are equivalent.
5. **Lower.** Ordinary remaps use one native basic manipulator with no timer or gesture variable. A temporal binding uses one manipulator per stage, a shared phase variable, guarded delayed actions, optional held-down callbacks, and lazy modifier ownership. Phase guards make obsolete callbacks inert. Momentary activators have independent ownership variables.
6. **Optimize and emit.** Eliminate unreachable timeout actions, transient terminal writes, empty fields, and duplicate conditions. Keep dependency order stable. Emit one `{title,rules}` asset and a separate source map/report. `optimize:false` retains redundant states/actions for conformance comparison.

Statistics count static manipulator sites, timer sites (delayed + held-down), condition sites, written variables, compact UTF-8 JSON bytes, and IR states. They are not runtime instruction counts. Native expressions are used for layer activation and toggles; timestamp expressions implement silent one-shot expiry without adding timers. Completed tap output still requires a callback when no further input arrives. Optimization is conservative, not globally minimal.

## Why the backend is structured this way

An optional project-wide device filter is lowered at the common manipulator emission point, so mappings, continuations, and one-shot helpers all receive a `device_if` guard. It adds one condition per manipulator without adding variables, timers, or manipulators. Device restrictions do not guard existing output cleanup or delayed callbacks; those remain owned by the originating context as in the native engine.

Karabiner stops matching after the first manipulator consumes a key, yet basic manipulators run cancellation logic before that validity check. A continuation must therefore run before the previous stage's cancellation callback. Every delayed output and cleanup checks the old phase, so the old callback cannot erase the newly started stage.

Conditions on output actions share a snapshot from the start of their action list. Variable expressions themselves see sequential writes. The lowering and JSON interpreter model those as different operations. Held key output must occupy the final position in its `to` list to remain owned until physical release. Layer changes must not make an originating release disappear.

One-shot state is separate from toggles, momentary owners, and gesture phases: a project-wide target ID and optional deadline. On selection, consuming rules clear this state before emitting their own action, allowing a chain to arm the next activation. Modifier pass-through handlers precede the catch-all consumption handler; Escape cancellation precedes gesture handlers. These handlers are emitted only for projects that use one-shot actions.

A project with temporal one-shot actions also uses a cancellation acknowledgement variable. An incoming gesture records which pending arm its selection has already consumed. That old binding's cancellation callback skips only its one-shot writes, preserving its other outputs and cleanup. This handles callbacks on either side of the first matching rule without replaying generated key events. Selection expressions project both ordinary layer effects and the last one-shot/set operation in a pending sequence.

The specification interpreter stores gesture decisions and layer ownership directly. The JSON interpreter knows only the emitted Karabiner subset: ordered matching, contexts, timers, conditions, expressions, lazy modifiers, and releases. Neither interpreter calls the other's transition functions, and the JSON interpreter has no KMK phase decoding. Native-engine tests prevent the two TypeScript models from agreeing on the same mistaken engine assumption.

## Research sources

- [GokuRakuJoudo](https://github.com/yqrashawn/GokuRakuJoudo): concise named configuration and layer expansion. KMK uses versioned JSON plus typed constructors and explicit diagnostics.
- [karabiner.ts](https://github.com/evan-liu/karabiner.ts): typed builders and synthesized double taps. KMK's cancellation path preserves a pending completed tap rather than only resetting a recognition flag.
- [Greg's extensions](https://github.com/gregorias/karabiner.ts-greg-mods): richer tap/hold behavior and practical rollover/modifier concerns. KMK includes both rollover orders and modifier changes in independent and native tests.
- [Karabiner evaluation priority](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-evaluation-priority/): first-match behavior.
- [Output-condition snapshots](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/to/to-conditions/): action-list condition evaluation.
- [Pinned upstream harness](https://github.com/pqrs-org/Karabiner-Elements/blob/v16.3.0/tests/src/share/manipulator_helper.hpp) and [basic manipulator implementation](https://github.com/pqrs-org/Karabiner-Elements/blob/v16.3.0/src/share/manipulator/manipulators/basic/basic.hpp): native conformance and lifecycle behavior.

The native harness is fetched into `.cache/karabiner` with upstream licenses intact. Its source is not copied into the application or redistributed as a KMK compiler dependency.
