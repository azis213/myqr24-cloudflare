import { Extension, Mark, mergeAttributes, Node, textblockTypeInputRule } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";
import { baseKeymap } from "@tiptap/pm/commands";
import { keymap } from "@tiptap/pm/keymap";
import { clampHeadingLevel, FONT_STACKS, isFontFamily, isFontSize, isHexColor, isSafeHref } from "../domain/richtext";
import { DEFAULT_HEADING_LEVEL } from "../domain/types";
import { parseCssColor, parseCssFontFamily, parseCssFontSize, parseCssLineHeight, parseCssTextAlign } from "./parseCss";

/** Zeichen-Attribute als ein Mark: Farbe, Markierung, Größe, Schriftfamilie (nur geschlossene Werte). */
export const RichStyle = Mark.create({
  name: "richStyle",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => parseCssColor(element.style.color),
      },
      background: {
        default: null,
        parseHTML: (element: HTMLElement) => parseCssColor(element.style.backgroundColor),
      },
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => parseCssFontSize(element.style.fontSize),
      },
      fontFamily: {
        default: null,
        parseHTML: (element: HTMLElement) => parseCssFontFamily(element.style.fontFamily),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span",
        getAttrs: (element: HTMLElement) => {
          const style = element.style;
          const hasAny = Boolean(style.color || style.backgroundColor || style.fontSize || style.fontFamily);
          return hasAny ? null : false;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const style: string[] = [];
    if (isHexColor(HTMLAttributes.color)) style.push(`color: ${HTMLAttributes.color}`);
    if (isHexColor(HTMLAttributes.background)) style.push(`background-color: ${HTMLAttributes.background}`);
    if (isFontSize(HTMLAttributes.fontSize)) style.push(`font-size: ${HTMLAttributes.fontSize}px`);
    if (isFontFamily(HTMLAttributes.fontFamily)) style.push(`font-family: ${FONT_STACKS[HTMLAttributes.fontFamily]}`);
    return [
      "span",
      mergeAttributes({ class: "rt-run" }, style.length > 0 ? { style: style.join("; ") } : {}),
      0,
    ];
  },
});

/** Gemeinsame Absatz-Attribute (Ausrichtung, Zeilenabstand, Einrückung) für Absatz und Überschrift. */
export function paragraphAttributeConfig() {
  return {
    align: {
      default: "start",
      parseHTML: (element: HTMLElement) => parseCssTextAlign(element),
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes.align && attributes.align !== "start" ? { style: `text-align: ${String(attributes.align)}` } : {},
    },
    lineHeight: {
      default: null,
      parseHTML: (element: HTMLElement) => parseCssLineHeight(element),
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes.lineHeight ? { style: `line-height: ${String(attributes.lineHeight)}` } : {},
    },
    indent: {
      default: 0,
      parseHTML: () => 0,
      renderHTML: (attributes: Record<string, unknown>) =>
        Number(attributes.indent) > 0 ? { style: `padding-left: ${Number(attributes.indent) * 1.25}rem` } : {},
    },
  };
}

/** Absatz mit Ausrichtung, Zeilenabstand und Einrückung. */
export const RichParagraph = Paragraph.extend({
  addAttributes() {
    return paragraphAttributeConfig();
  },
});

/** Markdown-Kürzel für Überschriften: "# " bis "##### " (Ebene = Anzahl der #). */
export const HEADING_INPUT_PATTERN = /^(#{1,5})\s$/;

/**
 * Überschrift 1–5: jede Textzeile kann Überschrift sein, mehrere pro Feld.
 * Zeichenformate (Fett, Farbe, Größe …) sind erlaubt – Word-Verhalten.
 */
export const RichHeading = Node.create({
  name: "richHeading",
  group: "block",
  content: "text*",
  defining: true,
  addAttributes() {
    return {
      level: {
        default: DEFAULT_HEADING_LEVEL,
        parseHTML: (element: HTMLElement) => {
          const fromAttribute = Number(element.getAttribute("data-level"));
          if (Number.isInteger(fromAttribute)) return clampHeadingLevel(fromAttribute);
          const match = /^h([1-6])$/i.exec(element.tagName ?? "");
          return match ? clampHeadingLevel(Number(match[1])) : DEFAULT_HEADING_LEVEL;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-level": String(clampHeadingLevel(attributes.level)),
        }),
      },
      ...paragraphAttributeConfig(),
    };
  },
  parseHTML() {
    return [{ tag: "h1" }, { tag: "h2" }, { tag: "h3" }, { tag: "h4" }, { tag: "h5" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = clampHeadingLevel(node.attrs.level);
    return [`h${level}`, mergeAttributes({ class: "rt-heading" }, HTMLAttributes), 0];
  },
  addInputRules() {
    // Markdown-Kürzel: "# " bis "##### " macht die aktuelle Zeile zur Überschrift.
    return [
      textblockTypeInputRule({
        find: HEADING_INPUT_PATTERN,
        type: this.type,
        getAttributes: (match) => ({ level: match[1].length }),
      }),
    ];
  },
  addKeyboardShortcuts() {
    const setLevel = (level: number) => () => this.editor.commands.setNode(this.name, { level });
    return {
      "Mod-Alt-1": setLevel(1),
      "Mod-Alt-2": setLevel(2),
      "Mod-Alt-3": setLevel(3),
      "Mod-Alt-4": setLevel(4),
      "Mod-Alt-5": setLevel(5),
      "Mod-Alt-0": () => this.editor.commands.setNode("paragraph"),
      // Leere Überschrift + Backspace → wieder normaler Absatz (kein „Gefängnis").
      Backspace: () => {
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const parent = selection.$from.parent;
        if (parent.type.name !== this.name) return false;
        if (parent.content.size > 0) return false;
        return this.editor.commands.setNode("paragraph");
      },
    };
  },
});

/** Tabelle (bewusst schlank: Zellen sind reiner Text, keine Spalten-Resize-UI). */
export const RichTable = Node.create({
  name: "richTable",
  group: "block",
  content: "richTableRow+",
  isolating: true,
  parseHTML() {
    return [{ tag: "table" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes({ class: "rt-table" }, HTMLAttributes), ["tbody", 0]];
  },
});

export const RichTableRow = Node.create({
  name: "richTableRow",
  content: "richTableCell+",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML() {
    return ["tr", 0];
  },
});

export const RichTableCell = Node.create({
  name: "richTableCell",
  content: "text*",
  addAttributes() {
    return {
      header: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
      align: {
        default: "start",
        parseHTML: (element: HTMLElement) => parseCssTextAlign(element),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.align && attributes.align !== "start" ? { style: `text-align: ${String(attributes.align)}` } : {},
      },
    };
  },
  parseHTML() {
    return [
      { tag: "td" },
      {
        tag: "th",
        getAttrs: () => ({ header: true }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [node.attrs.header === true ? "th" : "td", mergeAttributes({ class: "rt-cell" }, HTMLAttributes), 0];
  },
});

/** Enter/Backspace/Tab-Grundverhalten (Basis-Keymap von ProseMirror). */
export const RichKeymap = Extension.create({
  name: "richKeymap",
  addProseMirrorPlugins() {
    return [keymap(baseKeymap)];
  },
});


/** Vollständige Erweiterungsliste des RTF-Felds (Reihenfolge: Basis → Blöcke → Marks → Keymap). */
export function createRichExtensions() {
  return [
    Document,
    Text,
    RichParagraph.configure({ HTMLAttributes: { class: "rt-paragraph" } }),
    RichHeading,
    RichTable,
    RichTableRow,
    RichTableCell,
    Bold,
    Italic,
    Underline,
    // Weicher Zeilenumbruch im selben Absatz (Shift+Enter); Zeichen-Attribute bleiben erhalten.
    HardBreak.configure({ keepMarks: true }),
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      protocols: ["https", "mailto"],
      validate: (href: string) => isSafeHref(href),
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
    BulletList.configure({ HTMLAttributes: { class: "rt-list rt-list-bullet" } }),
    OrderedList.configure({ HTMLAttributes: { class: "rt-list rt-list-ordered" } }),
    ListItem,
    RichStyle,
    RichKeymap,
  ];
}

