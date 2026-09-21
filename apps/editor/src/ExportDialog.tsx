import { useEffect, useRef, useState } from "react";
import type { Asset } from "@kmk/compiler";

export function ExportDialog({
  rule,
  onClose,
}: {
  rule: Asset["rules"][number];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const jsonRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<
    "ready" | "copying" | "copied" | "failed"
  >("ready");
  const json = JSON.stringify(rule, null, 2);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const copy = async () => {
    if (copyState === "copying") return;
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("copied");
    } catch {
      jsonRef.current?.focus();
      jsonRef.current?.select();
      setCopyState("failed");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="export-dialog"
      aria-labelledby="export-title"
      aria-describedby="export-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], textarea:not(:disabled)",
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className="export-header">
        <div>
          <span className="eyebrow">READY FOR YOUR KEYBOARD</span>
          <h2 id="export-title">Export to Karabiner</h2>
          <p id="export-description">
            Copy this rule, then paste it into Karabiner-Elements.
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Close export dialog"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="export-body">
        <section className="export-code" aria-labelledby="export-json-label">
          <label id="export-json-label" htmlFor="export-rule-json">
            Your complete rule
          </label>
          <textarea
            id="export-rule-json"
            ref={jsonRef}
            aria-label="Rule JSON"
            value={json}
            readOnly
            spellCheck={false}
            wrap="off"
          />
        </section>

        <section className="export-help" aria-labelledby="export-help-title">
          <h3 id="export-help-title">Paste it into Karabiner</h3>
          <p>
            Open{" "}
            <strong>Karabiner-Elements Settings → Complex Modifications</strong>
            , then choose the option that applies:
          </p>
          <p className="export-paste-note">
            Replace all text in Karabiner’s rule editor with the copied JSON,
            then click <strong>Save</strong>.
          </p>
          <figure>
            <figcaption>
              <strong>New rule</strong>
              <span>
                Click <strong>Add your own rule</strong>.
              </span>
            </figcaption>
            <a
              href="/help/karabiner-add-rule.png"
              target="_blank"
              rel="noreferrer"
              aria-label="View Add your own rule screenshot at full size"
            >
              <img
                src="/help/karabiner-add-rule.png"
                width="1210"
                height="268"
                alt="Karabiner Complex Modifications with the Add your own rule button."
              />
            </a>
          </figure>
          <figure>
            <figcaption>
              <strong>Update an existing rule</strong>
              <span>
                Find your KMK rule and click <strong>Edit</strong>.
              </span>
            </figcaption>
            <a
              href="/help/karabiner-edit-rule.png"
              target="_blank"
              rel="noreferrer"
              aria-label="View Edit rule screenshot at full size"
            >
              <img
                src="/help/karabiner-edit-rule.png"
                width="1550"
                height="162"
                alt="An existing KMK rule in Karabiner with its Edit button on the right."
              />
            </a>
          </figure>
        </section>
      </div>

      <footer className="export-footer">
        <p role="status" aria-live="polite" className="export-copy-status">
          {copyState === "copied"
            ? "Copied. Ready to paste into Karabiner."
            : copyState === "failed"
              ? "Couldn’t copy automatically. The JSON is selected—press ⌘C or Ctrl+C to copy."
              : "One rule contains all of your layers and gestures."}
        </p>
        <button
          autoFocus
          className="primary"
          aria-disabled={copyState === "copying"}
          onClick={copy}
        >
          {copyState === "copied"
            ? "Copied!"
            : copyState === "copying"
              ? "Copying…"
              : "Copy JSON"}
        </button>
      </footer>
    </dialog>
  );
}
