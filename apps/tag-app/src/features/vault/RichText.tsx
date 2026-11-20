import type { CSSProperties, ReactNode } from "react";
import type { RichTextContent, RichTextParagraph, RichTextRun, RichTextTable, VaultTheme } from "./types";

const safeLink = (value: unknown): string | undefined =>
  typeof value === "string" && /^(https:\/\/|mailto:)/i.test(value) ? value : undefined;

function renderRun(run: RichTextRun, index: number): ReactNode {
  if (run.type === "hardBreak") return <br key={index} />;
  let result: ReactNode = run.text ?? "";
  for (const mark of run.marks ?? []) {
    const type = mark.type;
    if (type === "bold") result = <strong key={`${index}-bold`}>{result}</strong>;
    else if (type === "italic") result = <em key={`${index}-italic`}>{result}</em>;
    else if (type === "underline") result = <u key={`${index}-underline`}>{result}</u>;
    else if (type === "highlight") result = <mark key={`${index}-highlight`}>{result}</mark>;
    else if (type === "link") {
      const href = safeLink(mark.href ?? mark.url);
      if (href) result = <a href={href} key={`${index}-link`} rel={href.startsWith("https:") ? "noreferrer" : undefined} target={href.startsWith("https:") ? "_blank" : undefined}>{result}</a>;
    } else if (type === "textStyle") {
      const style: CSSProperties = {};
      if (typeof mark.color === "string" && /^#[0-9a-f]{6}$/i.test(mark.color)) style.color = mark.color;
      if (typeof mark.fontSize === "string" && /^(?:[0-9]+(?:\.[0-9]+)?)(?:px|rem|em)$/.test(mark.fontSize)) style.fontSize = mark.fontSize;
      if (Object.keys(style).length) result = <span key={`${index}-style`} style={style}>{result}</span>;
    }
  }
  return <span key={index}>{result}</span>;
}

function paragraphStyle(block: RichTextParagraph): CSSProperties {
  return {
    ...(block.align ? { textAlign: block.align === "start" ? "left" : block.align === "end" ? "right" : "center" } : {}),
    ...(typeof block.indent === "number" ? { marginInlineStart: `${Math.min(3, Math.max(0, block.indent))}rem` } : {}),
    ...(typeof block.lineHeight === "number" && block.lineHeight >= 1 && block.lineHeight <= 3 ? { lineHeight: block.lineHeight } : {}),
  };
}

function Table({ table }: { table: RichTextTable }) {
  return <div className="rich-table-wrap"><table className="rich-table"><tbody>
    {(table.rows ?? []).map((row, rowIndex) => <tr key={rowIndex}>
      {(row.cells ?? []).map((cell, cellIndex) => {
        const Cell = row.header ? "th" : "td";
        const align = table.columns?.[cellIndex]?.align;
        const style: CSSProperties = {
          ...(cell.background && /^#[0-9a-f]{6}$/i.test(cell.background) ? { backgroundColor: cell.background } : {}),
          ...(align === "start" || align === "center" || align === "end" ? { textAlign: align === "start" ? "left" : align === "end" ? "right" : "center" } : {}),
        };
        return <Cell key={cellIndex} style={style}>{(cell.runs ?? []).map(renderRun)}</Cell>;
      })}
    </tr>)}
  </tbody></table></div>;
}

export function RichText({ content, fallback, className }: { content?: RichTextContent; fallback?: ReactNode; className?: string }) {
  const paragraphs = content?.paragraphs;
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return fallback ? <>{fallback}</> : null;
  return <div className={`rich-text${className ? ` ${className}` : ""}`}>
    {paragraphs.map((item, index) => {
      if (item.type === "table") return <Table key={index} table={item as RichTextTable} />;
      const block = item as RichTextParagraph;
      const children = (block.runs ?? []).map(renderRun);
      if (block.heading && block.heading >= 1 && block.heading <= 5) {
        const Heading = `h${block.heading}` as "h1";
        return <Heading key={index} style={paragraphStyle(block)}>{children}</Heading>;
      }
      if (block.list) {
        const List = block.list.kind === "ordered" ? "ol" : "ul";
        return <List key={index} style={{ ...paragraphStyle(block), paddingInlineStart: `${1.5 + block.list.level * 1.25}rem` }}><li>{children}</li></List>;
      }
      return <p key={index} style={paragraphStyle(block)}>{children}</p>;
    })}
  </div>;
}

export function themeVariables(theme: VaultTheme | undefined): CSSProperties {
  const colors = theme?.colors ?? {};
  const safe = (name: string, fallback: string) => typeof colors[name] === "string" && /^#[0-9a-f]{6}$/i.test(colors[name]) ? colors[name] : fallback;
  const typography = theme?.typography ?? {};
  const font = typeof typography.fontFamily === "string" && /^[\w ,'-]{1,80}$/.test(typography.fontFamily) ? typography.fontFamily : undefined;
  return {
    "--tag-bg": safe("background", theme?.colorMode === "dark" ? "#17211b" : "#f5f7f3"),
    "--tag-surface": safe("surface", theme?.colorMode === "dark" ? "#222e26" : "#ffffff"),
    "--tag-text": safe("text", theme?.colorMode === "dark" ? "#edf4ee" : "#1c2820"),
    "--tag-muted": safe("mutedText", theme?.colorMode === "dark" ? "#bac8bd" : "#59675f"),
    "--tag-heading": safe("heading", theme?.colorMode === "dark" ? "#ffffff" : "#12372a"),
    "--tag-accent": safe("accent", "#24543e"),
    "--tag-accent-text": safe("accentText", "#ffffff"),
    "--tag-border": safe("border", theme?.colorMode === "dark" ? "#49594d" : "#dbe1da"),
    "--tag-heading-scale": typeof typography.headingScale === "number" && typography.headingScale >= 0.8 && typography.headingScale <= 1.5 ? typography.headingScale : 1,
    "--tag-body-size": typeof typography.bodySize === "number" && typography.bodySize >= 12 && typography.bodySize <= 24 ? `${typography.bodySize}px` : "1rem",
    "--tag-line-height": typeof typography.lineHeight === "number" && typography.lineHeight >= 1 && typography.lineHeight <= 2 ? typography.lineHeight : 1.6,
    ...(font ? { fontFamily: font } : {}),
  } as CSSProperties;
}