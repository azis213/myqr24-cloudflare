import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createDocument, TAG_TYPE_LABELS, TAG_TYPES } from "../domain/catalog";
import { DocumentError } from "../domain/errors";
import { PREVIEW_PRESETS, PREVIEW_WIDTHS, breakpointForWidth, type LayoutView } from "../domain/layout";
import { layoutHints } from "../domain/layoutChecks";
import { bumpLibrary, mergeLibraries, validateLibrary } from "../domain/library";
import { migrateDocument } from "../domain/migrate";
import { canonicalize, documentFileName, libraryFileName } from "../domain/serialize";
import { SCHEMA_VERSION } from "../domain/types";
import type {
  ElementLibrary,
  ElementStyle,
  RichTextContent,
  TagContentDocument,
  TagType,
  TemplateElement,
} from "../domain/types";
import { validateDocument } from "../domain/validate";
import { TagContentPreview } from "../preview/TagContentPreview";
import {
  downloadTextFile,
  jsonFileTypes,
  openTextFile,
  rememberHandle,
  saveAsTextFile,
  supportsFileSystemAccess,
  writeToHandle,
  type FileHandleLike,
} from "../state/fileAccess";
import { addElementToDoc, moveElementInDoc, removeElementFromDoc, setCustomColorsInDoc, updateElementInDoc, useEditor } from "../state/store";
import { saveSession } from "../state/session";
import { addCustomColor, removeCustomColor, type PaletteContext } from "../rich/palette";
import { Inspector } from "./Inspector";
import { JsonPanel, Outline, ValidationPanel } from "./Panels";
import { useMeasuredWidth } from "./useMeasuredWidth";

const templateTypes = () => jsonFileTypes("TAG-Content-Template", ".tagcontent.json");
const libraryTypes = () => jsonFileTypes("Element-Bibliothek", ".tagelements.json");

function describeLoad(source: Record<string, unknown>, changes: string[], migrated: boolean, from: number): string {
  const parts = [`Geladen (schemaVersion ${from}${migrated ? ` → ${SCHEMA_VERSION}` : ""})`];
  if (changes.length > 0) parts.push(`${changes.length} Feld(er) ergänzt`);
  const found = validateDocument(source);
  const errorCount = found.filter((entry) => entry.severity === "error").length;
  const warningCount = found.filter((entry) => entry.severity === "warning").length;
  parts.push(`${errorCount} Fehler, ${warningCount} Warnungen`);
  return parts.join(" · ");
}

export function App({
  initialDoc,
  initialLibrary,
  bundledTemplates,
  initialSource,
}: {
  initialDoc: TagContentDocument;
  initialLibrary: ElementLibrary;
  bundledTemplates: Array<{ id: string; label: string; path: string }>;
  /** Hinweis, woher der Startzustand kommt (z. B. „zuletzt verwendet · …"). */
  initialSource?: string | null;
}) {
  const { state, dispatch, issues, blocking, errors, warnings } = useEditor(initialDoc, initialLibrary);
  const [templateHandle, setTemplateHandle] = useState<FileHandleLike | null>(null);
  const [libraryHandle, setLibraryHandle] = useState<FileHandleLike | null>(null);
  const [message, setMessage] = useState<string>(
    initialSource ? `Letzte Konfiguration geladen (${initialSource}).` : "Bereit.",
  );
  const [error, setError] = useState<string | null>(null);
  const [newTagType, setNewTagType] = useState<TagType>("vault");

  const doc = state.doc;
  const fileApiAvailable = useMemo(() => supportsFileSystemAccess(), []);

  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try {
      const stored = Number(window.localStorage.getItem("myqr24.tcd.leftWidth"));
      if (Number.isFinite(stored) && stored >= 220 && stored <= 680) return stored;
    } catch {
      /* localStorage kann blockiert sein */
    }
    return 320;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("myqr24.tcd.leftWidth", String(Math.round(leftWidth)));
    } catch {
      /* Komfort, kein Muss */
    }
  }, [leftWidth]);

  const [rightWidth, setRightWidth] = useState<number>(() => {
    try {
      const stored = Number(window.localStorage.getItem("myqr24.tcd.rightWidth"));
      if (Number.isFinite(stored) && stored >= 280 && stored <= 760) return stored;
    } catch {
      /* localStorage kann blockiert sein */
    }
    return 380;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("myqr24.tcd.rightWidth", String(Math.round(rightWidth)));
    } catch {
      /* Komfort, kein Muss */
    }
  }, [rightWidth]);

  /**
   * Simulierte Vorschau-Breite: eine der Handy-/Tablet-/Web-Breiten oder `fit`
   * (= tatsächlicher Platz im Vorschaubereich, ohne Scrollbalken).
   */
  const [previewWidth, setPreviewWidth] = useState<number | "fit">(() => {
    try {
      const stored = window.localStorage.getItem("myqr24.tcd.previewWidth");
      if (stored === "fit") return "fit";
      const value = Number(stored);
      if (PREVIEW_PRESETS.some((preset) => preset.widthPx === value)) return value;
    } catch {
      /* localStorage kann blockiert sein */
    }
    return "fit";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("myqr24.tcd.previewWidth", String(previewWidth));
    } catch {
      /* Komfort, kein Muss */
    }
  }, [previewWidth]);

  const { ref: centerRef, width: centerWidth } = useMeasuredWidth(PREVIEW_WIDTHS.desktop);
  const fit = previewWidth === "fit";
  const shownWidth = fit ? Math.max(280, centerWidth) : previewWidth;
  const shownBreakpoint = breakpointForWidth(shownWidth);

  /**
   * Ein Schalter für alle Breiten: `compact` zeigt das echte Raster, `stacked` legt
   * alle Elemente untereinander. Reine Ansichtssache – wird nie im Dokument gespeichert.
   */
  const [view, setView] = useState<LayoutView>(() => {
    try {
      return window.localStorage.getItem("myqr24.tcd.previewColumns") === "stacked" ? "stacked" : "compact";
    } catch {
      return "compact";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("myqr24.tcd.previewColumns", view);
    } catch {
      /* Komfort, kein Muss */
    }
  }, [view]);

  // Der Inspector bearbeitet immer den Breakpoint, den die Vorschau gerade zeigt.
  useEffect(() => {
    if (state.breakpoint !== shownBreakpoint) {
      dispatch({ type: "breakpoint", breakpoint: shownBreakpoint });
    }
  }, [shownBreakpoint, state.breakpoint, dispatch]);

  const hints = useMemo(() => layoutHints(doc, shownWidth), [doc, shownWidth]);

  const beginResizeRight = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = rightWidth;
      const onMove = (moveEvent: PointerEvent) => {
        // Nach links ziehen vergrößert die rechte Spalte.
        setRightWidth(Math.min(760, Math.max(280, startWidth - (moveEvent.clientX - startX))));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove("is-resizing");
      };
      document.body.classList.add("is-resizing");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [rightWidth],
  );

  const beginResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = leftWidth;
      const onMove = (moveEvent: PointerEvent) => {
        setLeftWidth(Math.min(680, Math.max(220, startWidth + moveEvent.clientX - startX)));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove("is-resizing");
      };
      document.body.classList.add("is-resizing");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [leftWidth],
  );

  /** Einheitlicher Pfad für Änderungen; `coalesce` bündelt Tipp-Bursts zu einem Undo-Schritt. */
  const applyDoc = useCallback(
    (next: TagContentDocument, coalesce = false) => {
      dispatch({ type: "replace", doc: next, coalesce, at: Date.now() });
    },
    [dispatch],
  );

  const handleContentChange = useCallback(
    (element: TemplateElement, content: RichTextContent) => {
      applyDoc(updateElementInDoc(doc, element.elementId, { content }), true);
    },
    [applyDoc, doc],
  );

  const handleElementStyleChange = useCallback(
    (element: TemplateElement, patch: Partial<ElementStyle>) => {
      applyDoc(updateElementInDoc(doc, element.elementId, { style: { ...element.style, ...patch } }), true);
    },
    [applyDoc, doc],
  );

  // „Letzte Konfiguration": entprellt lokal sichern, beim Start/Reload wieder einlesen (main.tsx).
  useEffect(() => {
    const timer = window.setTimeout(() => saveSession(doc), 800);
    return () => window.clearTimeout(timer);
  }, [doc]);

  /** Farbangebot der Formatierleiste; eigene Farben liegen in der Konfiguration (`doc.palette`). */
  const palette = useMemo<PaletteContext>(
    () => ({
      themeColors: doc.shell.theme.colors,
      custom: doc.palette?.custom ?? [],
      onAddCustom: (hex) =>
        applyDoc(setCustomColorsInDoc(doc, addCustomColor(doc.palette?.custom ?? [], hex)), true),
      onRemoveCustom: (hex) =>
        applyDoc(setCustomColorsInDoc(doc, removeCustomColor(doc.palette?.custom ?? [], hex)), true),
    }),
    [applyDoc, doc],
  );

  useEffect(() => {
    if (!state.dirty && !state.libraryDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.dirty, state.libraryDirty]);

  const loadTemplateFromText = useCallback(
    (text: string, name: string | null) => {
      const parsed = JSON.parse(text) as unknown;
      const result = migrateDocument(parsed);
      const migratedDoc = result.document as unknown as TagContentDocument;
      const found = validateDocument(migratedDoc);
      const blockingIssue = found.find((entry) => entry.blocking);
      setError(
        blockingIssue
          ? `Reparaturmodus: ${blockingIssue.code} bei ${blockingIssue.path || "Dokument"} – ${blockingIssue.message}`
          : null,
      );
      const log = [describeLoad(result.document, result.changes, result.migrated, result.from)];
      dispatch({ type: "load", doc: migratedDoc, fileName: name, log });
      setMessage(log[0]);
    },
    [dispatch],
  );

  const handleLoad = useCallback(async () => {
    setError(null);
    try {
      const picked = await openTextFile(templateTypes());
      if (!picked) {
        setError("Dieser Browser bietet keinen direkten Dateizugriff. Bitte den Datei-Dialog des Fallbacks nutzen.");
        return;
      }
      loadTemplateFromText(picked.text, picked.handle.name);
      setTemplateHandle(picked.handle);
      await rememberHandle("template", picked.handle, picked.handle.name);
    } catch (caught) {
      if (caught instanceof DocumentError) {
        setError(`${caught.code}: ${caught.message}${caught.hint ? ` – ${caught.hint}` : ""}`);
      } else {
        setError(caught instanceof Error ? caught.message : "Unbekannter Fehler beim Laden.");
      }
    }
  }, [loadTemplateFromText]);

  const loadBundledTemplate = useCallback(
    async (path: string) => {
      try {
        const response = await fetch(path);
        loadTemplateFromText(await response.text(), null);
        setTemplateHandle(null);
      } catch {
        setError("Vorlage konnte nicht geladen werden.");
      }
    },
    [loadTemplateFromText],
  );

  const handleNew = useCallback(() => {
    const created = createDocument({
      templateId: `tct_${newTagType.replace(/[^a-z0-9]/g, "")}_${Date.now().toString(36)}`,
      tagType: newTagType,
      name: `Neues ${TAG_TYPE_LABELS[newTagType]}-Template`,
    });
    dispatch({ type: "load", doc: created, fileName: null, log: ["Neues Template erstellt."] });
    setTemplateHandle(null);
    setMessage("Neues Template erstellt.");
  }, [dispatch, newTagType]);

  const downloadJson = useCallback(() => {
    downloadTextFile(documentFileName(doc.template.templateId, doc.template.templateVersion), canonicalize(doc));
  }, [doc]);

  const handleSave = useCallback(async () => {
    if (blocking) return;
    const text = canonicalize(state.doc);
    try {
      if (templateHandle && (await writeToHandle(templateHandle, text))) {
        dispatch({ type: "savedTemplate", fileName: templateHandle.name });
        setMessage(`In ${templateHandle.name} gespeichert.`);
        return;
      }
      const handle = await saveAsTextFile(
        documentFileName(doc.template.templateId, doc.template.templateVersion),
        text,
        templateTypes(),
      );
      if (handle) {
        setTemplateHandle(handle);
        await rememberHandle("template", handle, handle.name);
        dispatch({ type: "savedTemplate", fileName: handle.name });
        setMessage(`Als ${handle.name} gespeichert.`);
      } else {
        dispatch({ type: "savedTemplate", fileName: `${doc.template.templateId}.tagcontent.json` });
        setMessage("Ohne direkten Dateizugriff als Download gespeichert.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen.");
    }
  }, [blocking, dispatch, doc.template.templateId, doc.template.templateVersion, state.doc, templateHandle]);

  const handleSaveAs = useCallback(async () => {
    if (blocking) return;
    const text = canonicalize(state.doc);
    try {
      const handle = await saveAsTextFile(
        documentFileName(doc.template.templateId, doc.template.templateVersion),
        text,
        templateTypes(),
      );
      if (handle) {
        setTemplateHandle(handle);
        await rememberHandle("template", handle, handle.name);
        dispatch({ type: "savedTemplate", fileName: handle.name });
        setMessage(`Als ${handle.name} gespeichert.`);
      } else {
        dispatch({ type: "savedTemplate", fileName: `${doc.template.templateId}.tagcontent.json` });
        setMessage("Als neue Datei heruntergeladen.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen.");
    }
  }, [blocking, dispatch, doc.template.templateId, doc.template.templateVersion, state.doc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      const inEditable = target?.isContentEditable === true;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) void handleSaveAs();
        else void handleSave();
        return;
      }
      if (key === "o") {
        event.preventDefault();
        void handleLoad();
        return;
      }
      // Im Textfeld bleibt das native Text-Undo des Browsers zuständig.
      if (inEditable) return;
      if (key === "e" && event.shiftKey) {
        event.preventDefault();
        setView((current) => (current === "compact" ? "stacked" : "compact"));
        return;
      }
      if (key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, handleLoad, handleSave, handleSaveAs]);

  const handleLoadLibrary = useCallback(async () => {
    setError(null);
    try {
      const picked = await openTextFile(libraryTypes());
      if (!picked) {
        setError("Datei-Dialog nicht verfügbar; Bibliothek kann nicht geladen werden.");
        return;
      }
      const parsed = JSON.parse(picked.text) as unknown;
      const blockingIssue = validateLibrary(parsed).find((entry) => entry.blocking);
      if (blockingIssue) {
        setError(`${blockingIssue.code}: ${blockingIssue.message}`);
        return;
      }
      const merged = mergeLibraries(state.library, parsed as ElementLibrary);
      const added = merged.changes.filter((entry) => entry.action === "added").length;
      const replaced = merged.changes.filter((entry) => entry.action === "replaced").length;
      dispatch({
        type: "library",
        library: merged.library,
        fileName: picked.handle.name,
        log: [`Bibliothek geladen: ${added} neu, ${replaced} ersetzt.`],
      });
      setLibraryHandle(picked.handle);
      await rememberHandle("library", picked.handle, picked.handle.name);
      setMessage(`Bibliothek ${picked.handle.name} geladen (${added} neu, ${replaced} ersetzt).`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Bibliothek konnte nicht geladen werden.");
    }
  }, [dispatch, state.library]);

  const handleSaveLibrary = useCallback(
    async (asNew: boolean) => {
      const library = asNew ? bumpLibrary(state.library) : state.library;
      const text = canonicalize(library);
      try {
        if (!asNew && libraryHandle) {
          if (await writeToHandle(libraryHandle, text)) {
            dispatch({ type: "savedLibrary", fileName: libraryHandle.name });
            setMessage(`Bibliothek in ${libraryHandle.name} gespeichert.`);
            return;
          }
        }
        if (!asNew) dispatch({ type: "library", library });
        const handle = await saveAsTextFile(libraryFileName(library.libraryVersion), text, libraryTypes());
        if (handle) {
          setLibraryHandle(handle);
          await rememberHandle("library", handle, handle.name);
          dispatch({ type: "savedLibrary", fileName: handle.name });
          setMessage(`Bibliothek als ${handle.name} gespeichert.`);
        } else {
          dispatch({ type: "savedLibrary", fileName: libraryFileName(library.libraryVersion) });
          setMessage("Bibliothek als Download gespeichert.");
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Bibliothek konnte nicht gespeichert werden.");
      }
    },
    [dispatch, libraryHandle, state.library],
  );

  const resetLibrary = useCallback(async () => {
    try {
      const response = await fetch("/elements/default.tagelements.json");
      const library = (await response.json()) as ElementLibrary;
      dispatch({ type: "library", library, fileName: "Default-Bibliothek" });
      setLibraryHandle(null);
      setMessage("Default-Bibliothek geladen.");
    } catch {
      setError("Default-Bibliothek konnte nicht geladen werden.");
    }
  }, [dispatch]);


  const selected = doc.elements.find((entry) => entry.elementId === state.selectedId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>myQR24 TAG-Content-Designer</strong>
          <span className="sub">
            {state.templateFileName ?? "nicht gespeichert"}
            {state.dirty ? " •" : ""}
          </span>
        </div>

        <div className="group">
          <select value={newTagType} onChange={(event) => setNewTagType(event.target.value as TagType)}>
            {TAG_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {TAG_TYPE_LABELS[entry]}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleNew}>
            Neu
          </button>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) void loadBundledTemplate(event.target.value);
            }}
          >
            <option value="">Vorlage laden…</option>
            {bundledTemplates.map((entry) => (
              <option key={entry.id} value={entry.path}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        <div className="group">
          <button type="button" onClick={() => void handleLoad()}>
            Load
          </button>
          <button type="button" className="primary" disabled={blocking} onClick={() => void handleSave()}>
            Save
          </button>
          <button type="button" disabled={blocking} onClick={() => void handleSaveAs()}>
            Save as
          </button>
          <button type="button" onClick={downloadJson}>
            Download
          </button>
        </div>

        <div className="group">
          <button type="button" disabled={state.past.length === 0} onClick={() => dispatch({ type: "undo" })}>
            ↶
          </button>
          <button type="button" disabled={state.future.length === 0} onClick={() => dispatch({ type: "redo" })}>
            ↷
          </button>
        </div>

        <div className="group preview-group" role="group" aria-label="Vorschau-Breite">
          {PREVIEW_PRESETS.map((preset, index) => (
            <span key={preset.widthPx} className="preview-slot">
              {index === 0 || PREVIEW_PRESETS[index - 1].group !== preset.group ? (
                <span className="preview-group-label">{preset.group}</span>
              ) : null}
              <button
                type="button"
                className={previewWidth === preset.widthPx ? "active" : ""}
                title={`${preset.group} · ${preset.widthPx} px simulieren`}
                onClick={() => setPreviewWidth(preset.widthPx)}
              >
                {preset.widthPx}
              </button>
            </span>
          ))}
          <button
            type="button"
            className={fit ? "active" : ""}
            title="Verfügbaren Platz nutzen (ohne Scrollbalken)"
            onClick={() => setPreviewWidth("fit")}
          >
            Fit
          </button>
          <button
            type="button"
            className={view === "compact" ? "active" : ""}
            aria-pressed={view === "compact"}
            title="Compact: mehrspaltig, wenn Platz ist · aus: alle Elemente untereinander (Strg+Shift+E)"
            onClick={() => setView((current) => (current === "compact" ? "stacked" : "compact"))}
          >
            Compact
          </button>
        </div>
      </header>

      <div className="librarybar">
        <span>
          Element-Bibliothek: <strong>{state.libraryFileName ?? "Default-Bibliothek"}</strong> · v
          {state.library.libraryVersion} · {state.library.elements.length} Bausteine
        </span>
        <span className="group">
          <button type="button" onClick={() => void handleLoadLibrary()}>
            Load
          </button>
          <button type="button" onClick={() => void handleSaveLibrary(false)}>
            Save
          </button>
          <button type="button" onClick={() => void handleSaveLibrary(true)}>
            Save as
          </button>
          <button type="button" onClick={() => void resetLibrary()}>
            Default
          </button>
        </span>
      </div>

      {!fileApiAvailable ? (
        <p className="notice">
          Dieser Browser unterstützt kein direktes Schreiben in dieselbe Datei. „Save" lädt eine neue Datei
          herunter; „Load" öffnet einen Datei-Dialog.
        </p>
      ) : null}
      {error ? <p className="errorbar">{error}</p> : null}
      <p className="statusbar">
        {message} · {errors} Fehler · {warnings} Warnungen
      </p>

      <main
        className="workspace"
        style={{ ["--left-width" as string]: `${leftWidth}px`, ["--right-width" as string]: `${rightWidth}px` }}
      >
        <aside className="left">
          <Outline
            doc={doc}
            selectedId={state.selectedId}
            onSelect={(elementId) => dispatch({ type: "select", elementId })}
            onAdd={(type) => {
              const result = addElementToDoc(doc, type);
              applyDoc(result.doc);
              dispatch({ type: "select", elementId: result.elementId });
            }}
            onRemove={(elementId) => applyDoc(removeElementFromDoc(doc, elementId))}
            onMove={(elementId, delta) => applyDoc(moveElementInDoc(doc, elementId, delta))}
          />
          <JsonPanel doc={doc} />
        </aside>

        <div
          className="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Breite der linken Leiste ändern"
          title="Ziehen, um die linke Leiste zu vergrößern"
          onPointerDown={beginResize}
        >
          <span className="splitter-grip" aria-hidden="true" />
        </div>

        <section className="center" ref={centerRef}>
          <div className="preview-frame" style={{ width: fit ? "100%" : `${shownWidth}px` }}>
            <TagContentPreview
              doc={doc}
              widthPx={shownWidth}
              fit={fit}
              view={view}
              selectedId={state.selectedId}
              onSelect={(elementId) => dispatch({ type: "select", elementId })}
              editing={{ onContentChange: handleContentChange, onStyleChange: handleElementStyleChange, palette }}
            />
          </div>
          {hints.length > 0 ? (
            <div className="preview-hints-wrap">
              {view === "stacked" ? (
                <p className="preview-hints-note">Hinweise zur mehrspaltigen Ausgabe:</p>
              ) : null}
              <ul className="preview-hints" role="status" aria-label="Layout-Hinweise">
                {hints.map((hint) => (
                  <li key={`${hint.id}-${hint.elementId ?? "doc"}`} className={`preview-hint ${hint.severity}`}>
                    {hint.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <div
          className="splitter splitter-right"
          role="separator"
          aria-orientation="vertical"
          aria-label="Breite der rechten Spalte ändern"
          title="Ziehen, um die rechte Spalte zu vergrößern"
          onPointerDown={beginResizeRight}
        >
          <span className="splitter-grip" aria-hidden="true" />
        </div>

        <aside className="right">
          <Inspector
            doc={doc}
            selectedId={selected ? selected.elementId : null}
            breakpoint={state.breakpoint}
            onChange={(next) => dispatch({ type: "replace", doc: next })}
          />
        </aside>
      </main>

      <footer className="bottom">
        <ValidationPanel
          doc={doc}
          issues={issues}
          onSelect={(elementId) => dispatch({ type: "select", elementId })}
        />
      </footer>
    </div>
  );
}

