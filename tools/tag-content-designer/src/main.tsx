import { createRoot } from "react-dom/client";
import { createDocument } from "./domain/catalog";
import { emptyLibrary } from "./domain/library";
import type { ElementLibrary, TagContentDocument } from "./domain/types";
import { App } from "./ui/App";
import "./styles.css";

const bundledTemplates = [
  { id: "vault-standard", label: "Vault – Standard", path: "/templates/vault-standard.tagcontent.json" },
  {
    id: "lost-found-standard",
    label: "Lost & Found – Standard",
    path: "/templates/lost-found-standard.tagcontent.json",
  },
];

async function boot(): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("Root-Element fehlt.");
  const root = createRoot(container);

  try {
    const [documentResponse, libraryResponse] = await Promise.all([
      fetch("/templates/vault-standard.tagcontent.json"),
      fetch("/elements/default.tagelements.json"),
    ]);
    if (!documentResponse.ok || !libraryResponse.ok) throw new Error("Default-Dateien konnten nicht geladen werden.");
    const initialDoc = (await documentResponse.json()) as TagContentDocument;
    const initialLibrary = (await libraryResponse.json()) as ElementLibrary;
    root.render(<App initialDoc={initialDoc} initialLibrary={initialLibrary} bundledTemplates={bundledTemplates} />);
  } catch {
    const fallback = createDocument({ templateId: "tct_fallback_vault", tagType: "vault", name: "Fallback-Template" });
    root.render(
      <App initialDoc={fallback} initialLibrary={emptyLibrary()} bundledTemplates={bundledTemplates} />,
    );
  }
}

void boot();
