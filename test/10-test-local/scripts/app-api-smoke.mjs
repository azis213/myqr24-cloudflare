const baseUrl = (process.env.APP_API_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const secret = process.env.APP_BOOTSTRAP_SECRET_S01;
if (!secret) {
  console.error("APP_BOOTSTRAP_SECRET_S01 is required");
  process.exit(1);
}

const tagId = "ab12cd";
const accessVersion = 1;
const revision = 8;
const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 30;
const payload = [
  "myqr24/pwa-bootstrap/v1",
  `tag=${tagId}`,
  "mode=public",
  `accessVersion=${accessVersion}`,
  `revision=${revision}`,
  `nonce=${nonce}`,
  `exp=${exp}`,
].join("\n");
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const signature = Buffer.from(
  await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
).toString("base64url");

const access = await fetch(`${baseUrl}/api/v1/tags/${tagId}/access/public`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: "public", accessVersion, revision, nonce, exp, sig: signature }),
});
if (access.status !== 200) {
  const detail = await access.text();
  throw new Error(`public access failed with HTTP ${access.status}: ${detail}`);
}
const setCookie = access.headers.get("set-cookie");
if (!setCookie) throw new Error("public access did not set a session cookie");
const cookie = setCookie.split(";", 1)[0];

const content = await fetch(`${baseUrl}/api/v1/tags/${tagId}/content`, {
  headers: { cookie },
});
if (content.status !== 200) {
  throw new Error(`content failed with HTTP ${content.status}`);
}
const body = await content.json();
if (body.tagId !== tagId || body.revision !== revision) {
  throw new Error("content response does not match the seeded TAG revision");
}
const element = body.elements?.find((entry) => entry.id === "cel_gallery");
const item = element?.items?.find((entry) => entry.contentId === "1850000000000000");
if (!element || !item) {
  throw new Error("seeded gallery or item is missing from the content response");
}

const media = await fetch(`${baseUrl}/api/get-image-url`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ tagId, contentId: "1850000000000000", variant: "cover" }),
});
if (media.status !== 404) {
  throw new Error(`local media signer should stay fail-closed, got HTTP ${media.status}`);
}

console.log("App API smoke OK: public session, D1/R2 content and fail-closed media signer.");
