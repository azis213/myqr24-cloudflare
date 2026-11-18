# Third-Party-Hinweise – TAG-Content-Designer

Das Tool wird vollständig gebündelt und läuft offline (keine CDN-, Font- oder Telemetrie-Aufrufe).

## Laufzeit-Abhängigkeiten

| Paket | Version | Lizenz | Zweck |
| --- | --- | --- | --- |
| `react`, `react-dom` | 19.x | MIT | UI |
| `@tiptap/react` | 3.34.0 | MIT | React-Anbindung des Editors |
| `@tiptap/core` | 3.34.0 | MIT | Editor-Kern |
| `@tiptap/pm` | 3.34.0 | MIT | ProseMirror-Module (model, view, state, transform, commands, keymap, history, schema-list) |
| `@tiptap/extension-bold` | 3.34.0 | MIT | Mark `bold` |
| `@tiptap/extension-italic` | 3.34.0 | MIT | Mark `italic` |
| `@tiptap/extension-underline` | 3.34.0 | MIT | Mark `underline` |
| `@tiptap/extension-link` | 3.34.0 | MIT | Mark `link` (Allowlist, `rel`) |
| `@tiptap/extension-hard-break` | 3.34.0 | MIT | Weicher Zeilenumbruch (`Shift+Enter`) |
| `markdown-it` | 14.1.0 | MIT | Markdown → Tokens für Paste/Dialog (`html: false`); Export ist eigene Serialisierung |
| `@tiptap/extension-bullet-list` | 3.34.0 | MIT | Aufzählung |
| `@tiptap/extension-ordered-list` | 3.34.0 | MIT | Nummerierung |
| `@tiptap/extension-list-item` | 3.34.0 | MIT | Listeneinträge, Ein-/Ausrücken |
| `@tiptap/extension-document` | 3.34.0 | MIT | Wurzelknoten |
| `@tiptap/extension-paragraph` | 3.34.0 | MIT | Absatz (erweitert um `align`, `lineHeight`, `indent`) |
| `@tiptap/extension-text` | 3.34.0 | MIT | Textknoten |

Versionen sind **exakt gepinnt** (`--save-exact`), damit Builds reproduzierbar bleiben. `@tiptap/pm` bündelt ProseMirror (MIT, Marijn Haverbeke u. a.).

## Bewusst nicht verwendet

| Paket | Grund |
| --- | --- |
| `prosemirror-tables`, Drop-/Gapcursor | Nicht benötigt; wird nicht in den Build gezogen (im Bundle geprüft) |
| CKEditor 5 | GPL/commercial, HTML-Serialisierung |
| TinyMCE / Quill | HTML-/Delta-Serialisierung, nicht mit dem Token-Modell vereinbar |

## Dev-Abhängigkeiten

`vite`, `vitest`, `jsdom`, `@testing-library/react`, `typescript`, `@vitejs/plugin-react` (alle MIT bzw. Apache-2.0). Hinweis: `npm audit` meldet für die Vitest-Kette (`tinypool`) bekannte Advisories; sie betreffen ausschließlich die Testumgebung, nicht das ausgelieferte Tool.
