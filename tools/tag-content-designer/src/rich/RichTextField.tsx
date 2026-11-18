import { Fragment, Slice } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { canonicalize } from "../domain/serialize";
import type { ElementStyle, RichTextContent } from "../domain/types";
import { contentToDoc, docToContent } from "./mapping";
import { MarkdownDialog } from "./MarkdownDialog";
import { looksLikeMarkdown, parseMarkdown } from "./markdown";
import type { PaletteContext } from "./palette";
import { sanitizePastedHtml } from "./paste";
import { createRichExtensions } from "./schema";
import { RichToolbar } from "./Toolbar";

const COMMIT_DELAY_MS = 350;

export interface RichTextFieldProps {
  content?: RichTextContent;
  style?: ElementStyle;
  placeholder?: string;
  palette: PaletteContext;
  onContentChange: (content: RichTextContent) => void;
  onStyleChange: (patch: Partial<ElementStyle>) => void;
  /** Integrationshaken (z. B. Tests): liefert die Editor-Instanz nach dem Aufbau. */
  onEditorReady?: (editor: Editor) => void;
}

export function RichTextField({
  content,
  style,
  placeholder = "Text eingeben …",
  palette,
  onContentChange,
  onStyleChange,
  onEditorReady,
}: RichTextFieldProps) {
  const [focusWithin, setFocusWithin] = useState(false);
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const contentRef = useRef<RichTextContent | undefined>(content);
  const handlersRef = useRef({ onContentChange });
  const timerRef = useRef<number | null>(null);
  /** Zuletzt markierte Spanne – hält Schriftgröße/-familie & Farben auch nach Fokuswechsel wirksam. */
  const selectionRef = useRef<{ from: number; to: number } | null>(null);

  // Immer die aktuellen Props verwenden – der Editor wird nur einmal erzeugt.
  contentRef.current = content;
  handlersRef.current = { onContentChange };

  const commit = useCallback((instance: Editor) => {
    const next = docToContent(instance.getJSON());
    if (canonicalize(next) === canonicalize(contentRef.current ?? { paragraphs: [] })) return;
    handlersRef.current.onContentChange(next);
  }, []);

  const scheduleCommit = useCallback(
    (instance: Editor) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        commit(instance);
      }, COMMIT_DELAY_MS);
    },
    [commit],
  );

  const editor = useEditor(
    {
      extensions: createRichExtensions(),
      content: contentToDoc(content),
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          class: "rte-surface",
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "Text bearbeiten",
          spellcheck: "false",
        },
        transformPastedHTML: sanitizePastedHtml,
        /**
         * Markdown-Paste: Reiner Text, der nach Markdown aussieht, wird in Tokens übersetzt.
         * HTML-Paste (Word/Web) läuft weiter über den Sanitizer + Schema-Parser.
         */
        handlePaste: (view, event) => {
          const clipboard = event.clipboardData;
          if (!clipboard) return false;
          const html = clipboard.getData("text/html");
          if (html && html.trim().length > 0) return false;
          const text = clipboard.getData("text/plain");
          if (!text || !looksLikeMarkdown(text)) return false;

          const parsed = parseMarkdown(text);
          const blocks = contentToDoc(parsed.content).content ?? [];
          if (blocks.length === 0) return false;

          try {
            const { state } = view;
            const nodes = blocks.map((block) => state.schema.nodeFromJSON(block));
            const fragment = Fragment.fromArray(nodes);
            view.dispatch(state.tr.replaceSelection(new Slice(fragment, 0, 0)).scrollIntoView());
            return true;
          } catch {
            // Struktur passt nicht an die Einfügestelle – Standard-Paste (Text) zulassen.
            return false;
          }
        },
      },
      onBlur: ({ editor: instance }) => {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        commit(instance);
      },
      onSelectionUpdate: ({ editor: instance }) => {
        const { from, to } = instance.state.selection;
        if (to > from) selectionRef.current = { from, to };
      },
      onUpdate: ({ editor: instance }) => scheduleCommit(instance),
    },
    [],
  );

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    const current = canonicalize(docToContent(editor.getJSON()));
    const incomingDoc = contentToDoc(content);
    if (current === canonicalize(docToContent(incomingDoc))) return;
    if (editor.isFocused) return;
    editor.commands.setContent(incomingDoc, { emitUpdate: false });
  }, [content, editor]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const empty = editor ? editor.isEmpty : true;

  return (
    <div
      className={`rte${focusWithin ? " is-focused" : ""}`}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        // Fokus innerhalb des Editors oder der Leiste (z. B. Farbwähler) behält die Leiste offen.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setFocusWithin(false);
        selectionRef.current = null;
      }}
    >
      <div className="rte-toolbar-holder" hidden={!focusWithin}>
        {editor ? (
          <RichToolbar
            editor={editor}
            style={style}
            onStyleChange={onStyleChange}
            palette={palette}
            selectionRef={selectionRef}
            onMarkdown={() => setMarkdownOpen(true)}
          />
        ) : null}
      </div>
      <div
        className="rte-shell"
        data-empty={empty ? "true" : "false"}
        data-placeholder={placeholder}
      >
        <EditorContent editor={editor} />
      </div>
      {markdownOpen ? (
        <MarkdownDialog
          content={contentRef.current}
          onApply={(next) => onContentChange(next)}
          onClose={() => setMarkdownOpen(false)}
        />
      ) : null}
    </div>
  );
}
