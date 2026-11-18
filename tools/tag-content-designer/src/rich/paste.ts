/**
 * Paste-Sanitizer: entfernt aktive Bestandteile, bevor ProseMirror das HTML liest.
 * Der Sanitizer ersetzt nicht das Schema – unbekannte Tags werden ohnehin zu Text.
 */
const ACTIVE_ELEMENTS = /<\s*(script|style|iframe|object|embed|link|meta|form|input|button|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const ACTIVE_SELF_CLOSING = /<\s*(script|style|iframe|object|embed|link|meta|form|input|button|svg|math)\b[^>]*\/?>/gi;
const EVENT_HANDLER = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const UNSAFE_URL_ATTRIBUTE = /\b(href|src|xlink:href)\s*=\s*("|')\s*(javascript|data|vbscript)\s*:[^"']*("|')/gi;
const CSS_EXPRESSION = /expression\s*\(|url\s*\(\s*("|')?\s*(javascript|data)\s*:/gi;

export function sanitizePastedHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(ACTIVE_ELEMENTS, " ")
    .replace(ACTIVE_SELF_CLOSING, " ")
    .replace(EVENT_HANDLER, "")
    .replace(UNSAFE_URL_ATTRIBUTE, "")
    .replace(CSS_EXPRESSION, "");
}
