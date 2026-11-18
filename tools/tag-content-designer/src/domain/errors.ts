export type Severity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  severity: Severity;
  path: string;
  message: string;
  hint?: string;
  blocking: boolean;
}

export function issue(
  severity: Severity,
  code: string,
  path: string,
  message: string,
  hint?: string,
  blocking = severity === "error",
): ValidationIssue {
  return { code, severity, path, message, hint, blocking };
}

export const error = (code: string, path: string, message: string, hint?: string) =>
  issue("error", code, path, message, hint, true);

export const warning = (code: string, path: string, message: string, hint?: string) =>
  issue("warning", code, path, message, hint, false);

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((entry) => entry.blocking);
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues
    .map((entry) => `${entry.severity.toUpperCase()} ${entry.code} ${entry.path}: ${entry.message}`)
    .join("\n");
}

export class DocumentError extends Error {
  readonly code: string;
  readonly path: string | undefined;
  readonly hint: string | undefined;

  constructor(code: string, message: string, path?: string, hint?: string) {
    super(message);
    this.name = "DocumentError";
    this.code = code;
    this.path = path;
    this.hint = hint;
  }
}
