import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { guides } from "./content.tsx";
import { diagrams as definitions } from "./diagrams.ts";
import "./style.css";

function Documentation() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(location.hash.slice(1) || "start");
  const visible = guides.filter((guide) =>
    `${guide.title} ${guide.summary} ${guide.keywords}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const groups = [...new Set(guides.map((guide) => guide.group))];
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries.find((entry) => entry.isIntersecting);
        if (first) setActive(first.target.id);
      },
      { rootMargin: "-5% 0px -70% 0px" },
    );
    document
      .querySelectorAll(".docs-section")
      .forEach((section) => observer.observe(section));
    // Native fragment navigation runs before React has mounted on direct visits.
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView();
    // Rendering diagrams changes section heights. Restore a direct fragment
    // once they settle, unless the reader has already interacted with the page.
    const diagrams = new MutationObserver(() => {
      if (
        document.querySelectorAll(".docs-diagram-canvas svg").length ===
        Object.keys(definitions).length
      ) {
        target?.scrollIntoView();
        diagrams.disconnect();
      }
    });
    if (target)
      diagrams.observe(document.getElementById("docs-main")!, {
        childList: true,
        subtree: true,
      });
    const stopRestoring = () => diagrams.disconnect();
    const inputs = ["pointerdown", "wheel", "keydown", "touchstart"];
    inputs.forEach((event) =>
      window.addEventListener(event, stopRestoring, {
        once: true,
        passive: true,
      }),
    );
    return () => {
      observer.disconnect();
      diagrams.disconnect();
      inputs.forEach((event) =>
        window.removeEventListener(event, stopRestoring),
      );
    };
  }, []);
  return (
    <div className="docs-site">
      <a className="docs-skip" href="#docs-main">
        Skip to content
      </a>
      <aside className="docs-sidebar">
        <a className="docs-brand" href="/" aria-label="KMK Studio home">
          <img src="/kmk-icon.svg" alt="" width="32" height="32" />
          <strong>
            kmk <span>/ docs</span>
          </strong>
        </a>
        <p className="docs-sidebar-intro">A field guide to your keyboard.</p>
        <label className="docs-search">
          <span>Find a topic</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Try “leader” or “hold”…"
          />
        </label>
        <nav aria-label="Documentation topics">
          {groups.map((group) => {
            const entries = visible.filter((guide) => guide.group === group);
            return entries.length ? (
              <div className="docs-nav-group" key={group}>
                <h2>{group}</h2>
                {entries.map((guide) => (
                  <a
                    key={guide.id}
                    href={`#${guide.id}`}
                    aria-current={active === guide.id ? "location" : undefined}
                    onClick={() => setActive(guide.id)}
                  >
                    {guide.title}
                  </a>
                ))}
              </div>
            ) : null;
          })}
          {!visible.length && (
            <p className="docs-no-results" role="status">
              No topics found. Try “tap”, “layer”, or “export”.
            </p>
          )}
        </nav>
        <a className="docs-back" href="/">
          ← Back to studio
        </a>
        <span className="docs-version">Project v1 · Karabiner 16.3.0</span>
      </aside>
      <main id="docs-main" className="docs-main">
        <header className="docs-hero">
          <div className="docs-kicker">
            THE KMK HANDBOOK <span>LOCAL BY DESIGN</span>
          </div>
          <h1>
            Small keys.
            <br />
            <em>More possibilities.</em>
          </h1>
          <p>
            From your first remap to a double-tap leader. Learn the patterns,
            see their states, and make them your own.
          </p>
          <div className="docs-quick-links">
            <a href="#start">
              Start with a remap <span>↗</span>
            </a>
            <a href="#oneshot">
              Build a leader key <span>↗</span>
            </a>
            <a href="#export">
              Install your rule <span>↗</span>
            </a>
          </div>
        </header>
        {guides.map((guide, index) => (
          <section
            className="docs-section"
            id={guide.id}
            key={guide.id}
            aria-labelledby={`${guide.id}-title`}
          >
            <div className="docs-section-label">
              <span>{String(index + 1).padStart(2, "0")}</span>
              {guide.group}
            </div>
            <h2 id={`${guide.id}-title`}>
              <a href={`#${guide.id}`}>
                {guide.title}
                <span aria-hidden="true"> #</span>
              </a>
            </h2>
            <p className="docs-summary">{guide.summary}</p>
            {guide.body}
          </section>
        ))}
        <footer className="docs-footer">
          <a href="/">← Make it yours in the studio</a>
          <span>Made with love by @FanOnRobotics</span>
        </footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Documentation />
  </React.StrictMode>,
);
