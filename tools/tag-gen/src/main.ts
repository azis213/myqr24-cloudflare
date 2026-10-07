import QRCode from "qrcode";
import "./styles.css";
import {
  countRange,
  createConfigExport,
  createLabelTemplateExport,
  defaultQrProfile,
  defaultTemplate,
  formatInteger,
  lowerBound,
  makeId,
  maximumOffset,
  now,
  paginateTags,
  resolveRangeValues,
  parseConfigExport,
  parseLabelTemplateExport,
  type GeneratedTag,
  type LabelTemplate,
  type PositionedElement,
  type RangeInputMode,
  type TagGeneratorConfiguration,
  type TagRangeDefinition,
  validateBaseUrl,
  validateQrProfile,
  validateRange,
  validateTemplate,
} from "./domain";
import {
  createTagListJson,
  generateTags,
  parseTagListJson,
} from "./tag-generation";
import { createTagPdf } from "./pdf-generation";

declare const __TAG_GEN_DEFAULT_SECRETS__: {
  feistelSecret: string;
  hmacSecret: string;
};

type View = "ranges" | "tags" | "templates" | "print" | "transfer";

const STORAGE_KEY = "myqr24.tag-generator.configuration.v1";
const app = document.querySelector<HTMLDivElement>("#app")!;

const initialTemplate = defaultTemplate();
let configuration: TagGeneratorConfiguration = {
  schemaVersion: 1,
  kind: "myqr24.tag-generator.config",
  name: "Meine TAG-Konfiguration",
  updatedAt: now(),
  baseUrl: "https://s.myqr24.com/t/",
  inputLocale: "de-DE",
  qrIdCase: "upper",
  defaultQrProfile: defaultQrProfile(),
  ranges: [],
  labelTemplates: [initialTemplate],
  selectedTemplateId: initialTemplate.id,
  printSettings: { templateId: initialTemplate.id, startRow: 1, startColumn: 1 },
};
let generatedTags: GeneratedTag[] = [];
let activeView: View = "ranges";
let notice = "Bereit. Geheimnisse werden nie gespeichert oder exportiert.";
let rangeErrors: string[] = [];
let generationProgress = "";
let secrets = { ...__TAG_GEN_DEFAULT_SECRETS__ };
let showFeistelSecret = false;
let showHmacSecret = false;
let selectedTagIndex = 0;
let draftRange = createRangeDraft();
let rangeInputMode: RangeInputMode = "absolute";
let rangeVersionSourceName: string | undefined;
let dragState:
  | { element: "qr" | "text" | "tagIdText"; startX: number; startY: number; originX: number; originY: number }
  | undefined;

function createRangeDraft(): Omit<TagRangeDefinition, "createdAt" | "updatedAt"> {
  return {
    id: makeId(),
    name: "",
    start: "",
    end: "",
    tagLength: 6,
    labelText: "",
    qrProfile: structuredClone(configuration.defaultQrProfile),
  };
}

function selectedTemplate(): LabelTemplate {
  return (
    configuration.labelTemplates.find((item) => item.id === configuration.selectedTemplateId) ??
    configuration.labelTemplates[0]
  );
}

function escapeHtml(value: string): string {
  const entity = (code: number): string => String.fromCharCode(code);
  return value
    .replaceAll(entity(38), `${entity(38)}amp;`)
    .replaceAll(entity(60), `${entity(38)}lt;`)
    .replaceAll(entity(62), `${entity(38)}gt;`)
    .replaceAll(entity(34), `${entity(38)}quot;`)
    .replaceAll(entity(39), `${entity(38)}#039;`);
}

function saveLocal(): void {
  configuration.updatedAt = now();
  localStorage.setItem(STORAGE_KEY, createConfigExport(configuration));
  notice = "Konfiguration lokal gespeichert – ohne Geheimnisse und TAG-Liste.";
  render();
}

function loadLocal(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    notice = "Keine lokal gespeicherte Konfiguration gefunden.";
    render();
    return;
  }

  const result = parseConfigExport(stored);
  if (!result.ok) {
    notice = `Lokale Konfiguration ist ungültig: ${result.errors.join(" ")}`;
    render();
    return;
  }

  configuration = result.value;
  if (!configuration.labelTemplates.length) {
    const template = defaultTemplate();
    configuration.labelTemplates = [template];
    configuration.selectedTemplateId = template.id;
  }
  notice = "Lokale Konfiguration geladen. Geheimnisse müssen erneut eingegeben werden.";
  render();
}

function download(name: string, content: string | Blob): void {
  const blob = typeof content === "string"
    ? new Blob([content], { type: "application/json;charset=utf-8" })
    : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readFile(input: HTMLInputElement): Promise<string | undefined> {
  const file = input.files?.[0];
  if (!file) return undefined;
  return file.text();
}

async function qrSvg(url: string, profile = configuration.defaultQrProfile): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    ...(profile.version === "auto" ? {} : { version: profile.version }),
    errorCorrectionLevel: profile.errorCorrectionLevel,
    margin: profile.quietZoneModules,
    color: { dark: "#101828", light: "#ffffff" },
  });
}

function navButton(view: View, label: string, icon: string): string {
  return `<button class="nav-item ${activeView === view ? "is-active" : ""}" data-view="${view}"><span>${icon}</span>${label}</button>`;
}

function renderShell(content: string): void {
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">T</span><div><strong>myQR24</strong><small>TAG-Generator</small></div></div>
      <nav>
        ${navButton("ranges", "Bereiche & Generierung", "01")}
        ${navButton("tags", "Generierte TAGs", "02")}
        ${navButton("templates", "Etikettenvorlagen", "03")}
        ${navButton("print", "Druckvorschau & PDF", "04")}
        ${navButton("transfer", "Import & Export", "05")}
      </nav>
      <div class="privacy-note"><strong>Lokales Tool</strong><br>Secrets verbleiben nur im Arbeitsspeicher.</div>
    </aside>
    <main>
      <header class="topbar">
        <div><p class="eyebrow">OFFLINE-WERKZEUG</p><h1>${activeViewTitle()}</h1></div>
        <div class="top-actions"><button class="secondary" id="load-local">Lokal laden</button><button class="primary" id="save-local">Konfiguration speichern</button></div>
      </header>
      <div class="notice" role="status">${escapeHtml(notice)}</div>
      ${content}
    </main>
  `;
  bindShell();
}

function activeViewTitle(): string {
  return {
    ranges: "Bereiche & TAG-Generierung",
    tags: "Generierte TAGs",
    templates: "Etikettenvorlagen",
    print: "Druckvorschau & PDF",
    transfer: "Import & Export",
  }[activeView];
}

function bindShell(): void {
  app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view as View;
      notice = "Bereit.";
      render();
    });
  });
  app.querySelector("#save-local")?.addEventListener("click", saveLocal);
  app.querySelector("#load-local")?.addEventListener("click", loadLocal);
}

function rangeSpaceDescription(length: 6 | 8): string {
  const lower = lowerBound(length);
  const maxOffset = maximumOffset(length);
  const highestValue = length === 8 ? lower + maxOffset * 16n : lower + maxOffset;

  return `Untergrenze: ${formatInteger(lower)} · höchste ${length === 8 ? "Basis" : ""}zahl: ${formatInteger(highestValue)} · Zahlenraum: ${formatInteger(maxOffset + 1n)} ${length === 8 ? "Slots" : "Werte"}`;
}

function renderRanges(): void {
  const url = validateBaseUrl(configuration.baseUrl);
  const offsetPreview = rangeInputMode === "offset"
    ? resolveRangeValues(draftRange.tagLength, rangeInputMode, draftRange.start, draftRange.end)
    : undefined;
  const startLabel = rangeInputMode === "offset" ? "Von-Offset" : "Von";
  const endLabel = rangeInputMode === "offset" ? "Bis-Offset" : "Bis";
  const rows = configuration.ranges
    .map((range) => `<tr>
      <td><strong>${escapeHtml(range.name)}</strong><small>${escapeHtml(range.labelText || "Kein Etikettentext")}</small></td>
      <td><span class="pill">${range.tagLength} Zeichen</span></td>
      <td>${formatInteger(range.start)}</td><td>${formatInteger(range.end)}</td>
      <td>${formatInteger(countRange(range))}</td>
      <td><button class="secondary" data-continue-range="${range.id}">Fortführen</button> <button class="text-button" data-delete-range="${range.id}">Löschen</button></td>
    </tr>`)
    .join("");

  renderShell(`
    <section class="grid two-columns">
      <article class="card">
        <div class="card-heading"><div><p class="eyebrow">GLOBALE QR-NUTZLAST</p><h2>Basis-URL & Format</h2></div><span class="status ${url.ok ? "success" : "error"}">${url.ok ? "gültig" : "prüfen"}</span></div>
        <label>HTTPS-Präfix für alle TAGs<input id="base-url" value="${escapeHtml(configuration.baseUrl)}" spellcheck="false"></label>
        <div class="compact-form top-form">
          <label>Eingabeformat für Maße<select id="input-locale"><option value="de-DE" ${configuration.inputLocale === "de-DE" ? "selected" : ""}>DE – Komma (z. B. 63,5)</option><option value="en-US" ${configuration.inputLocale === "en-US" ? "selected" : ""}>EN – Punkt (z. B. 63.5)</option></select></label>
          <label>QR-ID-Zeichenmodus<select id="qr-id-case"><option value="upper" ${configuration.qrIdCase === "upper" ? "selected" : ""}>Base36/Base45 – GROSS</option><option value="lower" ${configuration.qrIdCase === "lower" ? "selected" : ""}>Binär-Codec – klein</option></select></label>
          <label>Standard-QR-Version<select id="default-qr-version"><option value="auto" ${configuration.defaultQrProfile.version === "auto" ? "selected" : ""}>Automatisch</option>${Array.from({ length: 40 }, (_, index) => `<option value="${index + 1}" ${configuration.defaultQrProfile.version === index + 1 ? "selected" : ""}>Version ${index + 1}</option>`).join("")}</select></label>
          <label>Standard-Fehlertoleranz<select id="default-qr-ecc">${["L", "M", "Q", "H"].map((level) => `<option value="${level}" ${configuration.defaultQrProfile.errorCorrectionLevel === level ? "selected" : ""}>${level}</option>`).join("")}</select></label>
          <label>Standard Quiet Zone (Module)<input id="default-qr-margin" type="number" min="0" max="20" step="1" value="${configuration.defaultQrProfile.quietZoneModules}"></label>
        </div>
        <p class="hint">Im Base36/Base45-Modus wird die vollständige QR-Nutzlast einschließlich Basis-URL groß geschrieben. Das QR-Standardprofil wird beim Anlegen neuer Bereiche übernommen.</p>
      </article>
      <article class="card secret-card">
        <div class="card-heading"><div><p class="eyebrow">NUR LAUFZEIT</p><h2>Codec-Geheimnisse</h2></div><span class="status neutral">nicht gespeichert</span></div>
        <label>FEISTEL Secret<div class="secret-input"><input id="feistel-secret" type="${showFeistelSecret ? "text" : "password"}" autocomplete="off" value="${escapeHtml(secrets.feistelSecret)}"><button type="button" class="icon-button" id="toggle-feistel-secret" aria-label="FEISTEL Secret ${showFeistelSecret ? "ausblenden" : "anzeigen"}" title="Secret ${showFeistelSecret ? "ausblenden" : "anzeigen"}">${showFeistelSecret ? "◉" : "◌"}</button></div></label>
        <label>HMAC Secret <small>(für 8-stellige TAGs)</small><div class="secret-input"><input id="hmac-secret" type="${showHmacSecret ? "text" : "password"}" autocomplete="off" value="${escapeHtml(secrets.hmacSecret)}"><button type="button" class="icon-button" id="toggle-hmac-secret" aria-label="HMAC Secret ${showHmacSecret ? "ausblenden" : "anzeigen"}" title="Secret ${showHmacSecret ? "ausblenden" : "anzeigen"}">${showHmacSecret ? "◉" : "◌"}</button></div></label>
        <p class="hint">Aus <code>tools/.env.local</code> lokal vorbelegt; weder gespeichert noch exportiert.</p>
      </article>
    </section>

    <section class="card">
      <div class="card-heading"><div><p class="eyebrow">TAG-BEREICHE</p><h2>Neue Range definieren</h2></div><button class="secondary" id="clear-range">Eingabe leeren</button></div>
      ${rangeErrors.length ? `<div class="form-errors">${rangeErrors.map((item) => `<div>${escapeHtml(item)}</div>`).join("")}</div>` : ""}
      <div class="range-form">
        <label>Name<input id="range-name" value="${escapeHtml(draftRange.name)}" placeholder="z. B. Veranstaltung Nord"></label>
        <label>TAG-Länge<select id="range-length"><option value="6" ${draftRange.tagLength === 6 ? "selected" : ""}>6 Zeichen</option><option value="8" ${draftRange.tagLength === 8 ? "selected" : ""}>8 Zeichen</option></select></label>
        <label>Eingabeart<select id="range-input-mode"><option value="absolute" ${rangeInputMode === "absolute" ? "selected" : ""}>Absolute Werte</option><option value="offset" ${rangeInputMode === "offset" ? "selected" : ""}>Offsets ab Untergrenze</option></select></label>
        <div class="wide range-space"><strong>${rangeSpaceDescription(draftRange.tagLength)}</strong><small>${draftRange.tagLength === 8 ? "Ein Offset entspricht einem 16-ausgerichteten Basiswert." : "Offsets werden direkt zur Untergrenze addiert."}</small></div>
        <label>${startLabel}<input id="range-start" inputmode="numeric" value="${escapeHtml(draftRange.start)}" placeholder="${rangeInputMode === "offset" ? "z. B. 0" : "z. B. 60.466.176"}"></label>
        <label>${endLabel}<input id="range-end" inputmode="numeric" value="${escapeHtml(draftRange.end)}" placeholder="${rangeInputMode === "offset" ? "z. B. 24" : "z. B. 60.466.200"}"></label>
        <label>QR-Version<select id="range-qr-version"><option value="auto" ${draftRange.qrProfile.version === "auto" ? "selected" : ""}>Automatisch</option>${Array.from({ length: 40 }, (_, index) => `<option value="${index + 1}" ${draftRange.qrProfile.version === index + 1 ? "selected" : ""}>Version ${index + 1}</option>`).join("")}</select></label>
        <label>Fehlertoleranz<select id="range-qr-ecc">${["L", "M", "Q", "H"].map((level) => `<option value="${level}" ${draftRange.qrProfile.errorCorrectionLevel === level ? "selected" : ""}>${level}</option>`).join("")}</select></label>
        <label>Quiet Zone (Module)<input id="range-qr-margin" type="number" min="0" max="20" step="1" value="${draftRange.qrProfile.quietZoneModules}"></label>
        ${offsetPreview?.ok ? `<div class="wide resolved-range">Berechnete absolute Werte: <strong>${formatInteger(offsetPreview.value.start)}</strong> bis <strong>${formatInteger(offsetPreview.value.end)}</strong></div>` : ""}
        <label class="wide">Etikettentext<textarea id="range-text" rows="2" placeholder="Text, der auf jedem Etikett dieses Bereichs erscheint">${escapeHtml(draftRange.labelText)}</textarea></label>
      </div>
      <div class="toolbar"><button class="primary" id="add-range">${rangeVersionSourceName ? "Neue Bereichsversion hinzufügen" : "Bereich hinzufügen"}</button><span class="hint">${rangeVersionSourceName ? `Fortführung von „${escapeHtml(rangeVersionSourceName)}“: Die bestehende Range bleibt unverändert.` : rangeInputMode === "offset" ? "Gespeichert und exportiert werden immer die berechneten absoluten Werte." : "8-stellige Bereiche benötigen bei Von und Bis durch 16 teilbare Basiswerte."}</span></div>
    </section>

    <section class="card">
      <div class="card-heading"><div><p class="eyebrow">DEFINIERTE RANGES</p><h2>${configuration.ranges.length} Bereich(e)</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Name / Text</th><th>Länge</th><th>Von</th><th>Bis</th><th>Anzahl</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty">Noch keine Bereiche definiert.</td></tr>`}</tbody></table></div>
      <div class="generation-bar"><div><strong>${formatInteger(configuration.ranges.reduce((total, range) => total + countRange(range), 0n))}</strong><small> TAGs im aktuellen Umfang</small></div><div>${generationProgress ? `<span class="progress">${escapeHtml(generationProgress)}</span>` : ""}<button class="primary" id="generate-tags" ${configuration.ranges.length ? "" : "disabled"}>TAGs generieren</button></div></div>
    </section>
  `);

  const inputValue = (id: string): string => app.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "";
  const refreshDraft = () => {
    draftRange = {
      ...draftRange,
      name: inputValue("range-name"),
      start: inputValue("range-start"),
      end: inputValue("range-end"),
      tagLength: Number(inputValue("range-length")) as 6 | 8,
      labelText: app.querySelector<HTMLTextAreaElement>("#range-text")?.value ?? "",
      qrProfile: {
        version: inputValue("range-qr-version") === "auto" ? "auto" as const : Number(inputValue("range-qr-version")),
        errorCorrectionLevel: inputValue("range-qr-ecc") as "L" | "M" | "Q" | "H",
        quietZoneModules: Number(inputValue("range-qr-margin")),
      },
    };
  };

  app.querySelector("#base-url")?.addEventListener("change", (event) => {
    configuration.baseUrl = (event.target as HTMLInputElement).value;
    renderRanges();
  });
  app.querySelector("#input-locale")?.addEventListener("change", (event) => {
    configuration.inputLocale = (event.target as HTMLSelectElement).value === "en-US" ? "en-US" : "de-DE";
    notice = `Eingabeformat ${configuration.inputLocale === "de-DE" ? "DE" : "EN"} ausgewählt.`;
    renderRanges();
  });
  app.querySelector("#qr-id-case")?.addEventListener("change", (event) => {
    configuration.qrIdCase = (event.target as HTMLSelectElement).value === "lower" ? "lower" : "upper";
    notice = configuration.qrIdCase === "upper" ? "Vollständige QR-Nutzlast wird groß geschrieben." : "Vollständige QR-Nutzlast wird klein geschrieben.";
    renderRanges();
  });
  ["default-qr-version", "default-qr-ecc", "default-qr-margin"].forEach((id) => app.querySelector(`#${id}`)?.addEventListener("change", () => {
    const profile = {
      version: inputValue("default-qr-version") === "auto" ? "auto" as const : Number(inputValue("default-qr-version")),
      errorCorrectionLevel: inputValue("default-qr-ecc") as "L" | "M" | "Q" | "H",
      quietZoneModules: Number(inputValue("default-qr-margin")),
    };
    const result = validateQrProfile(profile);
    if (!result.ok) { rangeErrors = result.errors; renderRanges(); return; }
    configuration.defaultQrProfile = result.value;
    notice = "Standard-QR-Profil aktualisiert; bestehende Bereiche bleiben unverändert.";
    renderRanges();
  }));
  app.querySelector("#feistel-secret")?.addEventListener("input", (event) => { secrets.feistelSecret = (event.target as HTMLInputElement).value; });
  app.querySelector("#hmac-secret")?.addEventListener("input", (event) => { secrets.hmacSecret = (event.target as HTMLInputElement).value; });
  app.querySelector("#toggle-feistel-secret")?.addEventListener("click", () => { showFeistelSecret = !showFeistelSecret; renderRanges(); });
  app.querySelector("#toggle-hmac-secret")?.addEventListener("click", () => { showHmacSecret = !showHmacSecret; renderRanges(); });
  ["range-name", "range-start", "range-end", "range-text"].forEach((id) => app.querySelector(`#${id}`)?.addEventListener("input", refreshDraft));
  app.querySelector("#range-length")?.addEventListener("change", () => {
    refreshDraft();
    renderRanges();
  });
  app.querySelector("#range-input-mode")?.addEventListener("change", (event) => {
    refreshDraft();
    rangeInputMode = (event.target as HTMLSelectElement).value as RangeInputMode;
    renderRanges();
  });
  app.querySelector("#clear-range")?.addEventListener("click", () => {
    draftRange = createRangeDraft();
    rangeInputMode = "absolute";
    rangeErrors = [];
    renderRanges();
  });
  app.querySelector("#add-range")?.addEventListener("click", () => {
    refreshDraft();
    const resolved = resolveRangeValues(draftRange.tagLength, rangeInputMode, draftRange.start, draftRange.end);
    if (!resolved.ok) { rangeErrors = resolved.errors; renderRanges(); return; }
    const result = validateRange({ ...draftRange, ...resolved.value }, configuration.ranges, Boolean(rangeVersionSourceName));
    if (!result.ok) { rangeErrors = result.errors; renderRanges(); return; }
    configuration.ranges.push(result.value);
    draftRange = createRangeDraft();
    rangeInputMode = "absolute";
    rangeVersionSourceName = undefined;
    rangeErrors = [];
    notice = "Bereich hinzugefügt.";
    renderRanges();
  });
  app.querySelectorAll<HTMLButtonElement>("[data-continue-range]").forEach((button) => button.addEventListener("click", () => {
    const source = configuration.ranges.find((range) => range.id === button.dataset.continueRange);
    if (!source) return;
    const baseName = source.name.replace(/ – Version \d+$/, "");
    const versions = configuration.ranges
      .map((range) => {
        const match = range.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} – Version (\\d+)$`));
        return match ? Number(match[1]) : range.name === baseName ? 1 : 0;
      });
    const nextVersion = Math.max(...versions, 1) + 1;
    draftRange = {
      id: makeId(),
      name: `${baseName} – Version ${nextVersion}`,
      start: source.start,
      end: source.end,
      tagLength: source.tagLength,
      labelText: source.labelText,
      qrProfile: structuredClone(source.qrProfile),
    };
    rangeInputMode = "absolute";
    rangeVersionSourceName = source.name;
    rangeErrors = [];
    notice = `Bereich „${source.name}“ zum Fortführen geladen.`;
    renderRanges();
  }));
  app.querySelectorAll<HTMLButtonElement>("[data-delete-range]").forEach((button) => button.addEventListener("click", () => {
    configuration.ranges = configuration.ranges.filter((range) => range.id !== button.dataset.deleteRange);
    notice = "Bereich gelöscht.";
    renderRanges();
  }));
  app.querySelector("#generate-tags")?.addEventListener("click", async () => {
    try {
      generationProgress = "Generierung wird vorbereitet …";
      renderRanges();
      generatedTags = await generateTags(configuration.ranges, configuration.baseUrl, secrets, {
        qrIdCase: configuration.qrIdCase,
        onProgress: ({ completed, total }) => { generationProgress = `${completed.toLocaleString("de-DE")} / ${total.toLocaleString("de-DE")} TAGs`; },
      });
      selectedTagIndex = 0;
      generationProgress = "";
      activeView = "tags";
      notice = `${generatedTags.length.toLocaleString("de-DE")} TAGs wurden erfolgreich erzeugt.`;
      render();
    } catch (error) {
      generationProgress = "";
      notice = error instanceof Error ? error.message : "Die TAG-Generierung ist fehlgeschlagen.";
      renderRanges();
    }
  });
}

async function renderTags(): Promise<void> {
  const preview = generatedTags[selectedTagIndex] ?? generatedTags[0];
  const svg = preview ? await qrSvg(preview.url, preview.qrProfile) : "";
  const rows = generatedTags.slice(0, 100).map((tag, index) => `<tr class="selectable-row ${tag === preview ? "is-selected" : ""}" data-tag-index="${index}"><td>${escapeHtml(tag.rangeName)}</td><td><code>${tag.tagId}</code></td><td class="url">${escapeHtml(tag.url)}</td><td>${escapeHtml(tag.labelText || "—")}</td></tr>`).join("");
  renderShell(`
    <section class="grid tags-summary">
      <article class="card metric"><p class="eyebrow">AKTUELLE LISTE</p><strong>${generatedTags.length.toLocaleString("de-DE")}</strong><span>generierte / importierte TAGs</span></article>
      <article class="card metric"><p class="eyebrow">BEREICHE</p><strong>${new Set(generatedTags.map((tag) => tag.rangeId)).size}</strong><span>in der aktiven Liste</span></article>
      <article class="card action-card"><p class="eyebrow">DATENEXPORT</p><button class="primary" id="export-tags" ${generatedTags.length ? "" : "disabled"}>TAG-Liste als JSON exportieren</button></article>
    </section>
    <section class="grid preview-grid">
      <article class="card"><div class="card-heading"><div><p class="eyebrow">QR-EINZELVORSCHAU</p><h2>${preview ? preview.tagId : "Keine TAGs"}</h2></div></div>${preview ? `<div class="qr-preview">${svg}</div><p class="url">${escapeHtml(preview.url)}</p><p>${escapeHtml(preview.labelText || "Kein Etikettentext")}</p>` : `<p class="empty">Generieren oder importieren Sie zunächst eine TAG-Liste.</p>`}</article>
      <article class="card"><p class="eyebrow">KOMPATIBILITÄT</p><h2>Codec identisch zum Edge Router</h2><p>Die öffentlichen IDs werden direkt mit <code>encodeTagId()</code> aus der Edge-Router-Implementierung erzeugt. Große Zahlen bleiben als BigInt präzise.</p></article>
    </section>
    <section class="card"><div class="card-heading"><div><p class="eyebrow">ERGEBNISSE</p><h2>TAG-Liste ${generatedTags.length > 100 ? "(erste 100)" : ""}</h2></div></div><div class="table-wrap"><table><thead><tr><th>Bereich</th><th>TAG-ID</th><th>Ziel-URL</th><th>Etikettentext</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty">Keine TAG-Liste vorhanden.</td></tr>`}</tbody></table></div></section>
  `);
  app.querySelector("#export-tags")?.addEventListener("click", () => {
    download(`myqr24-tag-list-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`, createTagListJson(configuration.baseUrl, configuration.qrIdCase, configuration.ranges, generatedTags));
    notice = "TAG-Liste exportiert. Geheimnisse sind nicht enthalten.";
  });
  app.querySelectorAll<HTMLTableRowElement>("[data-tag-index]").forEach((row) => row.addEventListener("click", () => {
    selectedTagIndex = Number(row.dataset.tagIndex);
    void renderTags();
  }));
}

function numberControl(id: string, value: number, options: { min: number; step: number; position?: string }): string {
  const dataPosition = options.position ? ` data-position="${options.position}"` : "";
  return `<input id="${id}"${dataPosition} type="number" min="${options.min}" step="${options.step}" value="${value}">`;
}

function parseLayoutNumber(input: string): number {
  return Number(input);
}

function renderTemplates(): void {
  const template = selectedTemplate();
  const layoutState = validateTemplate(template);
  const grid = template.grid;
  const labelScale = 5;
  const labelStyle = `width:${grid.labelWidthMm * labelScale}px;height:${grid.labelHeightMm * labelScale}px;`;
  renderShell(`
    <section class="grid template-layout">
      <article class="card"><div class="card-heading"><div><p class="eyebrow">VORLAGENEIGENSCHAFTEN</p><h2>DIN A4 Raster</h2></div><span class="status ${layoutState.ok ? "success" : "error"}">${layoutState.ok ? "druckbar" : "prüfen"}</span></div>
      <div class="compact-form">
        <label>Name<input id="template-name" value="${escapeHtml(template.name)}"></label>
        <label>Spalten${numberControl("grid-columns", grid.columns, { min: 1, step: 1 })}</label><label>Zeilen${numberControl("grid-rows", grid.rows, { min: 1, step: 1 })}</label>
        <label>Etikettbreite mm${numberControl("label-width", grid.labelWidthMm, { min: 1, step: 0.1 })}</label><label>Etiketthöhe mm${numberControl("label-height", grid.labelHeightMm, { min: 1, step: 0.1 })}</label>
        <label>Linker Rand mm${numberControl("left-margin", grid.leftMarginMm, { min: 0, step: 0.1 })}</label><label>Oberer Rand mm${numberControl("top-margin", grid.topMarginMm, { min: 0, step: 0.1 })}</label>
        <label>Horizontaler Abstand mm${numberControl("h-gap", grid.horizontalGapMm, { min: 0, step: 0.1 })}</label><label>Vertikaler Abstand mm${numberControl("v-gap", grid.verticalGapMm, { min: 0, step: 0.1 })}</label>
      </div>
      <h3>Seitenkopf (einmal je A4-Seite)</h3>
      <div class="compact-form">
        <label>Text<input id="header-text" value="${escapeHtml(template.pageLayout.header.text)}"></label>
        <label>Abstand oben mm${numberControl("header-top", template.pageLayout.header.topOffsetMm, { min: 0, step: 0.1 })}</label>
        <label>Links mm${numberControl("header-left", template.pageLayout.header.leftMm, { min: 0, step: 0.1 })}</label>
        <label>Breite mm${numberControl("header-width", template.pageLayout.header.widthMm, { min: 0, step: 0.1 })}</label>
        <label>Höhe mm${numberControl("header-height", template.pageLayout.header.heightMm, { min: 0, step: 0.1 })}</label>
      </div>
      <h3>Seitenfuß (einmal je A4-Seite)</h3>
      <div class="compact-form">
        <label>Text<input id="footer-text" value="${escapeHtml(template.pageLayout.footer.text)}"></label>
        <label>Abstand unten mm${numberControl("footer-bottom", template.pageLayout.footer.bottomOffsetMm, { min: 0, step: 0.1 })}</label>
        <label>Links mm${numberControl("footer-left", template.pageLayout.footer.leftMm, { min: 0, step: 0.1 })}</label>
        <label>Breite mm${numberControl("footer-width", template.pageLayout.footer.widthMm, { min: 0, step: 0.1 })}</label>
        <label>Höhe mm${numberControl("footer-height", template.pageLayout.footer.heightMm, { min: 0, step: 0.1 })}</label>
      </div>
      ${!layoutState.ok ? `<div class="form-errors">${layoutState.errors.map((message) => `<div>${escapeHtml(message)}</div>`).join("")}</div>` : ""}
      <div class="toolbar"><button class="primary" id="save-template">Vorlage übernehmen</button><button class="secondary" id="duplicate-template">Duplizieren</button><button class="secondary" id="export-template">Vorlage als Datei speichern</button><label class="file-button">Vorlage aus Datei laden<input id="import-template" type="file" accept="application/json"></label></div></article>
      <article class="card"><div class="card-heading"><div><p class="eyebrow">A4-VORSCHAU</p><h2>${grid.columns} × ${grid.rows} Etiketten</h2></div></div><div class="a4-mini" style="--columns:${grid.columns};--rows:${grid.rows};--left:${grid.leftMarginMm / 2.1}%;--top:${grid.topMarginMm / 2.97}%;--width:${grid.labelWidthMm / 2.1}%;--height:${grid.labelHeightMm / 2.97}%;--gapx:${grid.horizontalGapMm / 2.1}%;--gapy:${grid.verticalGapMm / 2.97}%;"></div></article>
    </section>
    <section class="card"><div class="card-heading"><div><p class="eyebrow">EINZELETIKETT</p><h2>QR-Code und Text positionieren</h2></div><span class="hint">Ziehen Sie die Bereiche im Etikett. Präzise Werte stehen rechts.</span></div>
      <div class="label-editor">
        <div class="label-stage" id="label-stage" style="${labelStyle}">
          <div class="editable-element qr-element" data-element="qr" style="left:${template.elements.qr.xMm * labelScale}px;top:${template.elements.qr.yMm * labelScale}px;width:${template.elements.qr.widthMm * labelScale}px;height:${template.elements.qr.heightMm * labelScale}px;">QR</div>
          <div class="editable-element text-element" data-element="text" style="left:${template.elements.text.xMm * labelScale}px;top:${template.elements.text.yMm * labelScale}px;width:${template.elements.text.widthMm * labelScale}px;height:${template.elements.text.heightMm * labelScale}px;">${escapeHtml(generatedTags[0]?.labelText || "Etikettentext")}</div>
          <div class="editable-element tag-id-element" data-element="tagIdText" style="left:${template.elements.tagIdText.xMm * labelScale}px;top:${template.elements.tagIdText.yMm * labelScale}px;width:${template.elements.tagIdText.widthMm * labelScale}px;height:${template.elements.tagIdText.heightMm * labelScale}px;">${escapeHtml(generatedTags[0]?.tagId || "TAG-ID")}</div>
        </div>
        <div class="element-fields">
          <h3>QR-Code</h3>${elementFields("qr", template.elements.qr)}
          <h3>Freies Textfeld</h3>${elementFields("text", template.elements.text)}
          <h3>Lesbare TAG-ID</h3>${elementFields("tagIdText", template.elements.tagIdText)}
          <p class="hint">Größe und Position werden in Millimetern gespeichert. QR-Code bleibt quadratisch.</p>
        </div>
      </div>
    </section>
  `);

  const numeric = (id: string): number => parseLayoutNumber(app.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "0");
  app.querySelector("#save-template")?.addEventListener("click", () => {
    template.name = app.querySelector<HTMLInputElement>("#template-name")?.value ?? template.name;
    Object.assign(template.grid, {
      columns: numeric("grid-columns"), rows: numeric("grid-rows"), labelWidthMm: numeric("label-width"), labelHeightMm: numeric("label-height"),
      leftMarginMm: numeric("left-margin"), topMarginMm: numeric("top-margin"), horizontalGapMm: numeric("h-gap"), verticalGapMm: numeric("v-gap"),
    });
    Object.assign(template.pageLayout.header, {
      text: app.querySelector<HTMLInputElement>("#header-text")?.value ?? "",
      topOffsetMm: numeric("header-top"),
      leftMm: numeric("header-left"),
      widthMm: numeric("header-width"),
      heightMm: numeric("header-height"),
    });
    Object.assign(template.pageLayout.footer, {
      text: app.querySelector<HTMLInputElement>("#footer-text")?.value ?? "",
      bottomOffsetMm: numeric("footer-bottom"),
      leftMm: numeric("footer-left"),
      widthMm: numeric("footer-width"),
      heightMm: numeric("footer-height"),
    });
    template.updatedAt = now();
    const result = validateTemplate(template);
    notice = result.ok ? "Etikettenvorlage aktualisiert." : result.errors.join(" ");
    renderTemplates();
  });
  app.querySelector("#duplicate-template")?.addEventListener("click", () => {
    const copy = structuredClone(template);
    copy.id = makeId(); copy.name = `${copy.name} – Kopie`; copy.createdAt = now(); copy.updatedAt = now();
    configuration.labelTemplates.push(copy); configuration.selectedTemplateId = copy.id; notice = "Vorlage dupliziert."; renderTemplates();
  });
  app.querySelector("#export-template")?.addEventListener("click", () => {
    download(`myqr24-label-template-${template.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "template"}.json`, createLabelTemplateExport(template));
    notice = "Etikettenvorlage als JSON-Datei exportiert.";
  });
  app.querySelector<HTMLInputElement>("#import-template")?.addEventListener("change", async (event) => {
    const text = await readFile(event.target as HTMLInputElement);
    if (!text) return;
    const parsed = parseLabelTemplateExport(text);
    if (!parsed.ok) { notice = parsed.errors.join(" "); renderTemplates(); return; }
    configuration.labelTemplates.push(parsed.value);
    configuration.selectedTemplateId = parsed.value.id;
    notice = `Etikettenvorlage „${parsed.value.name}“ importiert.`;
    renderTemplates();
  });
  bindElementFields(template);
  bindDrag(template, labelScale);
}

function elementFields(kind: "qr" | "text" | "tagIdText", element: { xMm: number; yMm: number; widthMm: number; heightMm: number }): string {
  return `<div class="compact-form element-form">
    <label>X mm${numberControl(`position-${kind}-x`, element.xMm, { min: 0, step: 0.1, position: `${kind}:xMm` })}</label>
    <label>Y mm${numberControl(`position-${kind}-y`, element.yMm, { min: 0, step: 0.1, position: `${kind}:yMm` })}</label>
    <label>Breite mm${numberControl(`position-${kind}-width`, element.widthMm, { min: 1, step: 0.1, position: `${kind}:widthMm` })}</label>
    <label>Höhe mm${numberControl(`position-${kind}-height`, element.heightMm, { min: 1, step: 0.1, position: `${kind}:heightMm` })}</label>
  </div>`;
}

function bindElementFields(template: LabelTemplate): void {
  app.querySelectorAll<HTMLInputElement>("[data-position]").forEach((input) => input.addEventListener("change", () => {
    const [kind, property] = input.dataset.position!.split(":") as [
      "qr" | "text" | "tagIdText",
      keyof PositionedElement,
    ];
    const element: PositionedElement =
      kind === "qr" ? template.elements.qr : kind === "text" ? template.elements.text : template.elements.tagIdText;
    element[property] = parseLayoutNumber(input.value);
    if (kind === "qr" && (property === "widthMm" || property === "heightMm")) {
      template.elements.qr.widthMm = parseLayoutNumber(input.value);
      template.elements.qr.heightMm = parseLayoutNumber(input.value);
    }
    template.updatedAt = now();
    renderTemplates();
  }));
}

function bindDrag(template: LabelTemplate, scale: number): void {
  const stage = app.querySelector<HTMLElement>("#label-stage");
  if (!stage) return;

  app.querySelectorAll<HTMLElement>("[data-element]").forEach((element) => element.addEventListener("pointerdown", (event) => {
    const kind = element.dataset.element as "qr" | "text" | "tagIdText";
    const target = template.elements[kind];
    dragState = { element: kind, startX: event.clientX, startY: event.clientY, originX: target.xMm, originY: target.yMm };
    element.setPointerCapture(event.pointerId);
  }));
  stage.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    const target = template.elements[dragState.element];
    const maxX = template.grid.labelWidthMm - target.widthMm;
    const maxY = template.grid.labelHeightMm - target.heightMm;
    target.xMm = Math.max(0, Math.min(maxX, Math.round((dragState.originX + (event.clientX - dragState.startX) / scale) * 10) / 10));
    target.yMm = Math.max(0, Math.min(maxY, Math.round((dragState.originY + (event.clientY - dragState.startY) / scale) * 10) / 10));
    renderTemplates();
  });
  stage.addEventListener("pointerup", () => { dragState = undefined; });
}

async function renderPrint(): Promise<void> {
  const template = selectedTemplate();
  const startRow = configuration.printSettings?.startRow ?? 1;
  const startColumn = configuration.printSettings?.startColumn ?? 1;
  const pages = paginateTags(generatedTags, template, startRow, startColumn);
  const pagePreviews = await Promise.all(pages.map((page) => renderPagePreview(page, template)));
  renderShell(`
    <section class="card print-controls"><div><p class="eyebrow">DRUCKAUFTRAG</p><h2>Startposition & PDF</h2><p>Der Download erzeugt ein echtes DIN-A4-PDF mit festen Millimeterkoordinaten. Nicht verwendete Etiketten vor der Startposition bleiben auf Seite 1 frei.</p></div>
      <div class="compact-form"><label>Startzeile<input id="start-row" type="number" min="1" max="${template.grid.rows}" value="${startRow}"></label><label>Startspalte<input id="start-column" type="number" min="1" max="${template.grid.columns}" value="${startColumn}"></label></div>
      <div class="pdf-actions"><button class="primary" id="download-pdf" ${generatedTags.length ? "" : "disabled"}>Maßhaltiges DIN-A4-PDF herunterladen</button><small id="pdf-progress" class="hint"></small></div></section>
    <section class="card"><div class="card-heading"><div><p class="eyebrow">SEITENVORSCHAU</p><h2>${pages.length} A4-Seite(n)</h2></div><span class="status neutral">${generatedTags.length} TAGs</span></div>
      <div id="print-pages" class="print-pages">${pagePreviews.join("")}</div></section>
  `);
  app.querySelector("#start-row")?.addEventListener("change", (event) => { configuration.printSettings = { templateId: template.id, startRow: Number((event.target as HTMLInputElement).value), startColumn }; renderPrint(); });
  app.querySelector("#start-column")?.addEventListener("change", (event) => { configuration.printSettings = { templateId: template.id, startRow, startColumn: Number((event.target as HTMLInputElement).value) }; renderPrint(); });
  app.querySelector("#download-pdf")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const progress = app.querySelector<HTMLElement>("#pdf-progress");
    try {
      button.disabled = true;
      if (progress) progress.textContent = "PDF wird erzeugt …";
      const pdf = await createTagPdf(generatedTags, template, startRow, startColumn, {
        onProgress: ({ completed, total }) => {
          if (progress) progress.textContent = `${completed.toLocaleString("de-DE")} / ${total.toLocaleString("de-DE")} TAGs werden in das PDF geschrieben …`;
        },
      });
      download(`myqr24-tags-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.pdf`, pdf);
      notice = `Maßhaltiges DIN-A4-PDF mit ${pages.length} Seite(n) heruntergeladen.`;
      if (progress) progress.textContent = "Download gestartet.";
    } catch (error) {
      notice = error instanceof Error ? error.message : "Das PDF konnte nicht erzeugt werden.";
      if (progress) progress.textContent = "PDF-Erzeugung fehlgeschlagen.";
    } finally {
      button.disabled = false;
    }
  });
}

async function renderPagePreview(cells: ReturnType<typeof paginateTags>[number], template: LabelTemplate): Promise<string> {
  const gridStyle = `grid-template-columns:repeat(${template.grid.columns},1fr);grid-template-rows:repeat(${template.grid.rows},1fr);padding:${template.grid.topMarginMm / 2.97}% ${Math.max(1, template.grid.leftMarginMm / 2.1)}%;gap:${template.grid.verticalGapMm / 2.97}% ${template.grid.horizontalGapMm / 2.1}%;`;
  const positionStyle = (element: PositionedElement): string =>
    `left:${element.xMm}mm;top:${element.yMm}mm;width:${element.widthMm}mm;height:${element.heightMm}mm;`;
  const header = template.pageLayout.header;
  const footer = template.pageLayout.footer;
  const footerTopMm = 297 - footer.bottomOffsetMm - footer.heightMm;
  const pageTextStyle = (leftMm: number, topMm: number, widthMm: number, heightMm: number): string =>
    `left:${leftMm}mm;top:${topMm}mm;width:${widthMm}mm;height:${heightMm}mm;`;

  const cellsHtml = await Promise.all(cells.map(async (cell) => {
    if (!cell.tag) return `<div class="print-label"></div>`;
    const svg = await qrSvg(cell.tag.url, cell.tag.qrProfile);
    return `<div class="print-label"><div class="mini-qr positioned-print-element" style="${positionStyle(template.elements.qr)}">${svg}</div><div class="mini-text positioned-print-element" style="${positionStyle(template.elements.text)}">${escapeHtml(cell.tag.labelText)}</div><div class="mini-tag-id positioned-print-element" style="${positionStyle(template.elements.tagIdText)}">${escapeHtml(cell.tag.tagId)}</div></div>`;
  }));

  return `<div class="print-page-with-chrome"><div class="page-text page-header" style="${pageTextStyle(header.leftMm, header.topOffsetMm, header.widthMm, header.heightMm)}">${escapeHtml(header.text)}</div><div class="print-page" style="${gridStyle}">${cellsHtml.join("")}</div><div class="page-text page-footer" style="${pageTextStyle(footer.leftMm, footerTopMm, footer.widthMm, footer.heightMm)}">${escapeHtml(footer.text)}</div></div>`;
}

function renderTransfer(): void {
  renderShell(`
    <section class="grid two-columns">
      <article class="card"><p class="eyebrow">KONFIGURATION</p><h2>Exportieren & importieren</h2><p>Bereiche, Basis-URL, Vorlagen und Druckeinstellungen. Geheimnisse und TAG-Listen sind nicht enthalten.</p><div class="toolbar"><button class="primary" id="export-config">Konfiguration exportieren</button><label class="file-button">Konfiguration importieren<input id="import-config" type="file" accept="application/json"></label></div></article>
      <article class="card"><p class="eyebrow">TAG-LISTE</p><h2>Liste importieren</h2><p>Importierte TAG-Listen werden nicht kryptografisch verifiziert, bis Secrets erneut eingegeben wurden.</p><label class="file-button">TAG-Liste importieren<input id="import-tags" type="file" accept="application/json"></label></article>
    </section>
    <section class="card"><p class="eyebrow">DATENSCHUTZ</p><h2>Was wird gespeichert?</h2><ul><li>Lokal speicherbar: Basis-URL, Bereiche, Etikettenvorlagen, Druckstartposition.</li><li>Nur Laufzeit: Feistel- und HMAC-Secret.</li><li>Explizit exportierbar: Konfigurationen und TAG-Listen ohne Geheimnisse.</li></ul></section>
  `);
  app.querySelector("#export-config")?.addEventListener("click", () => download(`myqr24-tag-config-${new Date().toISOString().slice(0, 10)}.json`, createConfigExport(configuration)));
  app.querySelector<HTMLInputElement>("#import-config")?.addEventListener("change", async (event) => {
    const text = await readFile(event.target as HTMLInputElement);
    if (!text) return;
    const parsed = parseConfigExport(text);
    if (!parsed.ok) { notice = parsed.errors.join(" "); renderTransfer(); return; }
    configuration = parsed.value;
    notice = "Konfiguration importiert. Geheimnisse wurden nicht übernommen.";
    renderTransfer();
  });
  app.querySelector<HTMLInputElement>("#import-tags")?.addEventListener("change", async (event) => {
    try {
      const text = await readFile(event.target as HTMLInputElement);
      if (!text) return;
      const parsed = parseTagListJson(text);
      generatedTags = parsed.tags;
      selectedTagIndex = 0;
      configuration.baseUrl = parsed.source.baseUrl;
      configuration.qrIdCase = parsed.source.qrIdCase;
      notice = `${generatedTags.length} TAGs importiert; kryptografische Verifikation steht aus.`;
      activeView = "tags";
      render();
    } catch (error) {
      notice = error instanceof Error ? error.message : "Die TAG-Liste konnte nicht importiert werden.";
      renderTransfer();
    }
  });
}

function render(): void {
  if (activeView === "ranges") renderRanges();
  else if (activeView === "templates") renderTemplates();
  else if (activeView === "transfer") renderTransfer();
  else if (activeView === "tags") void renderTags();
  else void renderPrint();
}

render();
