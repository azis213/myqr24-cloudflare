import type { CSSProperties, ReactNode } from "react";
import {
  clampHeadingLevel,
  groupBlocks,
  linkAttributes,
  normalizeHref,
  paragraphPresentation,
  runPresentation,
  type BlockNode,
  type ListItemNode,
} from "../domain/richtext";
import type { ListKind, Paragraph, RichTextContent, TableBlock, TextRun } from "../domain/types";

function Run({ run }: { run: TextRun }) {
  const style = runPresentation(run) as CSSProperties;
  const href = normalizeHref(run.link?.href);
  if (!href) return <span style={style}>{run.text}</span>;
  return (
    <a {...linkAttributes(href)} style={style} title={href} onClick={(event) => event.preventDefault()}>
      {run.text}
    </a>
  );
}

/** Absatz oder – bei `heading` – eine Überschrift 1–5 mit denselben Absatz-Attributen. */
function ParagraphView({ paragraph }: { paragraph: Paragraph }) {
  const style = paragraphPresentation(paragraph) as CSSProperties;
  const runs: ReactNode =
    paragraph.runs.length === 0 ? <br /> : paragraph.runs.map((run, index) => <Run key={index} run={run} />);
  if (paragraph.heading !== undefined) {
    const level = clampHeadingLevel(paragraph.heading);
    const Tag = `h${level}` as "h1";
    return (
      <Tag className={`rt-heading rt-heading-${level}`} data-level={level} style={style}>
        {runs}
      </Tag>
    );
  }
  return (
    <p className="rt-paragraph" style={style}>
      {runs}
    </p>
  );
}

function ListView({ kind, items }: { kind: ListKind; items: ListItemNode[] }) {
  const children = items.map((item, index) => (
    <li key={index} className="rt-list-item">
      {item.paragraphs.map((paragraph, paragraphIndex) => (
        <ParagraphView key={`p${paragraphIndex}`} paragraph={paragraph} />
      ))}
      {item.children.map((child, childIndex) => (
        <BlockView key={`c${childIndex}`} block={child} />
      ))}
    </li>
  ));
  return kind === "ordered" ? (
    <ol className="rt-list rt-list-ordered">{children}</ol>
  ) : (
    <ul className="rt-list rt-list-bullet">{children}</ul>
  );
}

function TableView({ table }: { table: TableBlock }) {
  const border = table.border;
  // Gitterrahmen über CSS-Variablen: eine Wahrheit für Vorschau und Editor.
  const tableStyle = {
    borderCollapse: "collapse" as const,
    ...(border
      ? {
          "--rt-border-color": border.color,
          "--rt-border-style": border.style,
          "--rt-border-width": `${border.width}px`,
        }
      : {}),
  } as CSSProperties;

  return (
    <table className="rt-table" data-bordered={border ? "true" : "false"} style={tableStyle}>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {table.columns.map((column, columnIndex) => {
              const cell = row.cells[columnIndex] ?? { runs: [] };
              const style: CSSProperties = {
                ...(column.align && column.align !== "start" ? { textAlign: column.align } : {}),
                ...(cell.background ? { backgroundColor: cell.background } : {}),
              };
              const runs = cell.runs ?? [];
              const content = runs.length === 0 ? <br /> : runs.map((run, runIndex) => <Run key={runIndex} run={run} />);
              return row.header ? (
                <th key={columnIndex} className="rt-cell" style={style}>
                  {content}
                </th>
              ) : (
                <td key={columnIndex} className="rt-cell" style={style}>
                  {content}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BlockView({ block }: { block: BlockNode }) {
  if (block.type === "table") return <TableView table={block.table} />;
  return block.type === "list" ? <ListView kind={block.kind} items={block.items} /> : <ParagraphView paragraph={block.paragraph} />;
}

export function RichText({ content }: { content?: RichTextContent }) {
  if (!content) return null;
  const blocks = groupBlocks(content.paragraphs ?? []);
  return (
    <div className="rt">
      {/* Altbestand (schemaVersion 1): Feld `heading` wird als Überschrift 3 gerendert. */}
      {content.heading ? (
        <h3 className="rt-heading rt-heading-3" data-level={3}>
          {content.heading}
        </h3>
      ) : null}
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

