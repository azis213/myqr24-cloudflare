import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architektur-Test: Das Tool darf niemals HTML aus Nutzereingaben rendern.
 * Text geht ausschließlich über React-Textknoten bzw. `textContent`.
 */
const ROOT = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test") continue;
      files.push(...sourceFiles(path));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(path);
  }
  return files;
}

const FORBIDDEN = [
  { pattern: /dangerouslySetInnerHTML/, label: "dangerouslySetInnerHTML" },
  { pattern: /\.innerHTML\s*=/, label: ".innerHTML =" },
  { pattern: /\.outerHTML\s*=/, label: ".outerHTML =" },
  { pattern: /\.getHTML\s*\(/, label: "editor.getHTML()" },
  { pattern: /new Function\s*\(/, label: "new Function()" },
  { pattern: /\bdocument\.write\s*\(/, label: "document.write()" },
];

describe("Sicherheitsarchitektur", () => {
  const files = sourceFiles(ROOT);

  it("findet die Quelldateien", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("rendert nirgends HTML aus Strings", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(content)) violations.push(`${file}: ${rule.label}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("speichert kein HTML im Artefakt (nur Tokens)", () => {
    const mapping = readFileSync(join(ROOT, "rich", "mapping.ts"), "utf8");
    expect(mapping).not.toMatch(/innerHTML|outerHTML|getHTML/);
  });
});
