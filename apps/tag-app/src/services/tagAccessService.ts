import type { PublicTagView } from "../features/vault/types";

export type BootstrapMode = "public" | "pin_required" | "login_required" | "closed";

export interface TagBootstrap {
  mode: BootstrapMode;
  accessVersion: number;
  revision: number;
  nonce: string;
  expiresAt: number;
  signature: string;
}

export class TagAccessError extends Error {
  constructor(message = "Die TAG-Berechtigung konnte nicht bestätigt werden.") {
    super(message);
    this.name = "TagAccessError";
  }
}

const TAG_ID = /^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/;

function queryBootstrap(search: string): TagBootstrap | null {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const accessVersion = Number(params.get("av"));
  const revision = Number(params.get("rv"));
  const nonce = params.get("nonce");
  const expiresAt = Number(params.get("exp"));
  const signature = params.get("sig");
  if (!(["public", "pin_required", "login_required", "closed"] as string[]).includes(mode ?? "") || !Number.isSafeInteger(accessVersion) || accessVersion < 1 || !Number.isSafeInteger(revision) || revision < 1 || !nonce || !signature || !Number.isSafeInteger(expiresAt)) return null;
  return { mode: mode as BootstrapMode, accessVersion, revision, nonce, expiresAt, signature };
}

export function bootstrapFromLocation(tagId: string, search = window.location.search): TagBootstrap | null {
  return TAG_ID.test(tagId) ? queryBootstrap(search) : null;
}

function requestBody(bootstrap: TagBootstrap) {
  return { mode: bootstrap.mode, accessVersion: bootstrap.accessVersion, revision: bootstrap.revision, nonce: bootstrap.nonce, exp: bootstrap.expiresAt, sig: bootstrap.signature };
}

async function fetchJson(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(path, { credentials: "include", headers: { "content-type": "application/json", ...(init.headers ?? {}) }, ...init });
  if (!response.ok) throw new TagAccessError();
  return response.json();
}

export async function authorizePublic(tagId: string, bootstrap: TagBootstrap): Promise<void> {
  await fetchJson(`/api/v1/tags/${encodeURIComponent(tagId)}/access/public`, { method: "POST", body: JSON.stringify(requestBody(bootstrap)) });
}

export async function verifyPin(tagId: string, pin: string, bootstrap: TagBootstrap): Promise<void> {
  await fetchJson("/api/verify-pin", { method: "POST", body: JSON.stringify({ tagId, pin, ...requestBody(bootstrap) }) });
}

export async function loadAuthorizedView(tagId: string): Promise<PublicTagView> {
  const value = await fetchJson(`/api/v1/tags/${encodeURIComponent(tagId)}/content`, { method: "GET" });
  if (!value || typeof value !== "object" || !("view" in value)) throw new TagAccessError("Der TAG-Inhaltsvertrag ist ungültig.");
  return (value as { view: PublicTagView }).view;
}

export async function getMediaUrl(tagId: string, contentId: string, variant: string): Promise<{ url: string; expiresAt: number; contentType: string }> {
  const value = await fetchJson("/api/get-image-url", { method: "POST", body: JSON.stringify({ tagId, contentId, variant }) });
  if (!value || typeof value !== "object" || !("url" in value) || typeof (value as { url: unknown }).url !== "string") throw new TagAccessError("Die Medienadresse konnte nicht erstellt werden.");
  return value as { url: string; expiresAt: number; contentType: string };
}

export function clearBootstrapParameters(): void {
  const url = new URL(window.location.href);
  for (const parameter of ["mode", "av", "rv", "nonce", "exp", "sig"]) url.searchParams.delete(parameter);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}