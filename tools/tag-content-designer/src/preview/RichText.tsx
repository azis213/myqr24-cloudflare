import type { CSSProperties } from "react";
import type { RichTextContent, TextRun } from "../domain/types";

function runStyle(run: TextRun): CSSProperties {
  const style: CSSProperties = {};
  for (const mark of run.marks ?? []) {
    if (mark.type === "bold") style.fontWeight = 700;
    if (mark.type === "italic") style.fontStyle = "italic";
    if (mark.type === "underline") style.textDecoration = "underline";
  }
  return style;
}

export function RichText({ content }: { content?: RichTextContent }) {
  if (!content) return null;
  return (
    <div className="rt">
      {content.heading ? <h2 className="rt-heading">{content.heading}</h2> : null}
      {(content.paragraphs ?? []).map((paragraph, paragraphIndex) => (
        <p className="rt-paragraph" key={paragraphIndex}>
          {paragraph.runs.map((run, runIndex) => (
            <span key={runIndex} style={runStyle(run)}>
              {run.text}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
