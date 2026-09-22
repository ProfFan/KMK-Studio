import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  fontFamily: "system-ui, sans-serif",
  flowchart: { useMaxWidth: false },
  state: { useMaxWidth: false },
  themeVariables: {
    primaryColor: "#edf2e7",
    primaryTextColor: "#293e33",
    primaryBorderColor: "#78947a",
    lineColor: "#6a786d",
    secondaryColor: "#fff1e4",
    tertiaryColor: "#fffefa",
    background: "#fffefa",
  },
});

export function Mermaid({
  source,
  caption,
}: {
  source: string;
  caption: string;
}) {
  const id = `diagram-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = canvas.current;
    // Start over the central path rather than a wide diagram's empty margin.
    if (element)
      element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, [svg]);
  useEffect(() => {
    let canceled = false;
    // Mermaid's public render API queues concurrent diagrams. The definitions
    // come only from our documentation, never from imported user projects.
    mermaid.render(id, source).then(
      ({ svg }) => {
        if (!canceled) setSvg(svg);
      },
      () => {
        if (!canceled) setFailed(true);
      },
    );
    return () => {
      canceled = true;
    };
  }, [id, source]);
  return (
    <figure className="docs-diagram">
      {svg ? (
        <div
          className="docs-diagram-canvas"
          ref={canvas}
          role="img"
          tabIndex={0}
          aria-label={caption}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p role={failed ? "alert" : "status"}>
          {failed ? "Diagram unavailable." : "Drawing state diagram…"}
        </p>
      )}
      <figcaption>
        {caption} <span>Scroll the diagram horizontally if needed.</span>
      </figcaption>
    </figure>
  );
}
