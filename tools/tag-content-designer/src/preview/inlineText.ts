import type { MarkName, Paragraph, RichTextContent, TextRun } from "../domain/types";

const MARK_ORDER: MarkName[] = ["bold", "italic", "underline"];
const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "SECTION", "ARTICLE"]);
const MARK_TAGS: Record<string, MarkName> = {
  B: "bold",
  STRONG: "bold",
  I: "italic",
  EM: "italic",
  U: "underline",
};

export function markNames(run: TextRun): MarkName[] {
  const present = (run.marks ?? []).map((mark) => mark.type);
  return MARK_ORDER.filter((name) => present.includes(name));
}

/** Fasst benachbarte Runs mit identischen Marks zusammen und entfernt leere Runs. */
export function mergeRuns(runs: TextRun[]): TextRun[] {
  const result: TextRun[] = [];
  for (const run of runs) {
    const text = run.text;
    if (!text) continue;
    const marks = markNames(run);
    const key = marks.join(",");
    const last = result.at(-1);
    if (last && markNames(last).join(",") === key) {
      last.text += text;
      continue;
    }
    result.push(marks.length > 0 ? { text, marks: marks.map((type) => ({ type })) } : { text });
  }
  return result;
}

export function plainText(content: RichTextContent | undefined): string {
  if (!content) return "";
  const paragraphs = (content.paragraphs ?? []).map((paragraph) => paragraph.runs.map((run) => run.text).join(""));
  return [content.heading ?? "", ...paragraphs].filter((entry) => entry.length > 0).join("\n");
}

/** Baut die Vorschau-DOM aus Runs – ausschließlich mit `textContent`, kein HTML-String. */
export function renderContentToDom(
  container: HTMLElement,
  content: RichTextContent | undefined,
  headingClass = "rt-heading",
): void {
  container.replaceChildren();
  if (!content) return;
  if (content.heading) {
    const heading = document.createElement("h2");
    heading.className = headingClass;
    heading.textContent = content.heading;
    container.append(heading);
  }
  for (const paragraph of content.paragraphs ?? []) {
    const element = document.createElement("p");
    element.className = "rt-paragraph";
    for (const run of paragraph.runs) {
      let node: Node = document.createTextNode(run.text);
      for (const mark of [...markNames(run)].reverse()) {
        const wrapper = document.createElement(mark === "bold" ? "strong" : mark === "italic" ? "em" : "u");
        wrapper.append(node);
        node = wrapper;
      }
      element.append(node);
    }
    if (element.childNodes.length === 0) element.append(document.createElement("br"));
    container.append(element);
  }
}

function collectRuns(node: Node, marks: MarkName[], out: TextRun[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/\u00a0/g, " ");
    if (text.length > 0) {
      out.push(marks.length > 0 ? { text, marks: marks.map((type) => ({ type })) } : { text });
    }
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  if (node.tagName === "BR") return;
  const ownMark = MARK_TAGS[node.tagName];
  collectRunsInto(node, ownMark && !marks.includes(ownMark) ? [...marks, ownMark] : marks, out);
}

function collectRunsInto(node: Node, marks: MarkName[], out: TextRun[]): void {
  node.childNodes.forEach((child) => collectRuns(child, marks, out));
}

/** Sammelt Runs innerhalb eines Blocks und beginnt bei `<br>` einen neuen Absatz. */
function collectBlockParagraphs(node: Node, marks: MarkName[], out: TextRun[][]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/\u00a0/g, " ");
    if (text.length > 0) {
      const current = out.at(-1) ?? [];
      current.push(marks.length > 0 ? { text, marks: marks.map((type) => ({ type })) } : { text });
      if (out.length === 0) out.push(current);
    }
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  if (node.tagName === "BR") {
    out.push([]);
    return;
  }
  const ownMark = MARK_TAGS[node.tagName];
  const next = ownMark && !marks.includes(ownMark) ? [...marks, ownMark] : marks;
  node.childNodes.forEach((child) => collectBlockParagraphs(child, next, out));
}

/** Liest den Inhalt einer contentEditable-Fläche zurück in das Runs-Modell. */
export function parseContentDom(root: HTMLElement, options: { headingSelector?: string } = {}): RichTextContent {
  const headingSelector = options.headingSelector ?? ".rt-heading";
  const headingElement = root.querySelector<HTMLElement>(headingSelector);
  const heading = headingElement?.textContent?.replace(/\u00a0/g, " ").trim();

  const paragraphs: Paragraph[] = [];
  let pending: TextRun[] = [];
  const flush = () => {
    const runs = mergeRuns(pending);
    pending = [];
    if (runs.length > 0) paragraphs.push({ runs });
  };

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\u00a0/g, " ");
      if (text.trim().length > 0) pending.push({ text });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (headingElement && node === headingElement) return;
    if (node.tagName === "BR") {
      flush();
      return;
    }
    if (BLOCK_TAGS.has(node.tagName)) {
      flush();
      const groups: TextRun[][] = [[]];
      node.childNodes.forEach((child) => collectBlockParagraphs(child, [], groups));
      for (const group of groups) {
        const merged = mergeRuns(group);
        if (merged.length > 0) paragraphs.push({ runs: merged });
      }
      return;
    }
    const runs: TextRun[] = [];
    collectRuns(node, [], runs);
    pending.push(...runs);
  };

  root.childNodes.forEach(visit);
  flush();

  return heading && heading.length > 0 ? { heading, paragraphs } : { paragraphs };
}
