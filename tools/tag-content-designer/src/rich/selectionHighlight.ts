import { Extension } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SelectionRange {
  from: number;
  to: number;
}

export const REMEMBERED_SELECTION_KEY = new PluginKey<SelectionRange | null>("rememberedSelection");

/**
 * Hält die zuletzt markierte Spanne sichtbar, während die Formatierleiste bedient wird.
 * Der Editor verliert beim Klick in ein Auswahlfeld den Fokus und würde die Markierung
 * sonst ausblenden – hier bleibt sie als dezente Dekoration stehen, bis der Nutzer
 * wieder in den Text klickt.
 */
export const RememberedSelection = Extension.create({
  name: "rememberedSelection",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin<SelectionRange | null>({
        key: REMEMBERED_SELECTION_KEY,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(REMEMBERED_SELECTION_KEY);
            return meta === undefined ? value : (meta as SelectionRange | null);
          },
        },
        props: {
          decorations: (state) => {
            // Hat der Editor den Fokus, zeichnet ProseMirror die Auswahl selbst.
            if (editor.isFocused) return null;
            const range = REMEMBERED_SELECTION_KEY.getState(state);
            if (!range) return null;
            if (range.from < 0 || range.to > state.doc.content.size || range.from >= range.to) return null;
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, range.to, { class: "rte-remembered" }),
            ]);
          },
        },
      }),
    ];
  },
});

/** Merkt/vergisst die sichtbare Spanne über eine reine Meta-Transaktion. */
export function setRememberedSelection(view: EditorView, range: SelectionRange | null): void {
  view.dispatch(view.state.tr.setMeta(REMEMBERED_SELECTION_KEY, range));
}
