import { createRoot } from "react-dom/client";
import { createDocument } from "./domain/catalog";
import { exampleTemplateRefs, parseExampleIndex } from "./domain/examples";
import { emptyLibrary } from "./domain/library";
import type { ElementLibrary, TagContentDocument } from "./domain/types";
import { describeSession, loadSession } from "./state/session";
import { App } from "./ui/App";
import "./styles.css";

type TemplateRef = {
  id: string;
  label: string;
  path: string;
  group?: string;
  description?: string;
  samplePath?: string;
};

/** Mitgelieferte Standardvorlagen – immer verfügbar, auch ohne Beispiel-Manifest. */
const STANDARD_TEMPLATES: TemplateRef[] = [
  {
    id: "vault-standard",
    label: "Vault – Standard",
    path: "/templates/vault-standard.tagcontent.json",
    group: "Standard",
  },
  {
    id: "lost-found-standard",
    label: "Lost & Found – Standard",
    path: "/templates/lost-found-standard.tagcontent.json",
    group: "Standard",
  },
];

/**
 * Beispiele aus `public/templates/examples/index.json`. Fehlt oder bricht das
 * Manifest, bleibt das Tool mit den Standardvorlagen voll benutzbar.
 */
async function loadExampleTemplates(): Promise<TemplateRef[]> {
  try {
    const response = await fetch("/templates/examples/index.json");
    if (!response.ok) return [];
    const parsed = parseExampleIndex(await response.json());
    if (!parsed.index) {
      console.warn("Beispiel-Manifest ignoriert:", parsed.issues.map((issue) => `${issue.code} ${issue.path}`).join(", "));
      return [];
    }
    return exampleTemplateRefs(parsed.index);
  } catch {
    return [];
  }
}

async function boot(): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("Root-Element fehlt.");
  const root = createRoot(container);
  const examples = await loadExampleTemplates();
  const bundledTemplates = [...STANDARD_TEMPLATES, ...examples];

  try {
    const [documentResponse, libraryResponse] = await Promise.all([
      fetch("/templates/vault-standard.tagcontent.json"),
      fetch("/elements/default.tagelements.json"),
    ]);
    if (!documentResponse.ok || !libraryResponse.ok) throw new Error("Default-Dateien konnten nicht geladen werden.");
    const bundled = (await documentResponse.json()) as TagContentDocument;
    const initialLibrary = (await libraryResponse.json()) as ElementLibrary;
    // „Letzte Konfiguration" hat Vorrang vor der ausgelieferten Vorlage.
    const session = loadSession();
    root.render(
      <App
        initialDoc={session?.doc ?? bundled}
        initialLibrary={initialLibrary}
        bundledTemplates={bundledTemplates}
        initialSource={session ? describeSession(session.savedAt) : null}
      />,
    );
  } catch {
    const session = loadSession();
    const fallback = session?.doc ?? createDocument({ templateId: "tct_fallback_vault", tagType: "vault", name: "Fallback-Template" });
    root.render(
      <App
        initialDoc={fallback}
        initialLibrary={emptyLibrary()}
        bundledTemplates={bundledTemplates}
        initialSource={session ? describeSession(session.savedAt) : null}
      />,
    );
  }
}

void boot();
