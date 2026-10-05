import { createServer } from "node:http";
import { randomInt, webcrypto } from "node:crypto";
import { networkInterfaces } from "node:os";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import QRCode from "qrcode";

const ROOT = resolve(import.meta.dirname, "../..");
const PORT = Number.parseInt(process.env.PORT ?? "8788", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const SECRET_FILE = join(ROOT, ".env.staging.local");
const STORE_FILE = join(ROOT, ".tag-lab", "staging-tags.json");
const PUBLIC_DIR = join(import.meta.dirname, "public");

const CONTENT_TEST_FIXTURES = [
  { id: "trauung1", label: "Lea & Jonas – Hochzeit", description: "Galerie, Dokumente und lokale Gast-Demo" },
  { id: "fest2026", label: "Hochzeitsfeier – nur ansehen", description: "Galerie ohne Gastuploads" },
  { id: "menue202", label: "Hochzeit – Dokumente", description: "Einladung und Speisekarte" },
  { id: "rsq45q", label: "Staging-Testtag", description: "Öffentliche Basisansicht" },
  { id: "koffer24", label: "Reisekoffer", description: "Lost-&-Found-Kontext" },
  { id: "album042", label: "Sommer am See", description: "Öffentliche Galerie" },
  { id: "gipfel99", label: "Sonnspitze", description: "POI- und Sicherheitshinweise" },
];

const TAG_LENGTHS = new Set([6, 8]);
const FEISTEL_ROUNDS = 10;
const MAX_CYCLE_WALK_ITERATIONS = 128;
const encoder = new TextEncoder();

const parametersByLength = {
  6: { blockBits: 32, halfBits: 16, domain: "myqr24/tag/6" },
  8: { blockBits: 42, halfBits: 21, domain: "myqr24/tag/8" },
};

function parseEnvironmentFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .flatMap((line) => {
        const separator = line.indexOf("=");

        return separator > 0
          ? [[line.slice(0, separator), line.slice(separator + 1)]]
          : [];
      }),
  );
}

const localEnvironment = parseEnvironmentFile(SECRET_FILE);
const feistelSecret = localEnvironment.FEISTEL_SECRET;
const tagHmacSecret = localEnvironment.TAG_HMAC_SECRET;

if (!feistelSecret) {
  throw new Error(
    "FEISTEL_SECRET is missing. Add it to the local, Git-ignored .env.staging.local file.",
  );
}

function lowerBound(length) {
  return 36n ** BigInt(length - 1);
}

function upperBound(length) {
  return 36n ** BigInt(length);
}

function isCanonicalValue(value, length) {
  return value >= lowerBound(length) && value < upperBound(length);
}

function toFixedWidthBytes(value, byteLength) {
  const bytes = new Uint8Array(byteLength);
  let remaining = value;

  for (let index = byteLength - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return bytes;
}

async function sha256(data) {
  return new Uint8Array(await webcrypto.subtle.digest("SHA-256", data));
}

async function feistelRound(secret, parameters, round, rightHalf) {
  const prefix = encoder.encode(`${secret}|${parameters.domain}|${round}|`);
  const material = new Uint8Array(prefix.length + 3);
  material.set(prefix);
  material.set(toFixedWidthBytes(rightHalf, 3), prefix.length);

  const digest = await sha256(material);
  const mask = (1n << BigInt(parameters.halfBits)) - 1n;
  const firstThreeBytes =
    (BigInt(digest[0]) << 16n) |
    (BigInt(digest[1]) << 8n) |
    BigInt(digest[2]);

  return firstThreeBytes & mask;
}

async function encodeFeistelBlock(decodedValue, parameters, secret) {
  const halfMask = (1n << BigInt(parameters.halfBits)) - 1n;
  let left = decodedValue >> BigInt(parameters.halfBits);
  let right = decodedValue & halfMask;

  for (let round = 0; round < FEISTEL_ROUNDS; round += 1) {
    const nextLeft = right;
    const nextRight =
      (left ^ (await feistelRound(secret, parameters, round, right))) &
      halfMask;

    left = nextLeft;
    right = nextRight;
  }

  return (left << BigInt(parameters.halfBits)) | right;
}

async function encodeFeistel(decodedValue, length, secret) {
  if (!isCanonicalValue(decodedValue, length) || !secret) {
    return null;
  }

  const parameters = parametersByLength[length];
  let value = decodedValue;

  for (let attempt = 0; attempt < MAX_CYCLE_WALK_ITERATIONS; attempt += 1) {
    value = await encodeFeistelBlock(value, parameters, secret);

    if (isCanonicalValue(value, length)) {
      return value;
    }
  }

  return null;
}

async function calculateHmacNibble(base, secret) {
  if (!secret || base < 0n || base >= 1n << 42n || base % 16n !== 0n) {
    return null;
  }

  const key = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const message = encoder.encode(`myqr24/tag/v1/8:${base.toString()}`);
  const signature = new Uint8Array(
    await webcrypto.subtle.sign("HMAC", key, message),
  );

  return signature[0] & 0x0f;
}

function randomBigIntBelow(limit) {
  const byteLength = Math.ceil(limit.toString(2).length / 8);
  const highestByteMask = (1 << ((limit.toString(2).length - 1) % 8 + 1)) - 1;

  while (true) {
    const bytes = new Uint8Array(byteLength);
    webcrypto.getRandomValues(bytes);
    bytes[0] &= highestByteMask;

    let value = 0n;

    for (const byte of bytes) {
      value = (value << 8n) | BigInt(byte);
    }

    if (value < limit) {
      return value;
    }
  }
}

function randomCanonicalValue(length) {
  const lower = lowerBound(length);
  return lower + randomBigIntBelow(upperBound(length) - lower);
}

function readStore() {
  if (!existsSync(STORE_FILE)) {
    return { version: 1, tags: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8"));

    if (
      parsed?.version === 1 &&
      Array.isArray(parsed.tags) &&
      parsed.tags.every(
        (tag) =>
          typeof tag?.id === "string" &&
          (tag.length === 6 || tag.length === 8) &&
          typeof tag.url === "string",
      )
    ) {
      return parsed;
    }
  } catch {
    // Replace only malformed local tool data; no platform data is affected.
  }

  return { version: 1, tags: [] };
}

function writeStore(store) {
  mkdirSync(dirname(STORE_FILE), { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function scanUrl(tagId) {
  return `https://s.qx4.uk/${tagId}`;
}

function detectWlanAddress() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter(
      (address) =>
        address &&
        address.family === "IPv4" &&
        !address.internal &&
        /^192\.168\./.test(address.address),
    );

  return addresses[0]?.address ?? "127.0.0.1";
}

function contentTestBaseUrl() {
  return (
    process.env.TAG_APP_BASE_URL?.replace(/\/+$/, "") ??
    `http://${detectWlanAddress()}:5173`
  );
}

function contentTestTags() {
  const baseUrl = contentTestBaseUrl();

  return CONTENT_TEST_FIXTURES.map((fixture) => ({
    ...fixture,
    url: `${baseUrl}/tag/${fixture.id}`,
  }));
}

function addConfiguredTags(store) {
  const configuredIds = (localEnvironment.TEST_TAGS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => /^(?:[0-9a-z]{6}|[0-9a-z]{8})$/.test(id));

  for (const id of configuredIds) {
    if (!store.tags.some((tag) => tag.id === id)) {
      store.tags.push({
        id,
        length: id.length,
        url: scanUrl(id),
        source: "configured",
        platformState: "configured",
        createdAt: new Date().toISOString(),
      });
    }
  }
}

function publicTag(tag) {
  return {
    id: tag.id,
    length: tag.length,
    url: tag.url,
    source: tag.source,
    platformState: tag.platformState,
    createdAt: tag.createdAt,
  };
}

async function createTag(length) {
  const store = readStore();
  addConfiguredTags(store);

  if (!TAG_LENGTHS.has(length)) {
    throw new Error("Only 6- and 8-character tags are supported.");
  }

  if (length === 8 && !tagHmacSecret) {
    throw new Error(
      "TAG_HMAC_SECRET is missing locally. Add it to .env.staging.local before generating 8-character tags.",
    );
  }

  for (let attempt = 0; attempt < 128; attempt += 1) {
    let decodedValue = randomCanonicalValue(length);

    if (length === 8) {
      const base = decodedValue & ~0x0fn;
      const nibble = await calculateHmacNibble(base, tagHmacSecret);
      decodedValue = base | BigInt(nibble);
    }

    const encodedValue = await encodeFeistel(
      decodedValue,
      length,
      feistelSecret,
    );

    if (encodedValue === null) {
      continue;
    }

    const id = encodedValue.toString(36);

    if (id.length !== length || store.tags.some((tag) => tag.id === id)) {
      continue;
    }

    const tag = {
      id,
      length,
      url: scanUrl(id),
      source: "generated",
      platformState: "not-configured",
      createdAt: new Date().toISOString(),
    };

    store.tags.unshift(tag);
    writeStore(store);
    return publicTag(tag);
  }

  throw new Error("Unable to generate a unique canonical tag after 128 attempts.");
}

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": contentType,
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), "application/json; charset=utf-8");
}

async function requestBody(request) {
  const parts = [];

  for await (const part of request) {
    parts.push(part);
  }

  const value = Buffer.concat(parts).toString("utf8");
  return value ? JSON.parse(value) : {};
}

async function handler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/tags") {
    const store = readStore();
    addConfiguredTags(store);
    writeStore(store);
    return sendJson(response, 200, {
      tags: store.tags.map(publicTag),
      capabilities: { generate6: true, generate8: Boolean(tagHmacSecret) },
    });
  }

  if (request.method === "GET" && url.pathname === "/api/content-tags") {
    return sendJson(response, 200, {
      baseUrl: contentTestBaseUrl(),
      tags: contentTestTags(),
    });
  }

  const contentQrMatch = /^\/api\/content-tags\/([0-9a-z]{6}|[0-9a-z]{8})\/qr$/i.exec(
    url.pathname,
  );

  if (request.method === "GET" && contentQrMatch) {
    const id = contentQrMatch[1].toLowerCase();
    const tag = contentTestTags().find((candidate) => candidate.id === id);

    if (!tag) {
      return send(response, 404, "Unknown local content test tag.");
    }

    const svg = await QRCode.toString(tag.url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#101b4b", light: "#ffffff" },
    });
    return send(response, 200, svg, "image/svg+xml; charset=utf-8");
  }

  if (request.method === "POST" && url.pathname === "/api/tags") {
    try {
      const body = await requestBody(request);
      const tag = await createTag(Number(body.length));
      return sendJson(response, 201, { tag });
    } catch (error) {
      return sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const qrMatch = /^\/api\/tags\/([0-9a-z]{6}|[0-9a-z]{8})\/qr$/i.exec(
    url.pathname,
  );

  if (request.method === "GET" && qrMatch) {
    const id = qrMatch[1].toLowerCase();
    const store = readStore();
    const tag = store.tags.find((candidate) => candidate.id === id);

    if (!tag) {
      return send(response, 404, "Unknown local test tag.");
    }

    const svg = await QRCode.toString(tag.url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#101b4b", light: "#ffffff" },
    });
    return send(response, 200, svg, "image/svg+xml; charset=utf-8");
  }

  if (request.method === "GET" && url.pathname === "/") {
    return send(
      response,
      200,
      readFileSync(join(PUBLIC_DIR, "index.html")),
      "text/html; charset=utf-8",
    );
  }

  return send(response, 404, "Not Found");
}

createServer((request, response) => {
  handler(request, response).catch((error) => {
    console.error(error);
    sendJson(response, 500, { error: "Local Tag Lab request failed." });
  });
}).listen(PORT, HOST, () => {
  console.log(`myQR24 Tag Lab running on http://${HOST}:${PORT}`);
  console.log("Secrets remain server-side; stop with Ctrl+C.");
});
