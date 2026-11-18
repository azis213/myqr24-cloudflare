import { DEFAULT_HEADING_LEVEL } from "./types";
import { isTableBlock } from "./richtext";
import type { Paragraph, RichTextContent, TemplateElement } from "./types";

export interface BindingContext {
  tagName?: string;
  tagId?: string;
}

export const BINDING_SOURCES = ["tag.displayName", "tag.id", "literal"] as const;
export type BindingSource = (typeof BINDING_SOURCES)[number];

export function isKnownBindingSource(source: string): source is BindingSource {
  return (BINDING_SOURCES as readonly string[]).includes(source);
}

function bindingValue(source: string, literal: string | undefined, context: BindingContext): string | undefined {
  switch (source) {
    case "tag.displayName":
      return context.tagName;
    case "tag.id":
      return context.tagId;
    case "literal":
      return literal;
    default:
      return undefined;
  }
}

/** Setzt den Text der ersten Überschrift; legt sie an, wenn noch keine existiert. */
function applyHeadingBinding(content: RichTextContent, text: string): void {
  const blocks = content.paragraphs ?? [];
  const first = blocks[0];
  if (first && !isTableBlock(first) && first.heading !== undefined) {
    blocks[0] = { ...first, runs: [{ text }] } as Paragraph;
  } else {
    blocks.unshift({ heading: DEFAULT_HEADING_LEVEL, runs: [{ text }] });
  }
  content.paragraphs = blocks;
}

/**
 * Loest `bindings` gegen den Kontext auf. Bindings sind Autorenwerkzeuge:
 * beim Flatten entsteht daraus `content`; in der Instanz existieren keine Bindings mehr.
 */
export function resolveContent(element: TemplateElement, context: BindingContext = {}): RichTextContent {
  const content: RichTextContent = {
    heading: element.content?.heading,
    paragraphs: element.content?.paragraphs ? structuredClone(element.content.paragraphs) : undefined,
  };
  const bindings = element.bindings ?? {};
  for (const field of ["heading", "title"]) {
    const binding = bindings[field];
    if (!binding) continue;
    const value = bindingValue(binding.from, binding.value, context);
    if (typeof value === "string" && value.length > 0) applyHeadingBinding(content, value);
  }
  const subtitle = bindings.subtitle;
  if (subtitle) {
    const value = bindingValue(subtitle.from, subtitle.value, context);
    if (typeof value === "string" && value.length > 0) {
      content.paragraphs = [{ runs: [{ text: value }] }, ...(content.paragraphs ?? [])];
    }
  }
  return content;
}

export function flattenBindings(document: { elements: TemplateElement[] }): TemplateElement[] {
  return document.elements.map((element) => {
    if (!element.bindings) return element;
    const resolved = resolveContent(element);
    const next: TemplateElement = { ...element, content: resolved };
    delete next.bindings;
    return next;
  });
}
