import { useMemo, useReducer } from "react";
import { BREAKPOINTS } from "../domain/layout";
import { createElement } from "../domain/catalog";
import { validateDocument } from "../domain/validate";
import type {
  Breakpoint,
  ElementLibrary,
  ElementType,
  Shell,
  TagContentDocument,
  TemplateElement,
  ThemeColors,
} from "../domain/types";

const MAX_HISTORY = 60;

export function updateElementInDoc(
  doc: TagContentDocument,
  elementId: string,
  patch: Partial<TemplateElement>,
): TagContentDocument {
  return {
    ...doc,
    elements: doc.elements.map((element) =>
      element.elementId === elementId ? { ...element, ...patch } : element,
    ),
  };
}

export function updatePlacementInDoc(
  doc: TagContentDocument,
  elementId: string,
  breakpoint: Breakpoint,
  patch: { span?: number; order?: number },
): TagContentDocument {
  return {
    ...doc,
    elements: doc.elements.map((element) => {
      if (element.elementId !== elementId) return element;
      const placement = element.placement ?? {};
      return {
        ...element,
        placement: {
          ...placement,
          span: { ...(placement.span ?? {}), ...(patch.span !== undefined ? { [breakpoint]: patch.span } : {}) },
          order: { ...(placement.order ?? {}), ...(patch.order !== undefined ? { [breakpoint]: patch.order } : {}) },
        },
      };
    }),
  };
}

export function addElementToDoc(
  doc: TagContentDocument,
  type: ElementType,
): { doc: TagContentDocument; elementId: string } {
  const maxOrder = doc.elements.reduce((max, element) => Math.max(max, element.displayOrder), 0);
  const element = createElement(type, maxOrder + 10);
  return { doc: { ...doc, elements: [...doc.elements, element] }, elementId: element.elementId };
}

export function removeElementFromDoc(doc: TagContentDocument, elementId: string): TagContentDocument {
  return { ...doc, elements: doc.elements.filter((element) => element.elementId !== elementId) };
}

export function moveElementInDoc(doc: TagContentDocument, elementId: string, delta: number): TagContentDocument {
  // Nur sichtbare Elemente werden sortiert; interne Elemente (z. B. `theme-assets`) bleiben verankert.
  const ordered = doc.elements
    .filter((element) => !element.hidden)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.elementId.localeCompare(right.elementId));
  const index = ordered.findIndex((element) => element.elementId === elementId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= ordered.length) return doc;

  const moving = ordered[index];
  const neighbour = ordered[target];

  /**
   * Übernimmt Platz und Position des Nachbarn. Die Platzierung wird für alle
   * Breakpoints mitgeschrieben, damit die Vorschau die neue Reihenfolge sofort zeigt
   * (sie sortiert nach `placement.order`, nicht nach `displayOrder`).
   */
  const adopt = (element: TemplateElement, from: TemplateElement): TemplateElement => {
    const order: Partial<Record<Breakpoint, number>> = {};
    for (const breakpoint of BREAKPOINTS) {
      order[breakpoint] = from.placement?.order?.[breakpoint] ?? from.displayOrder;
    }
    return {
      ...element,
      displayOrder: from.displayOrder,
      placement: { ...element.placement, order },
    };
  };

  return {
    ...doc,
    elements: doc.elements.map((element) => {
      if (element.elementId === moving.elementId) return adopt(moving, neighbour);
      if (element.elementId === neighbour.elementId) return adopt(neighbour, moving);
      return element;
    }),
  };
}

export function updateShellInDoc(doc: TagContentDocument, patch: Partial<Shell>): TagContentDocument {
  return { ...doc, shell: { ...doc.shell, ...patch } };
}

export function updateThemeColorsInDoc(doc: TagContentDocument, colors: Partial<ThemeColors>): TagContentDocument {
  return {
    ...doc,
    shell: { ...doc.shell, theme: { ...doc.shell.theme, colors: { ...doc.shell.theme.colors, ...colors } } },
  };
}

export interface EditorState {
  doc: TagContentDocument;
  library: ElementLibrary;
  templateFileName: string | null;
  libraryFileName: string | null;
  dirty: boolean;
  libraryDirty: boolean;
  selectedId: string | null;
  breakpoint: Breakpoint;
  past: TagContentDocument[];
  future: TagContentDocument[];
  log: string[];
  lastEditAt?: number;
}

export type EditorAction =
  | { type: "load"; doc: TagContentDocument; fileName: string | null; log: string[] }
  | { type: "replace"; doc: TagContentDocument; coalesce?: boolean; at?: number }
  | { type: "savedTemplate"; fileName: string }
  | { type: "select"; elementId: string | null }
  | { type: "breakpoint"; breakpoint: Breakpoint }
  | { type: "library"; library: ElementLibrary; fileName?: string | null; log?: string[] }
  | { type: "savedLibrary"; fileName: string }
  | { type: "undo" }
  | { type: "redo" };

export function createInitialState(doc: TagContentDocument, library: ElementLibrary): EditorState {
  const firstVisible = doc.elements.find((element) => !element.hidden) ?? doc.elements[0];
  return {
    doc,
    library,
    templateFileName: null,
    libraryFileName: null,
    dirty: false,
    libraryDirty: false,
    selectedId: firstVisible?.elementId ?? null,
    breakpoint: "desktop",
    past: [],
    future: [],
    log: [],
    lastEditAt: 0,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return {
        ...createInitialState(action.doc, state.library),
        templateFileName: action.fileName,
        log: action.log,
      };
    case "replace": {
      const at = action.at ?? 0;
      // Tipp-Bursts (z. B. zeichenweises Editieren im Textfeld) landen in einem Undo-Schritt.
      const coalesce = action.coalesce === true && at > 0 && at - (state.lastEditAt ?? 0) < 800;
      return {
        ...state,
        doc: action.doc,
        dirty: true,
        past: coalesce ? state.past : [...state.past.slice(-MAX_HISTORY + 1), state.doc],
        future: [],
        lastEditAt: at,
      };
    }
    case "savedTemplate":
      return { ...state, dirty: false, templateFileName: action.fileName };
    case "select":
      return { ...state, selectedId: action.elementId };
    case "breakpoint":
      return { ...state, breakpoint: action.breakpoint };
    case "library":
      return {
        ...state,
        library: action.library,
        libraryFileName: action.fileName ?? state.libraryFileName,
        libraryDirty: false,
        log: action.log ?? state.log,
      };
    case "savedLibrary":
      return { ...state, libraryDirty: false, libraryFileName: action.fileName };
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, MAX_HISTORY),
        dirty: true,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        dirty: true,
      };
    }
    default:
      return state;
  }
}

export function useEditor(initialDoc: TagContentDocument, initialLibrary: ElementLibrary) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    createInitialState(initialDoc, initialLibrary),
  );
  const issues = useMemo(() => validateDocument(state.doc), [state.doc]);
  const blocking = issues.some((entry) => entry.blocking);
  const errors = issues.filter((entry) => entry.severity === "error").length;
  const warnings = issues.filter((entry) => entry.severity === "warning").length;
  return { state, dispatch, issues, blocking, errors, warnings };
}

