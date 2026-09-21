import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  compile,
  CONSUMER_KEYS,
  exampleProject,
  holdPolicy,
  KEY_CODES,
  key,
  keyLabel,
  validate,
  type Action,
  type Behavior,
  type Binding,
  type InputEvent,
  type Project,
} from "@kmk/compiler";
import { simulateProject } from "@kmk/simulator";
import { layoutRows } from "./layouts.ts";
import { ExportDialog } from "./ExportDialog.tsx";
import "./style.css";

const STORAGE = "kmk.project.v1";
const clone = <T,>(x: T): T => structuredClone(x);
const newId = () => crypto.randomUUID().slice(0, 8);
const download = (value: unknown, name: string) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function load(): { p: Project; message: string } {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const p = JSON.parse(raw);
      if (!validate(p).some((d) => d.severity === "error")) {
        if (p.id === "studio" && p.name === "Everyday, reimagined")
          p.name = "Default Project";
        return { p, message: "" };
      }
      return {
        p: exampleProject(),
        message:
          "The saved project could not be loaded. Your saved data has been left intact; import a valid project to recover.",
      };
    }
  } catch {
    return {
      p: exampleProject(),
      message:
        "Local storage is unavailable. Use Save project to keep your work.",
    };
  }
  return { p: exampleProject(), message: "" };
}
const initial = load();

function ActionEditor({
  value,
  onChange,
  project,
  hold = false,
  mapping = false,
  depth = 0,
}: {
  value: Action;
  onChange: (a: Action) => void;
  project: Project;
  hold?: boolean;
  mapping?: boolean;
  depth?: number;
}) {
  return (
    <div className="action-editor">
      <div className="field-pair">
        <label>
          Action
          <select
            aria-label="Action type"
            value={value.type}
            onChange={(e) => {
              const t = e.target.value;
              onChange(
                t === "key"
                  ? key("escape")
                  : t === "consumer"
                    ? { type: "consumer", key: "play_or_pause" }
                    : t === "layer"
                      ? {
                          type: "layer",
                          layer: project.layers[1]?.id ?? project.layers[0].id,
                          mode: hold ? "momentary" : "toggle",
                        }
                      : t === "sequence"
                        ? { type: "sequence", actions: [key("a")] }
                        : { type: t as "block" | "transparent" },
              );
            }}
          >
            <option value="key">Key / shortcut</option>
            <option value="consumer">Media key</option>
            <option value="layer">Layer</option>
            {!hold && depth === 0 && <option value="sequence">Sequence</option>}
            <option value="block">Do nothing</option>
            {mapping && depth === 0 && (
              <option value="transparent">Transparent</option>
            )}
          </select>
        </label>
        {(value.type === "key" || value.type === "consumer") && (
          <label>
            Output
            <select
              aria-label="Output key"
              value={value.key}
              onChange={(e) => onChange({ ...value, key: e.target.value })}
            >
              {(value.type === "key" ? KEY_CODES : CONSUMER_KEYS).map((k) => (
                <option key={k} value={k}>
                  {keyLabel(k)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {value.type === "key" && (
        <div className="modifier-options" aria-label="Output modifiers">
          {(
            [
              "left_command",
              "left_shift",
              "left_option",
              "left_control",
            ] as const
          ).map((m) => (
            <button
              key={m}
              className={value.modifiers?.includes(m) ? "active" : ""}
              title={m}
              aria-pressed={value.modifiers?.includes(m) ?? false}
              onClick={() =>
                onChange({
                  ...value,
                  modifiers: value.modifiers?.includes(m)
                    ? value.modifiers.filter((x) => x !== m)
                    : [...(value.modifiers ?? []), m],
                })
              }
            >
              {keyLabel(m)}
            </button>
          ))}
        </div>
      )}
      {value.type === "layer" && (
        <>
          <div className="field-pair">
            <label>
              Layer
              <select
                aria-label="Layer target"
                value={value.layer}
                onChange={(e) => onChange({ ...value, layer: e.target.value })}
              >
                {project.layers.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mode
              <select
                aria-label="Layer mode"
                value={value.mode}
                onChange={(e) =>
                  onChange({
                    ...value,
                    mode: e.target.value as typeof value.mode,
                    timeoutMs: undefined,
                  })
                }
              >
                <option value="oneshot">One-shot</option>
                {hold ? (
                  <option value="momentary">While held</option>
                ) : (
                  <>
                    <option value="toggle">Toggle</option>
                    <option value="set">Select only</option>
                    {mapping && <option value="momentary">While held</option>}
                  </>
                )}
              </select>
            </label>
          </div>
          {value.mode === "oneshot" && (
            <>
              <label className="hold-switch">
                <input
                  type="checkbox"
                  aria-label="One-shot expiry"
                  checked={value.timeoutMs !== undefined}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      timeoutMs: e.target.checked ? 1000 : undefined,
                    })
                  }
                />
                Expire if unused
              </label>
              {value.timeoutMs !== undefined && (
                <label className="oneshot-timeout">
                  Expires after
                  <span className="number-input">
                    <input
                      type="number"
                      aria-label="One-shot timeout"
                      min={1}
                      max={60000}
                      value={value.timeoutMs}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          timeoutMs: Number(e.target.value),
                        })
                      }
                    />
                    <span>ms</span>
                  </span>
                </label>
              )}
              <p className="hint">
                Next non-modifier key consumes this layer. Escape cancels.{" "}
                {value.timeoutMs === undefined
                  ? "Stays armed until used."
                  : "Expiry starts when this action fires."}
              </p>
            </>
          )}
        </>
      )}
      {value.type === "sequence" && (
        <div className="sequence">
          {value.actions.map((a, i) => (
            <div key={i}>
              <span className="sequence-number">{i + 1}</span>
              <ActionEditor
                value={a}
                project={project}
                depth={depth + 1}
                onChange={(a) =>
                  onChange({
                    ...value,
                    actions: value.actions.map((x, j) => (i === j ? a : x)),
                  })
                }
              />
              <button
                className="text-button"
                onClick={() =>
                  onChange({
                    ...value,
                    actions: value.actions.filter((_, j) => i !== j),
                  })
                }
              >
                Remove step
              </button>
            </div>
          ))}
          <button
            className="text-button"
            onClick={() =>
              onChange({ ...value, actions: [...value.actions, key("a")] })
            }
          >
            + Add key
          </button>
        </div>
      )}
    </div>
  );
}

const presets: Record<string, InputEvent[]> = {
  "Single tap": [
    { at: 0, type: "down", key: "spacebar" },
    { at: 60, type: "up", key: "spacebar" },
  ],
  "Double tap": [
    { at: 0, type: "down", key: "spacebar" },
    { at: 50, type: "up", key: "spacebar" },
    { at: 130, type: "down", key: "spacebar" },
    { at: 180, type: "up", key: "spacebar" },
  ],
  "Triple tap": [
    { at: 0, type: "down", key: "spacebar" },
    { at: 30, type: "up", key: "spacebar" },
    { at: 90, type: "down", key: "spacebar" },
    { at: 120, type: "up", key: "spacebar" },
    { at: 180, type: "down", key: "spacebar" },
    { at: 210, type: "up", key: "spacebar" },
  ],
  "Hold + key": [
    { at: 0, type: "down", key: "caps_lock" },
    { at: 300, type: "down", key: "h" },
    { at: 360, type: "up", key: "h" },
    { at: 420, type: "up", key: "caps_lock" },
  ],
};
function Timeline({
  project,
  selectedKey,
  paused,
}: {
  project: Project;
  selectedKey: string;
  paused: boolean;
}) {
  const [events, setEvents] = useState<InputEvent[]>(presets["Double tap"]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [capture, setCapture] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(0);
  let result;
  try {
    result = simulateProject(project, events);
  } catch (e) {
    result = null;
  }
  const output = result?.output.filter((e) => e.type === "down") ?? [];
  const keyFor = (e: KeyboardEvent) => {
    const codes: Record<string, string> = {
      Space: "spacebar",
      CapsLock: "caps_lock",
      Enter: "return_or_enter",
      Escape: "escape",
      Tab: "tab",
      Backspace: "delete_or_backspace",
      ShiftLeft: "left_shift",
      ShiftRight: "right_shift",
      ControlLeft: "left_control",
      ControlRight: "right_control",
      AltLeft: "left_option",
      AltRight: "right_option",
      MetaLeft: "left_command",
      MetaRight: "right_command",
      ArrowLeft: "left_arrow",
      ArrowRight: "right_arrow",
      ArrowUp: "up_arrow",
      ArrowDown: "down_arrow",
      Semicolon: "semicolon",
      Quote: "quote",
      Comma: "comma",
      Period: "period",
      Slash: "slash",
      Minus: "hyphen",
      Equal: "equal_sign",
      BracketLeft: "open_bracket",
      BracketRight: "close_bracket",
      Backslash: "backslash",
      Backquote: "grave_accent_and_tilde",
    };
    return (
      codes[e.code] ??
      (/^Key[A-Z]$/.test(e.code)
        ? e.code.slice(3).toLowerCase()
        : /^Digit\d$/.test(e.code)
          ? e.code.slice(5)
          : /^F\d+$/.test(e.code)
            ? e.code.toLowerCase()
            : undefined)
    );
  };
  useEffect(() => {
    if (paused) {
      setCapture(false);
      return;
    }
    if (!capture) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.repeat) return;
      const k = keyFor(e);
      if (k)
        setEvents((old) =>
          [
            ...old,
            {
              at: Math.round(performance.now() - started.current),
              type: e.type === "keydown" ? ("down" as const) : ("up" as const),
              key: k,
            },
          ].slice(-100),
        );
    };
    const stop = () => setCapture(false);
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
      window.removeEventListener("blur", stop);
    };
  }, [capture, paused]);
  const max = Math.max(
    600,
    ...events.map((e) => e.at),
    ...output.map((e) => e.at),
  );
  return (
    <section className="timeline panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TRY IT BEFORE YOU EXPORT</span>
          <h2>
            Gesture playground <span className="pill">Simulation</span>
          </h2>
        </div>
        <button
          className={capture ? "record recording" : "record"}
          onClick={() => {
            if (!capture) {
              setEvents([]);
              started.current = performance.now();
            }
            setCapture(!capture);
          }}
        >
          <span /> {capture ? "Stop recording" : "Record keys"}
        </button>
      </div>
      <div className="preset-row">
        {Object.keys(presets).map((name) => (
          <button
            key={name}
            onClick={() => {
              setCapture(false);
              setEvents(
                presets[name].map((e) => ({
                  ...e,
                  key:
                    name === "Hold + key" && e.key === "h" ? "h" : selectedKey,
                })),
              );
              setError("");
            }}
          >
            {name}
          </button>
        ))}
        <button
          className="text-button"
          onClick={() => {
            setDraft(JSON.stringify(events, null, 2));
            setEditing(!editing);
          }}
        >
          Edit trace ↗
        </button>
      </div>
      {capture && (
        <p className="hint capture-hint">
          Recording in this window. macOS shortcuts, Fn, and browser-reserved
          keys may not reach the browser. Use Edit trace for those keys.
        </p>
      )}
      {editing && (
        <div className="trace-editor">
          <textarea
            aria-label="Event trace"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <button
            onClick={() => {
              try {
                const v = JSON.parse(draft);
                if (
                  !Array.isArray(v) ||
                  v.some(
                    (e) =>
                      !Number.isFinite(e.at) ||
                      !["up", "down", "reset", "invalidate"].includes(e.type),
                  )
                )
                  throw new Error(
                    "Use an array of timestamped down/up/reset/invalidate events.",
                  );
                simulateProject(project, v);
                setEvents(v);
                setError("");
                setEditing(false);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Apply trace
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <div className="timeline-chart">
        <div className="time-scale">
          <span>0 ms</span>
          <span>{Math.round(max / 2)} ms</span>
          <span>{max} ms</span>
        </div>
        <div className="track">
          <span className="track-label">INPUT</span>
          {events.map((e, i) => (
            <span
              title={`${e.at} ms · ${e.type} ${e.key ?? ""}`}
              className={`tick ${e.type}`}
              key={i}
              style={{ left: `${Math.min(96, (e.at / max) * 96)}%` }}
            >
              <i />
              {e.type === "down" ? keyLabel(e.key ?? "") : ""}
            </span>
          ))}
        </div>
        <div className="track output-track">
          <span className="track-label">OUTPUT</span>
          {output.map((e, i) => (
            <span
              className="output-chip"
              title={`${e.at} ms`}
              key={i}
              style={{ left: `${Math.min(88, (e.at / max) * 96)}%` }}
            >
              {keyLabel(e.key)}
            </span>
          ))}
        </div>
      </div>
      <div className="trace-summary" aria-live="polite">
        {output.length ? (
          <>
            <span className="success-dot" />
            <strong>{output.map((e) => keyLabel(e.key)).join(" → ")}</strong>
            <span>
              {output.length} action{output.length === 1 ? "" : "s"} · resolved
              by the specification
            </span>
          </>
        ) : (
          <span>No key output in this trace.</span>
        )}
      </div>
      <details className="trace-details">
        <summary>Inspect layer and pending-state transitions</summary>
        <div className="frame-list">
          {result?.frames.map((f, i) => (
            <div key={i}>
              <code>{f.at} ms</code>
              <span>{f.event}</span>
              <span>{f.activeLayers.join(" + ")}</span>
              <span>{f.pending.join(", ") || "—"}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function App() {
  const [history, setHistory] = useState({
    past: [] as Project[],
    present: initial.p,
    future: [] as Project[],
  });
  const p = history.present;
  const [layerId, setLayerId] = useState(p.layers[0].id),
    [selected, setSelected] = useState("caps_lock"),
    [tab, setTab] = useState<"studio" | "json" | "compiler">("studio");
  const [notice, setNotice] = useState(initial.message),
    [search, setSearch] = useState(""),
    [json, setJson] = useState(JSON.stringify(p, null, 2)),
    [jsonError, setJsonError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const result = compile(p);
  const currentLayer = p.layers.find((l) => l.id === layerId) ?? p.layers[0];
  const binding = currentLayer.bindings.find((b) => b.key === selected);
  const commit = (next: Project) => {
    setHistory((h) => ({
      past: [...h.past, h.present].slice(-100),
      present: next,
      future: [],
    }));
    setJson(JSON.stringify(next, null, 2));
    setJsonError("");
  };
  const modify = (fn: (p: Project) => void) => {
    const next = clone(p);
    fn(next);
    commit(next);
  };
  useEffect(() => {
    if (!result.ok || (initial.message && p === initial.p)) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(p));
    } catch {
      setNotice("Autosave is unavailable. Use Save project to keep your work.");
    }
  }, [p]);
  const undo = (forward = false) =>
    setHistory((h) => {
      const list = forward ? h.future : h.past;
      if (!list.length) return h;
      const next = list.at(-1)!;
      setJson(JSON.stringify(next, null, 2));
      setJsonError("");
      return forward
        ? {
            past: [...h.past, h.present],
            present: next,
            future: h.future.slice(0, -1),
          }
        : {
            past: h.past.slice(0, -1),
            present: next,
            future: [...h.future, h.present],
          };
    });
  const setBehavior = (behavior: Behavior) =>
    modify((p) => {
      const l = p.layers.find((l) => l.id === currentLayer.id)!;
      const i = l.bindings.findIndex((b) => b.key === selected);
      const b: Binding = {
        id: i < 0 ? `key-${newId()}` : l.bindings[i].id,
        key: selected,
        behavior,
      };
      if (i < 0) l.bindings.push(b);
      else l.bindings[i] = b;
    });
  const resetBinding = () =>
    modify((p) => {
      const l = p.layers.find((l) => l.id === currentLayer.id)!;
      l.bindings = l.bindings.filter((b) => b.key !== selected);
    });
  const total = p.layers.reduce((n, l) => n + l.bindings.length, 0);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#" className="brand" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <strong>
            kmk<span> / studio</span>
          </strong>
        </a>
        <div className="workspace-label">
          <span className="status-dot" /> LOCAL WORKSPACE
        </div>
        <label className="project-name">
          PROJECT
          <input
            aria-label="Project name"
            value={p.name}
            onChange={(e) =>
              modify((p) => {
                p.name = e.target.value;
              })
            }
          />
        </label>
        <div className="sidebar-heading">
          <span>LAYERS</span>
          <button
            title="Add layer"
            aria-label="Add layer"
            onClick={() => {
              const id = `layer-${newId()}`;
              modify((p) => {
                p.layers.push({
                  id,
                  name: `Layer ${p.layers.length}`,
                  bindings: [],
                });
              });
              setLayerId(id);
            }}
          >
            +
          </button>
        </div>
        <div className="layers">
          {p.layers.map((l, i) => (
            <button
              className={`layer-button ${l.id === currentLayer.id ? "selected" : ""}`}
              key={l.id}
              onClick={() => setLayerId(l.id)}
            >
              <span className="layer-index">{String(i).padStart(2, "0")}</span>
              <span>
                {l.name}
                <small>
                  {i === 0
                    ? "Always active"
                    : `${l.bindings.length} assignments`}
                </small>
              </span>
              <span className="layer-dot" />
            </button>
          ))}
        </div>
        <div className="layer-controls">
          <input
            aria-label="Layer name"
            value={currentLayer.name}
            onChange={(e) =>
              modify((p) => {
                p.layers.find((l) => l.id === currentLayer.id)!.name =
                  e.target.value;
              })
            }
          />
          {currentLayer !== p.layers[0] && (
            <div>
              <button
                className="text-button"
                onClick={() =>
                  modify((p) => {
                    const i = p.layers.findIndex(
                      (l) => l.id === currentLayer.id,
                    );
                    if (i > 1)
                      [p.layers[i - 1], p.layers[i]] = [
                        p.layers[i],
                        p.layers[i - 1],
                      ];
                  })
                }
              >
                ↑ Lower priority
              </button>
              <button
                className="text-button danger"
                onClick={() => {
                  modify((p) => {
                    p.layers = p.layers.filter((l) => l.id !== currentLayer.id);
                  });
                  setLayerId(p.layers[0].id);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
        <div className="sidebar-note">
          <span>↳</span>
          <p>
            Higher layers take priority.
            <br />
            Transparent keys fall through.
          </p>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => importRef.current?.click()}>
            ↥ Import project
          </button>
          <button onClick={() => download(p, `${p.id}.kmk.json`)}>
            ↧ Save project
          </button>
          <div className="local-footer">
            <span className="status-dot" /> Private. Local. Yours.
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            Keyboard studio <span>/</span> <strong>{currentLayer.name}</strong>
          </div>
          <div className="top-actions">
            <span className="saved-label">
              {!result.ok
                ? "Invalid draft · not saved"
                : jsonError
                  ? "Unapplied JSON draft"
                  : notice
                    ? "Local project"
                    : "✓ Saved on this device"}
            </span>
            <button
              className="icon-button"
              aria-label="Undo"
              disabled={!history.past.length}
              onClick={() => undo()}
            >
              ↶
            </button>
            <button
              className="icon-button"
              aria-label="Redo"
              disabled={!history.future.length}
              onClick={() => undo(true)}
            >
              ↷
            </button>
            <button
              className="primary"
              disabled={!result.ok || !!jsonError}
              onClick={() => setExportOpen(true)}
            >
              Export to Karabiner <span>↗</span>
            </button>
          </div>
        </header>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR KEYBOARD. YOUR RULES.</span>
              <h1>{p.name}</h1>
              <p>More possibilities, one key at a time.</p>
            </div>
            <button
              className="subtle settings-toggle"
              onClick={() => setSettings(!settings)}
            >
              ⚙ Timing & layout
            </button>
          </div>
          {settings && (
            <section className="settings-panel panel">
              <label>
                Keyboard layout
                <select
                  aria-label="Keyboard layout"
                  value={p.layout}
                  onChange={(e) =>
                    modify((p) => {
                      p.layout = e.target.value as Project["layout"];
                    })
                  }
                >
                  <option value="mac">Mac laptop</option>
                  <option value="ansi">ANSI full-size</option>
                  <option value="tkl">Tenkeyless</option>
                  <option value="sixty">60%</option>
                </select>
              </label>
              {(["tapWindowMs", "holdMs"] as const).map((field) => (
                <label key={field}>
                  {field === "tapWindowMs" ? "Tap window" : "Hold threshold"}{" "}
                  (ms)
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={p.timing[field]}
                    onChange={(e) =>
                      modify((p) => {
                        p.timing[field] = Number(e.target.value);
                      })
                    }
                  />
                </label>
              ))}
            </section>
          )}
          <nav className="view-tabs" aria-label="Workspace view">
            {(["studio", "json", "compiler"] as const).map((v) => (
              <button
                key={v}
                className={tab === v ? "active" : ""}
                onClick={() => {
                  setTab(v);
                  if (v === "json" && !jsonError)
                    setJson(JSON.stringify(p, null, 2));
                }}
              >
                {v === "studio"
                  ? "⌨  Keymap"
                  : v === "json"
                    ? "{}  Project JSON"
                    : "◈  Compiler"}
                {v === "compiler" && (
                  <span className="tab-count">
                    {result.statistics.manipulators}
                  </span>
                )}
              </button>
            ))}
            <span className="view-status">
              <span className={result.ok ? "status-dot" : "error-dot"} />
              {result.ok
                ? "Ready to compile"
                : `${result.diagnostics.length} issues`}
            </span>
          </nav>
          {(result.diagnostics.length > 0 || jsonError) && (
            <div className="diagnostics" role="alert">
              {jsonError && <p>{jsonError}</p>}
              {result.diagnostics.map((d, i) => (
                <p key={i}>
                  <strong>{d.code}</strong> {d.message} <code>{d.path}</code>
                </p>
              ))}
            </div>
          )}
          {tab === "studio" && (
            <>
              <div className="editor-grid">
                <section className="keyboard-panel panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        LAYER{" "}
                        {String(p.layers.indexOf(currentLayer)).padStart(
                          2,
                          "0",
                        )}
                      </span>
                      <h2>{currentLayer.name}</h2>
                    </div>
                    <span className="small-muted">
                      {currentLayer.bindings.length} assignments
                    </span>
                  </div>
                  <div className={`keyboard-scroll layout-${p.layout}`}>
                    <div className="keyboard">
                      {layoutRows(p.layout).map((r, ri) => (
                        <div className="key-row" key={ri}>
                          {r.map((cap, ci) => {
                            const b = currentLayer.bindings.find(
                              (b) => b.key === cap.key,
                            );
                            const gesture = b?.behavior.type === "dance";
                            const action =
                              b?.behavior.type === "map"
                                ? b.behavior.action
                                : undefined;
                            return (
                              <button
                                key={`${cap.key}-${ci}`}
                                aria-label={`Key ${cap.key}`}
                                aria-pressed={selected === cap.key}
                                className={`keycap ${selected === cap.key ? "selected" : ""} ${gesture ? "gesture" : action && action.type !== "transparent" ? "assigned" : ""}`}
                                style={{ flex: cap.width ?? 1 }}
                                onClick={() => setSelected(cap.key)}
                              >
                                <span>{keyLabel(cap.key)}</span>
                                <small>
                                  {gesture
                                    ? "• •"
                                    : action
                                      ? action.type === "key"
                                        ? keyLabel(action.key)
                                        : action.type === "layer"
                                          ? "↳"
                                          : action.type === "block"
                                            ? "×"
                                            : "·"
                                      : ""}
                                </small>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="keyboard-legend">
                    <span>
                      <i className="legend-plain" /> Default
                    </span>
                    <span>
                      <i className="legend-map" /> Remapped
                    </span>
                    <span>
                      <i className="legend-dance" /> Tap dance
                    </span>
                    <span className="keyboard-tip">
                      Select a key to make it yours
                    </span>
                  </div>
                  <div className="key-search">
                    <span>⌕</span>
                    <input
                      aria-label="Search all keys"
                      placeholder="Find any key…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <div className="search-results">
                        {KEY_CODES.filter((k) =>
                          k.includes(search.toLowerCase()),
                        )
                          .slice(0, 12)
                          .map((k) => (
                            <button
                              key={k}
                              onClick={() => {
                                setSelected(k);
                                setSearch("");
                              }}
                            >
                              {keyLabel(k)} <small>{k}</small>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="feature-note">
                    <span className="spark">✳</span>
                    <div>
                      <strong>A little key. A lot of potential.</strong>
                      <p>
                        Assign distinct actions to taps and holds. KMK takes
                        care of the timing.
                      </p>
                    </div>
                  </div>
                </section>
                <aside className="inspector panel">
                  <div className="inspector-header">
                    <div>
                      <span className="eyebrow">SELECTED KEY</span>
                      <h2>{selected.replaceAll("_", " ")}</h2>
                    </div>
                    <span className="preview-key">{keyLabel(selected)}</span>
                  </div>
                  <label>
                    Behavior
                    <select
                      aria-label="Behavior"
                      value={binding?.behavior.type ?? "default"}
                      onChange={(e) => {
                        if (e.target.value === "default") resetBinding();
                        else if (e.target.value === "map")
                          setBehavior({ type: "map", action: key(selected) });
                        else
                          setBehavior({
                            type: "dance",
                            steps: [
                              { tap: key(selected) },
                              { tap: key("escape") },
                            ],
                          });
                      }}
                    >
                      <option value="default">Default / inherit</option>
                      <option value="map">Remap</option>
                      <option value="dance">Tap dance</option>
                    </select>
                  </label>
                  {!binding && (
                    <div className="empty-inspector">
                      <span>↳</span>
                      <p>
                        This key follows the layer below, or its original
                        behavior on the base layer.
                      </p>
                    </div>
                  )}
                  {binding?.behavior.type === "map" && (
                    <ActionEditor
                      mapping
                      value={binding.behavior.action}
                      project={p}
                      onChange={(a) => setBehavior({ type: "map", action: a })}
                    />
                  )}
                  {binding?.behavior.type === "dance" &&
                    (() => {
                      const b = binding.behavior;
                      return (
                        <>
                          <div className="gesture-steps">
                            {b.steps.map((s, i) => (
                              <div className="gesture-step" key={i}>
                                <div className="gesture-step-title">
                                  <span className="step-dots">
                                    {"●".repeat(i + 1)}
                                  </span>
                                  <strong>
                                    {
                                      [
                                        "Single tap",
                                        "Double tap",
                                        "Triple tap",
                                      ][i]
                                    }
                                  </strong>
                                  {i > 0 && i === b.steps.length - 1 && (
                                    <button
                                      title="Remove stage"
                                      onClick={() =>
                                        setBehavior({
                                          ...b,
                                          steps: b.steps.slice(0, -1),
                                        })
                                      }
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                                <ActionEditor
                                  value={s.tap}
                                  project={p}
                                  onChange={(a) =>
                                    setBehavior({
                                      ...b,
                                      steps: b.steps.map((x, j) =>
                                        j === i ? { ...x, tap: a } : x,
                                      ),
                                    })
                                  }
                                />
                                <label className="hold-switch">
                                  <input
                                    type="checkbox"
                                    checked={!!s.hold}
                                    onChange={(e) =>
                                      setBehavior({
                                        ...b,
                                        steps: b.steps.map((x, j) =>
                                          j === i
                                            ? e.target.checked
                                              ? {
                                                  ...x,
                                                  hold: key("left_control"),
                                                }
                                              : { tap: x.tap }
                                            : x,
                                        ),
                                      })
                                    }
                                  />{" "}
                                  Add a hold action
                                </label>
                                {s.hold && (
                                  <div className="hold-action">
                                    <ActionEditor
                                      hold
                                      value={s.hold}
                                      project={p}
                                      onChange={(a) =>
                                        setBehavior({
                                          ...b,
                                          steps: b.steps.map((x, j) =>
                                            j === i ? { ...x, hold: a } : x,
                                          ),
                                        })
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {b.steps.length < 3 && (
                            <button
                              className="add-stage"
                              onClick={() =>
                                setBehavior({
                                  ...b,
                                  steps: [...b.steps, { tap: key("escape") }],
                                })
                              }
                            >
                              + Add {b.steps.length === 1 ? "double" : "triple"}{" "}
                              tap
                            </button>
                          )}
                          <div className="timing-controls">
                            <span className="eyebrow">
                              TIMING & INTERRUPTION
                            </span>
                            <div className="field-pair">
                              {(["tapWindowMs", "holdMs"] as const).map((f) => (
                                <label key={f}>
                                  {f === "tapWindowMs"
                                    ? "Tap window"
                                    : "Hold after"}
                                  <span className="number-input">
                                    <input
                                      aria-label={
                                        f === "tapWindowMs"
                                          ? "Binding tap window"
                                          : "Binding hold threshold"
                                      }
                                      type="number"
                                      min="1"
                                      max="5000"
                                      value={b.timing?.[f] ?? p.timing[f]}
                                      onChange={(e) =>
                                        setBehavior({
                                          ...b,
                                          timing: {
                                            ...b.timing,
                                            [f]: Number(e.target.value),
                                          },
                                        })
                                      }
                                    />
                                    <span>ms</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                            <label>
                              When another key is pressed
                              <select
                                aria-label="Interruption policy"
                                value={holdPolicy(b)}
                                onChange={(e) =>
                                  setBehavior({
                                    ...b,
                                    interruption: e.target.value as
                                      "hold" | "tap",
                                  })
                                }
                              >
                                <option value="hold">Activate hold</option>
                                <option value="tap">Commit tap</option>
                              </select>
                            </label>
                            <p className="hint">
                              Windows begin on key-down. Longer gestures replace
                              shorter taps. Terminal taps commit on release;
                              other taps commit when their window closes.
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  {binding && (
                    <button
                      className="reset-binding text-button"
                      onClick={resetBinding}
                    >
                      ↶ Reset this key
                    </button>
                  )}
                </aside>
              </div>
              <Timeline
                project={p}
                selectedKey={selected}
                paused={exportOpen}
              />
            </>
          )}
          {tab === "json" && (
            <section className="json-panel panel">
              <div className="section-heading">
                <div>
                  <h2>Project source</h2>
                  <p className="hint">
                    The same data powers the keyboard editor and CLI. Changes
                    apply when the JSON is valid.
                  </p>
                </div>
                <button
                  onClick={() => {
                    try {
                      const value = JSON.parse(json);
                      const errors = validate(value).filter(
                        (d) => d.severity === "error",
                      );
                      if (errors.length)
                        throw new Error(
                          errors
                            .map((d) => `${d.path}: ${d.message}`)
                            .join("\n"),
                        );
                      commit(value);
                      setNotice("Project source applied.");
                    } catch (e) {
                      setJsonError(String(e));
                    }
                  }}
                >
                  Apply JSON
                </button>
              </div>
              <textarea
                aria-label="Project JSON"
                spellCheck={false}
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  setJsonError(
                    "Unapplied JSON changes. Apply valid JSON before exporting.",
                  );
                }}
              />
            </section>
          )}
          {tab === "compiler" && (
            <section className="compiler-panel panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">KARABINER 16.3.0</span>
                  <h2>From intention to configuration</h2>
                </div>
                <button
                  disabled={!result.ok}
                  onClick={() =>
                    download(
                      { ...result, asset: undefined },
                      `${p.id}.report.json`,
                    )
                  }
                >
                  Download report
                </button>
              </div>
              <div className="metrics">
                {[
                  ["Manipulators", result.statistics.manipulators],
                  ["Timer sites", result.statistics.timers],
                  ["Variables", result.statistics.variables],
                  [
                    "Output",
                    `${(result.statistics.bytes / 1024).toFixed(1)} KB`,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <ol className="passes">
                {result.passes.map((pass) => (
                  <li key={pass.name}>
                    <strong>{pass.name}</strong>
                    <p>{pass.detail}</p>
                  </li>
                ))}
              </ol>
              <details>
                <summary>Generated Karabiner JSON</summary>
                <pre>{JSON.stringify(result.asset, null, 2)}</pre>
              </details>
              <details>
                <summary>Source map</summary>
                <pre>{JSON.stringify(result.sourceMap, null, 2)}</pre>
              </details>
              <details>
                <summary>State machines</summary>
                <pre>{JSON.stringify(result.machines, null, 2)}</pre>
              </details>
            </section>
          )}
          <footer className="workspace-footer">
            <span>
              KMK <span className="muted">/</span> {total} assignments across{" "}
              {p.layers.length} layers
            </span>
            <span>Compiled locally · Karabiner 16.3.0</span>
          </footer>
        </main>
      </div>
      {exportOpen && result.ok && !jsonError && result.asset && (
        <ExportDialog
          rule={result.asset.rules[0]}
          onClose={() => setExportOpen(false)}
        />
      )}
      <input
        ref={importRef}
        hidden
        type="file"
        accept=".json"
        aria-label="Import project file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const value = JSON.parse(await file.text());
            const errors = validate(value).filter(
              (d) => d.severity === "error",
            );
            if (errors.length)
              throw new Error(errors.map((d) => d.message).join(" "));
            commit(value);
            setLayerId(value.layers[0].id);
            setNotice("Project imported.");
          } catch (error) {
            setNotice(`Import failed: ${String(error)}`);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
