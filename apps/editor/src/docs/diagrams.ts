export const diagrams = {
  taps: `stateDiagram-v2
    direction TB
    [*] --> Idle
    Idle --> FirstDown: first key-down
    FirstDown --> Waiting: release before 250 ms
    FirstDown --> Drain: deadline or other key / single tap
    Waiting --> SecondDown: same key down before deadline
    Waiting --> Idle: deadline or other key / single tap
    SecondDown --> Idle: release / double tap
    SecondDown --> Drain: other key / double tap
    Drain --> Idle: original key releases
    state "Wait for second tap" as Waiting
    state "Wait for original release" as Drain
`,
  holds: `stateDiagram-v2
    direction TB
    [*] --> Idle
    Idle --> Pending: Caps Lock down
    Pending --> Idle: release before 200 ms / Escape
    Pending --> ControlHeld: 200 ms while down / Control down
    Pending --> ControlHeld: other key / Control down first
    ControlHeld --> Idle: Caps Lock up / Control up
    state "Deciding tap or hold" as Pending
    state "Control held by Caps Lock" as ControlHeld
`,
  stages: `stateDiagram-v2
    direction TB
    [*] --> FirstDown
    FirstDown --> FirstHeld: hold threshold / first hold
    FirstDown --> WaitSecond: release before threshold
    WaitSecond --> SecondDown: press before first deadline
    SecondDown --> SecondHeld: hold threshold / second hold
    SecondDown --> WaitThird: release before threshold
    WaitThird --> ThirdDown: press before second deadline
    ThirdDown --> ThirdHeld: hold threshold / third hold
    ThirdDown --> Done: release before threshold / third tap
    WaitSecond --> Done: deadline / first tap
    WaitThird --> Done: deadline / second tap
    FirstHeld --> Done: original key up / release hold
    SecondHeld --> Done: original key up / release hold
    ThirdHeld --> Done: original key up / release hold
    Done --> [*]
`,
  layers: `flowchart TD
    A[Key-down: start at highest active layer] --> B[Inspect current layer]
    B --> C{Binding for this key?}
    C -->|Missing or transparent| D{Lower active layer?}
    D -->|Yes| L[Move to next lower active layer]
    L --> B
    D -->|No| E[Pass through the original key]
    C -->|Do nothing| F[Consume key without output]
    C -->|Remap or tap dance| G[Choose and retain this binding]
    G --> H[Release and cleanup follow the original key]
`,
  oneshot: `stateDiagram-v2
    direction TB
    [*] --> Idle
    Idle --> Armed: one-shot action fires
    Armed --> Armed: modifier down / keep waiting
    Armed --> Armed: another one-shot / replace target and deadline
    Armed --> Selected: non-modifier down before expiry / choose binding
    Selected --> Idle: consume activation, then run chosen binding
    Armed --> Idle: Escape down / cancel and swallow
    Armed --> Idle: optional deadline reached / no output
    state "Overlay armed" as Armed
    state "Binding retained for this gesture" as Selected
`,
} as const;
