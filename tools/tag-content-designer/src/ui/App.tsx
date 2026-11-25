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
  Principal,
  RichTextContent,
  TagContentDocument,
  TagType,
  TemplateElement,
} from "../domain/types";
import { validateDocument } from "../domain/validate";
import { parseSample, type TagSample } from "../preview/sample";
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
  bundledTemplates: Array<{
    id: string;
    label: string;
    path: string;
    group?: string;
    description?: string;
    samplePath?: string;
  }>;
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
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishEnvironment, setPublishEnvironment] = useState<"local" | "staging">(() => {
    try {
      return window.localStorage.getItem("myqr24.tcd.publish.environment") === "staging" ? "staging" : "local";
    } catch {
      return "local";
    }
  });
  const [publishTemplateId, setPublishTemplateId] = useState(() => {
    try {
      return window.localStorage.getItem("myqr24.tcd.publish.templateId") ?? initialDoc.template.templateId;
    } catch {
      return initialDoc.template.templateId;
    }
  });
  const [publishTagId, setPublishTagId] = useState(() => {
    try {
      return window.localStorage.getItem("myqr24.tcd.publish.tagId") ?? "";
    } catch {
      return "";
    }
  });
  const [publishNumericId, setPublishNumericId] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishResult, setPublishResult] = useState<Record<string, unknown> | null>(null);
  const [publishConfirm, setPublishConfirm] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);
  const [testTagRouting, setTestTagRouting] = useState({
    status: "active",
    targetType: "internal",
    protectionMode: "public",
    externalUrl: "",
    accessVersion: "1",
    contentRevision: "1",
    schemaVersion: "1",
  });
  const [testTagAdminConfirm, setTestTagAdminConfirm] = useState("");
  const [testTagDeleteConfirmOpen, setTestTagDeleteConfirmOpen] = useState(false);
  const [testTagExists, setTestTagExists] = useState(false);
  const [testTagHasData, setTestTagHasData] = useState(false);
  const [testTagAdminAvailable, setTestTagAdminAvailable] = useState(false);
  const [testTagAdminResult, setTestTagAdminResult] = useState<Record<string, unknown> | null>(null);
  const [testTagAdminStatus, setTestTagAdminStatus] = useState("");
  const [testTagAdminError, setTestTagAdminError] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem("myqr24.tcd.publish.environment", publishEnvironment);
      window.localStorage.setItem("myqr24.tcd.publish.tagId", publishTagId);
      window.localStorage.setItem("myqr24.tcd.publish.templateId", publishTemplateId);
    } catch {
      /* Publish-Komfort, kein Muss; hier werden keine Secrets gespeichert. */
    }
  }, [publishEnvironment, publishTagId, publishTemplateId]);

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

  /**
   * Beispieldaten sind Editor-Kontext: Sie füllen Slots mit Bildern, Dokumenten und
   * Einträgen, werden aber nie ins Template geschrieben (siehe `D-60`).
   */
  const [sample, setSample] = useState<TagSample | null>(null);
  const [sampleData, setSampleData] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("myqr24.tcd.sampleData") !== "off";
    } catch {
      return true;
    }
  });
  const [role, setRole] = useState<Principal>(() => {
    try {
      const stored = window.localStorage.getItem("myqr24.tcd.sampleRole");
      return stored === "owner" || stored === "scanner" ? stored : "guest";
    } catch {
      return "guest";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("myqr24.tcd.sampleData", sampleData ? "on" : "off");
    } catch {
      /* Komfort, kein Muss */
    }
  }, [sampleData]);

  useEffect(() => {
    try {
      window.localStorage.setItem("myqr24.tcd.sampleRole", role);
    } catch {
      /* Komfort, kein Muss */
    }
  }, [role]);

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
      // Beispieldaten gelten nur für das Beispiel, aus dem sie stammen.
      setSample(null);
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
    async (path: string, samplePath?: string) => {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error("Vorlage fehlt");
        loadTemplateFromText(await response.text(), null);
        setTemplateHandle(null);
        if (!samplePath) return;
        const sampleResponse = await fetch(samplePath);
        if (!sampleResponse.ok) throw new Error("Beispieldaten fehlen");
        const parsed = parseSample(await sampleResponse.json());
        if (!parsed.sample) {
          setError(`Beispieldaten unvollständig: ${parsed.issues[0]?.message ?? "unbekannter Fehler"}`);
          return;
        }
        setSample(parsed.sample);
        setSampleData(true);
        setMessage(
          `Beispiel geladen: ${parsed.sample.media.length} Medien, ${parsed.sample.documents.length} Dokumente, ${
            parsed.sample.entries.length
          } Wartungseinträge.`,
        );
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
    setSample(null);
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

  const resolvePublishTagId = useCallback(async () => {
    setPublishError("");
    setPublishStatus("");
    setPublishResult(null);
    setPublishNumericId("");
    const tagId = publishTagId.trim().toLowerCase();
    if (!/^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/u.test(tagId)) {
      setPublishError("Base36-TAG-ID muss 6, 8 oder 10 Zeichen lang sein.");
      return;
    }
    setPublishBusy(true);
    try {
      const response = await fetch("/__tag-content/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ environment: publishEnvironment, tagId }),
      });
      const result = await response.json() as { tagNumericId?: unknown; error?: unknown };
      if (!response.ok || typeof result.tagNumericId !== "string") {
        throw new Error(typeof result.error === "string" ? result.error : `ID konnte nicht aufgelöst werden (HTTP ${response.status}).`);
      }
      setPublishTagId(tagId);
      setPublishNumericId(result.tagNumericId);
      setPublishStatus("Numeric-ID erfolgreich über den Codec ermittelt.");
    } catch (caught) {
      setPublishError(caught instanceof Error ? caught.message : "Codec-Lookup fehlgeschlagen.");
    } finally {
      setPublishBusy(false);
    }
  }, [publishEnvironment, publishTagId]);

  const callTestTagAdmin = useCallback(async (operation: "get" | "save" | "delete") => {
    setTestTagAdminError("");
    setTestTagAdminStatus("");
    setTestTagAdminResult(null);
    const tagId = publishTagId.trim().toLowerCase();
    if (!publishNumericId || !/^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/u.test(tagId)) {
      setTestTagAdminError("Löse zuerst die Base36-ID mit dem Codec auf.");
      return;
    }
    if (publishEnvironment !== "local" && publishEnvironment !== "staging") {
      setTestTagAdminError("Test-TAG-Verwaltung ist nur lokal und in Staging verfügbar.");
      return;
    }
    if (operation === "save" && testTagRouting.targetType === "external") {
      try {
        const external = new URL(testTagRouting.externalUrl);
        if (external.protocol !== "https:" || external.username || external.password) throw new Error();
      } catch {
        setTestTagAdminError("External URL muss eine gültige HTTPS-URL ohne Zugangsdaten sein.");
        return;
      }
    }
    const expectedConfirmation = operation === "delete" ? `DELETE ${publishEnvironment.toUpperCase()} ${tagId}` : "";
    if (operation === "delete" && testTagAdminConfirm !== expectedConfirmation) {
      setTestTagAdminError(`Gib ${expectedConfirmation} exakt ein, um alle D1-/R2-Daten dieses TAGs zu löschen.`);
      return;
    }

    setPublishBusy(true);
    try {
      const response = await fetch("/__tag-content/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation,
          environment: publishEnvironment,
          tagId,
          tagNumericId: publishNumericId,
          confirm: expectedConfirmation,
          status: testTagRouting.status,
          targetType: testTagRouting.targetType,
          protectionMode: testTagRouting.protectionMode,
          externalUrl: testTagRouting.targetType === "external" ? testTagRouting.externalUrl : null,
          accessVersion: Number(testTagRouting.accessVersion),
          contentRevision: Number(testTagRouting.contentRevision),
          schemaVersion: Number(testTagRouting.schemaVersion),
        }),
      });
      const result = await response.json() as Record<string, unknown>;
      setTestTagAdminResult(result);
      if (!response.ok && !(operation === "get" && response.status === 404 && result.exists === false)) {
        const detail = typeof result.error === "string" ? result.error : `Test-TAG-Verwaltung fehlgeschlagen (HTTP ${response.status}).`;
        throw new Error(detail);
      }
      if (operation === "get") {
        const exists = result.exists === true;
        setTestTagExists(exists);
        setTestTagHasData(exists || result.hasData === true);
        if (exists) {
          setTestTagRouting({
            status: String(result.status),
            targetType: String(result.target_type),
            protectionMode: String(result.protection_mode),
            externalUrl: typeof result.external_url === "string" ? result.external_url : "",
            accessVersion: String(result.access_version),
            contentRevision: String(result.content_revision),
            schemaVersion: String(result.schema_version),
          });
          setTestTagAdminStatus("Lokaler/Staging-Routing-Eintrag geladen.");
        } else {
          setTestTagAdminStatus("Noch kein Routing-Eintrag vorhanden; Speichern legt den TAG an.");
        }
      } else if (operation === "save") {
        setTestTagExists(true);
        setTestTagHasData(true);
        setTestTagAdminStatus(`TAG-Routing in ${publishEnvironment} gespeichert.`);
      } else {
        setTestTagExists(false);
        setTestTagHasData(false);
        setPublishNumericId("");
        setPublishConfirm("");
        setTestTagAdminConfirm("");
        setTestTagDeleteConfirmOpen(false);
        setTestTagAdminStatus(`TAG ${tagId} und seine TAG-eigenen D1-/R2-Daten wurden in ${publishEnvironment} gelöscht.`);
      }
    } catch (caught) {
      setTestTagAdminError(caught instanceof Error ? caught.message : "Test-TAG-Verwaltung fehlgeschlagen.");
    } finally {
      setPublishBusy(false);
    }
  }, [publishEnvironment, publishNumericId, publishTagId, testTagAdminConfirm, testTagRouting]);

  const checkTestTagAdmin = useCallback(async () => {
    setTestTagAdminAvailable(false);
    try {
      const response = await fetch("/__tag-content/admin-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ environment: publishEnvironment }),
      });
      const result = await response.json() as { enabled?: unknown };
      setTestTagAdminAvailable(response.ok && result.enabled === true);
      if (!response.ok || result.enabled !== true) setTestTagAdminError("Test-TAG-API ist für diese Umgebung nicht freigeschaltet; Verwaltungsaktionen bleiben deaktiviert.");
      else setTestTagAdminError("");
    } catch {
      setTestTagAdminAvailable(false);
      setTestTagAdminError("Test-TAG-API ist nicht erreichbar; Verwaltungsaktionen bleiben deaktiviert.");
    }
  }, [publishEnvironment]);

  const publishTagContent = useCallback(async () => {
    setPublishError("");
    setPublishStatus("");
    setPublishResult(null);
    if (blocking) {
      setPublishError("Template enthält blockierende Validierungsfehler und kann nicht veröffentlicht werden.");
      return;
    }
    if (testTagRouting.status !== "active" || testTagRouting.targetType !== "internal") {
      setPublishError("Content-Publish ist nur für active/internal TAG-Routing möglich. Ändere zuerst die lokale/Staging-Routingkonfiguration.");
      return;
    }
    const tagId = publishTagId.trim().toLowerCase();
    if (!publishNumericId || !/^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/u.test(tagId)) {
      setPublishError("Bitte zuerst eine gültige TAG-ID auflösen.");
      return;
    }
    if (publishConfirm !== `PUBLISH ${tagId}`) {
      setPublishError(`Gib PUBLISH ${tagId} exakt ein, um den vollständigen Ersatz zu bestätigen.`);
      return;
    }
    setPublishBusy(true);
    try {
      const response = await fetch("/__tag-content/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          environment: publishEnvironment,
          tagId,
          tagNumericId: publishNumericId,
          tagName: doc.template.name,
          confirm: publishConfirm,
          template: state.doc,
        }),
      });
      const result = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        const apiError = result.error;
        const detail = apiError && typeof apiError === "object" && "message" in apiError
          ? String((apiError as { message: unknown }).message)
          : typeof apiError === "string" ? apiError : `Publish fehlgeschlagen (HTTP ${response.status}).`;
        setPublishResult(result);
        throw new Error(detail);
      }
      setPublishResult(result);
      setPublishStatus(`Erfolgreich veröffentlicht: Revision ${String(result.revision ?? "unbekannt")} · ${String(result.status ?? "OK")}.`);
      setPublishConfirm("");
    } catch (caught) {
      setPublishError(caught instanceof Error ? caught.message : "Publish fehlgeschlagen.");
    } finally {
      setPublishBusy(false);
    }
  }, [blocking, doc.template.name, publishConfirm, publishEnvironment, publishNumericId, publishTagId, state.doc, testTagRouting.status, testTagRouting.targetType]);

  const openPublishDialog = useCallback(() => {
    setPublishError("");
    setPublishStatus("");
    setPublishResult(null);
    setPublishConfirm("");
    setPublishOpen(true);
  }, []);

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
              const picked = bundledTemplates.find((entry) => entry.id === event.target.value);
              if (picked) void loadBundledTemplate(picked.path, picked.samplePath);
            }}
          >
            <option value="">Vorlage laden…</option>
            {Array.from(new Set(bundledTemplates.map((entry) => entry.group ?? "Standard"))).map((group) => (
              <optgroup key={group} label={group}>
                {bundledTemplates
                  .filter((entry) => (entry.group ?? "Standard") === group)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        {sample ? (
          <div className="group sample-group" role="group" aria-label="Beispieldaten">
            <label className="sample-toggle">
              <input
                type="checkbox"
                checked={sampleData}
                onChange={(event) => setSampleData(event.target.checked)}
              />
              <span>Beispieldaten</span>
            </label>
            <select
              value={role}
              aria-label="Rolle in der Vorschau"
              disabled={!sampleData}
              onChange={(event) => setRole(event.target.value as Principal)}
            >
              <option value="guest">Gast</option>
              <option value="owner">Owner</option>
              <option value="scanner">Scanner</option>
            </select>
          </div>
        ) : null}

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
          {import.meta.env.DEV ? (
            <button type="button" disabled={blocking} onClick={openPublishDialog}>
              Publish…
            </button>
          ) : null}
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

      {import.meta.env.DEV && publishOpen ? (
        <div className="publish-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !publishBusy) setPublishOpen(false);
        }}>
          <section className="publish-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-title">
            <div className="publish-heading">
              <h2 id="publish-title">TAG-Content veröffentlichen</h2>
              <button type="button" className="mini secondary" aria-label="Dialog schließen" disabled={publishBusy} onClick={() => setPublishOpen(false)}>×</button>
            </div>
            <p className="publish-warning">Der Publish ersetzt den gesamten veröffentlichten TAG-Content. Prüfe Ziel und Template sorgfältig.</p>
            <label>
              Template
              <select
                aria-label="Publish-Template"
                value={publishTemplateId}
                disabled={publishBusy}
                onChange={(event) => {
                  const value = event.target.value;
                  setPublishTemplateId(value);
                  const selectedTemplate = bundledTemplates.find((entry) => entry.id === value);
                  if (selectedTemplate) {
                    void loadBundledTemplate(selectedTemplate.path, selectedTemplate.samplePath);
                    setPublishNumericId("");
                    setPublishConfirm("");
                    setPublishResult(null);
                  }
                  else if (value === doc.template.templateId) {
                    const serialized = canonicalize(state.doc);
                    const openedDocument = JSON.parse(serialized) as TagContentDocument;
                    const found = validateDocument(openedDocument);
                    setError(found.some((entry) => entry.blocking) ? "Ausgewähltes Template enthält blockierende Validierungsfehler." : null);
                    dispatch({ type: "load", doc: openedDocument, fileName: state.templateFileName, log: ["Aktuelles Template für Publish ausgewählt."] });
                    setMessage("Aktuelles Template für Publish ausgewählt.");
                  }
                }}
              >
                <option value={doc.template.templateId}>Aktuell: {doc.template.name}</option>
                {bundledTemplates.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </label>
            <label>
              Umgebung
              <select aria-label="Publish-Umgebung" value={publishEnvironment} disabled={publishBusy} onChange={(event) => {
                setPublishEnvironment(event.target.value as "local" | "staging");
                setPublishNumericId("");
                setPublishStatus("");
                setPublishError("");
                setTestTagExists(false);
                setTestTagHasData(false);
                setTestTagAdminConfirm("");
                setTestTagAdminStatus("");
                setTestTagAdminError("");
                setTestTagAdminAvailable(false);
                setTestTagRouting({ status: "active", targetType: "internal", protectionMode: "public", externalUrl: "", accessVersion: "1", contentRevision: "1", schemaVersion: "1" });
              }}>
                <option value="local">Lokal</option>
                <option value="staging">Staging</option>
              </select>
            </label>
            <label>
              Base36-TAG-ID
              <input aria-label="Base36-TAG-ID" type="text" autoComplete="off" spellCheck={false} maxLength={10} value={publishTagId} disabled={publishBusy} onChange={(event) => {
                setPublishTagId(event.target.value.toLowerCase());
                setPublishNumericId("");
                setTestTagExists(false);
                setTestTagHasData(false);
                setTestTagDeleteConfirmOpen(false);
                setTestTagAdminConfirm("");
                setPublishStatus("");
                setPublishError("");
              }} />
            </label>
            <label>
              Numeric-ID
              <span className="publish-id-row">
                <input aria-label="Numeric-ID" type="text" readOnly value={publishNumericId} placeholder="Noch nicht ermittelt" />
                <button type="button" aria-label="Numeric-ID aktualisieren" title="TAG-ID mit dem Codec auflösen" disabled={publishBusy} onClick={() => void resolvePublishTagId()}>
                  ↻
                </button>
                <button type="button" aria-label="Routing laden" title="Lokalen/Staging-Routing-Eintrag laden" disabled={publishBusy || !publishNumericId || !testTagAdminAvailable} onClick={() => void callTestTagAdmin("get")}>
                  Laden
                </button>
              </span>
            </label>
            <fieldset className="publish-admin-fields" disabled={publishBusy}>
              <legend>Test-TAG-Verwaltung · {publishEnvironment === "local" ? "Lokal" : "Staging"}</legend>
              <button type="button" disabled={publishBusy} title="Lokal nutzt den lokalen Test-Key; Staging benötigt den getrennten TAG_TEST_ADMIN_KEY_S01. Ohne Freigabe bleiben die Verwaltungsaktionen deaktiviert." onClick={() => void checkTestTagAdmin()}>Verwaltungs-API prüfen</button>
              {!testTagAdminAvailable ? <p className="publish-admin-note">API nicht freigeschaltet. Verfügbarkeit prüfen; Verwaltungsaktionen bleiben bis zur Bestätigung deaktiviert.</p> : null}
              <p className="publish-admin-note">Verwaltet nur den TAG-Routing-Eintrag in der gewählten Testumgebung. Produktion ist nicht verfügbar.</p>
              <label>Status
                <select aria-label="TAG-Status" value={testTagRouting.status} onChange={(event) => setTestTagRouting((current) => ({ ...current, status: event.target.value }))}>
                  <option value="active">active</option><option value="suspended">suspended</option><option value="deactivated">deactivated</option><option value="expired">expired</option>
                </select>
              </label>
              <label>Zieltyp
                <select aria-label="TAG-Zieltyp" value={testTagRouting.targetType} onChange={(event) => setTestTagRouting((current) => ({ ...current, targetType: event.target.value }))}>
                  <option value="internal">internal</option><option value="external">external</option>
                </select>
              </label>
              {testTagRouting.targetType === "external" ? (
                <label>External URL
                  <input aria-label="External URL" type="url" placeholder="https://example.org/" value={testTagRouting.externalUrl} onChange={(event) => setTestTagRouting((current) => ({ ...current, externalUrl: event.target.value }))} />
                </label>
              ) : null}
              <label>Protection Mode
                <select aria-label="Protection Mode" value={testTagRouting.protectionMode} onChange={(event) => setTestTagRouting((current) => ({ ...current, protectionMode: event.target.value }))}>
                  <option value="public">public</option><option value="pin_required">pin_required</option><option value="login_required">login_required</option><option value="closed">closed</option>
                </select>
              </label>
              <div className="publish-version-grid">
                <label>Access Version<input aria-label="Access Version" type="number" min="1" step="1" value={testTagRouting.accessVersion} onChange={(event) => setTestTagRouting((current) => ({ ...current, accessVersion: event.target.value }))} /></label>
                <label>Content Revision<input aria-label="Content Revision" type="number" min="1" step="1" value={testTagRouting.contentRevision} onChange={(event) => setTestTagRouting((current) => ({ ...current, contentRevision: event.target.value }))} /></label>
                <label>Schema Version<input aria-label="Schema Version" type="number" min="1" step="1" value={testTagRouting.schemaVersion} onChange={(event) => setTestTagRouting((current) => ({ ...current, schemaVersion: event.target.value }))} /></label>
              </div>
              <p className="publish-admin-note">Updated At wird beim Speichern automatisch auf die Serverzeit gesetzt. Content Revision muss zum veröffentlichten Content passen, sonst ist der Runtime-Bootstrap nicht konsistent.</p>
              <div className="publish-actions">
                <button type="button" title={testTagAdminAvailable ? "TAG-Routing in der gewählten Testumgebung anlegen oder ändern" : "API noch nicht freigeschaltet – Verwaltungs-API prüfen"} disabled={!publishNumericId || blocking || !testTagAdminAvailable} onClick={() => void callTestTagAdmin("save")}>{testTagExists ? "Routing ändern" : "TAG anlegen / Routing speichern"}</button>
                <button type="button" className="danger-button" disabled={!publishNumericId || !testTagHasData || !testTagAdminAvailable} title={!testTagAdminAvailable ? "API noch nicht freigeschaltet – Verwaltungs-API prüfen" : "Löscht Routing, TAG-Content, TAG-Items und TAG-eigene R2-Objekte. Globale Daten bleiben erhalten."} onClick={() => { setTestTagAdminConfirm(""); setTestTagDeleteConfirmOpen(true); }}>Löschbestätigung vorbereiten</button>
              </div>
              {testTagDeleteConfirmOpen ? (
                <label className="publish-delete-confirm">Destruktiv: TAG, D1-Daten und TAG-eigene R2-Dateien in {publishEnvironment.toUpperCase()} werden gelöscht. Gib exakt <code>DELETE {publishEnvironment.toUpperCase()} {publishTagId.trim().toLowerCase()}</code> ein.
                  <input aria-label="TAG-Löschbestätigung" value={testTagAdminConfirm} onChange={(event) => setTestTagAdminConfirm(event.target.value)} />
                  <button type="button" className="danger-button" disabled={!publishNumericId || !testTagAdminAvailable || testTagAdminConfirm !== `DELETE ${publishEnvironment.toUpperCase()} ${publishTagId.trim().toLowerCase()}`} onClick={() => void callTestTagAdmin("delete")}>TAG vollständig löschen</button>
                </label>
              ) : null}
            </fieldset>
            {testTagAdminStatus ? <p className="publish-success" role="status">{testTagAdminStatus}</p> : null}
            {testTagAdminError ? <p className="errorbar publish-error" role="alert">{testTagAdminError}</p> : null}
            {testTagAdminResult ? <pre className="publish-result" aria-label="Test-TAG-Verwaltungsergebnis">{JSON.stringify(testTagAdminResult, null, 2)}</pre> : null}
            <div className="publish-preview" aria-label="Publish-Zusammenfassung">
              <strong>Ziel:</strong> {publishEnvironment === "local" ? "Lokal" : "Staging"} · TAG {publishTagId || "—"}
              <br />
              <strong>Template:</strong> {doc.template.name} ({doc.template.templateId} · v{doc.template.templateVersion})
              <br />
              <strong>Schema:</strong> {doc.schema} · {doc.elements.length} Elemente
            </div>
            <label>
              Bestätigung (exakt <code>PUBLISH {publishTagId || "TAG-ID"}</code>)
              <input aria-label="Publish-Bestätigung" type="text" autoComplete="off" value={publishConfirm} disabled={publishBusy} onChange={(event) => setPublishConfirm(event.target.value)} />
            </label>
            {publishStatus ? <p className="publish-success" role="status">{publishStatus}</p> : null}
            {publishError ? <p className="errorbar publish-error" role="alert">{publishError}</p> : null}
            {publishResult ? <pre className="publish-result" aria-label="Publish-Ergebnis">{JSON.stringify(publishResult, null, 2)}</pre> : null}
            <div className="publish-actions">
              <button type="button" disabled={publishBusy} onClick={() => setPublishOpen(false)}>Schließen</button>
              <button type="button" className="primary" disabled={publishBusy || blocking || !publishNumericId || publishConfirm !== `PUBLISH ${publishTagId.trim().toLowerCase()}`} onClick={() => void publishTagContent()}>
                {publishBusy ? "Bitte warten…" : "Jetzt vollständig ersetzen"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
              sample={sampleData ? sample : null}
              principal={role}
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

