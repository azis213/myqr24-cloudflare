import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/edge-routing.json";
import {
  calculateHmacNibble,
  calculateRedirectSignature,
  decodeTagId,
  encodeFeistel,
  extractTagRequest,
  findRange,
  formatBase36,
  handleRequest,
  isValidRangeIndex,
  parseBase36,
  resolveTag,
  toSafeRedirect,
  type Env,
  type FeatureAssignment,
  type RedirectFeature,
  type ScanEnvironment,
  type TagLength,
  type TagRange,
} from "../src/index";

const secrets = fixtures.secrets;

function createConfig(
  entries: Record<string, unknown>,
  reads: string[] = [],
): Env["TAG_CONFIG"] {
  return {
    get: async (key: string, type?: "json") => {
      reads.push(key);
      return type === "json" ? ((entries[key] ?? null) as never) : null;
    },
  } as unknown as Env["TAG_CONFIG"];
}

function createEnv(
  entries: Record<string, unknown>,
  reads: string[] = [],
): Env {
  return {
    ...secrets,
    SCAN_ENVIRONMENT: "production",
    TAG_CONFIG: createConfig(entries, reads),
  };
}

function range(
  id: string,
  value: bigint,
  length: TagLength,
  groupId = "group-default",
  active = true,
): TagRange {
  const start = length === 8 ? value & ~0x0fn : value;
  const end = length === 8 ? start + 15n : value;

  return {
    id,
    start: start.toString(),
    end: end.toString(),
    groupId,
    length,
    active,
  };
}

function rangeIndex(ranges: TagRange[]): Record<string, unknown> {
  return {
    "tag-range-index": {
      version: 2,
      ranges,
    },
  };
}

function activeFeature(featureId: keyof typeof fixtures.features): unknown {
  return fixtures.features[featureId];
}

async function publicTag(
  decodedValue: bigint,
  length: TagLength,
): Promise<{ id: string; value: bigint }> {
  const encrypted = await encodeFeistel(
    decodedValue,
    length,
    secrets.FEISTEL_SECRET,
  );
  expect(encrypted).not.toBeNull();

  const id = formatBase36(encrypted!, length);
  expect(id).not.toBeNull();

  return { id: id!, value: decodedValue };
}

async function sixTag(): Promise<{ id: string; value: bigint }> {
  return publicTag(36n ** 5n + 12345n, 6);
}

async function eightTag(): Promise<{
  id: string;
  value: bigint;
  base: bigint;
}> {
  const lower = 36n ** 7n;
  const base = (lower + 64n) & ~0x0fn;
  const nibble = await calculateHmacNibble(base, secrets.TAG_HMAC_SECRET);
  expect(nibble).not.toBeNull();

  const value = base | BigInt(nibble!);
  const tag = await publicTag(value, 8);

  return { ...tag, base };
}

function requestFor(
  id: string,
  init?: RequestInit,
  hostname = "qx4.uk",
  route = "t",
): Request {
  return new Request(`https://${hostname}/${route}/${id}`, init);
}

async function workerResponse(
  request: Request,
  entries: Record<string, unknown>,
  reads: string[] = [],
): Promise<Response> {
  return handleRequest(
    request as Parameters<typeof handleRequest>[0],
    createEnv(entries, reads),
    {} as ExecutionContext,
  );
}

describe("URL extraction", () => {
  it.each([
    [
      "https://qx4.uk/T/Ab12Cd",
      "production",
      { id: "ab12cd", length: 6 },
    ],
    [
      "https://qx4.uk/T/Ab12Cd34",
      "production",
      { id: "ab12cd34", length: 8 },
    ],
    [
      "https://p.myqr24.com/t1/ab12cd34",
      "production",
      { id: "ab12cd34", length: 8 },
    ],
    [
      "https://s.qx4.uk/t/Ab12Cd34",
      "staging",
      { id: "ab12cd34", length: 8 },
    ],
    [
      "https://s.myqr24.com/T1/Ab12Cd",
      "staging",
      { id: "ab12cd", length: 6 },
    ],
    [
      "https://s.myqr24.com/T1/ab12cd34",
      "staging",
      { id: "ab12cd34", length: 8 },
    ],
  ])(
    "TC-URL-001/002 extracts an eight-character tag from a case-insensitive route",
    (input, environment, expected) => {
      expect(
        extractTagRequest(new URL(input), environment as ScanEnvironment),
      ).toEqual(expected);
    },
  );

  it.each([
    "https://qx4.uk/ab12cd",
    "https://qx4.uk/ab12cd34",
    "https://qx4.uk/t/ab12c",
    "https://qx4.uk/t2/ab12cd34",
    "https://qx4.uk/t/ab12cd34/extra",
    "https://p.myqr24.com/t/ab12cd3!",
    "https://p.myqr24.com/t/ab12cd3",
    "https://s.qx4.uk/t/ab12cd34",
    "https://s.myqr24.com/ab12cd34",
    "https://untrusted.example/t/ab12cd34",
  ])("TC-URL-003 rejects unsupported production URL shape: %s", (input) => {
    expect(extractTagRequest(new URL(input), "production")).toBeNull();
  });

  it("TC-URL-004 rejects scan hosts assigned to the other environment", () => {
    expect(
      extractTagRequest(new URL("https://s.qx4.uk/t/ab12cd34"), "production"),
    ).toBeNull();
    expect(
      extractTagRequest(new URL("https://qx4.uk/t/ab12cd34"), "staging"),
    ).toBeNull();
  });
});

describe("canonical ID and HMAC primitives", () => {
  it("TC-CRYPTO-004 parses Base36 into BigInt without precision loss", () => {
    expect(parseBase36("zzzzzzzz")).toBe(2_821_109_907_455n);
    expect(parseBase36("ABC123")).toBe(parseBase36("abc123"));
    expect(parseBase36("abc-123")).toBeNull();
  });

  it("TC-CRYPTO-001 decodes a generated six-character tag into I(6)", async () => {
    const tag = await sixTag();
    const request = extractTagRequest(new URL(`https://qx4.uk/t/${tag.id}`));

    await expect(decodeTagId(request!, secrets)).resolves.toBe(tag.value);
    expect(tag.value).toBeGreaterThanOrEqual(36n ** 5n);
    expect(tag.value).toBeLessThan(36n ** 6n);
  });

  it("TC-CRYPTO-002 and TC-HMAC-001 retain the complete valid 8-character integer", async () => {
    const tag = await eightTag();
    const request = extractTagRequest(new URL(`https://qx4.uk/t/${tag.id}`));

    await expect(decodeTagId(request!, secrets)).resolves.toBe(tag.value);
    expect(tag.value).toBeGreaterThanOrEqual(36n ** 7n);
    expect(tag.value).toBeLessThan(36n ** 8n);
    expect(tag.value & ~0x0fn).toBe(tag.base);
  });

  it("TC-HMAC-002 rejects a public tag carrying the wrong HMAC nibble", async () => {
    const tag = await eightTag();
    const wrongValue = tag.base | ((tag.value + 1n) & 0x0fn);
    const wrongTag = await publicTag(wrongValue, 8);
    const request = extractTagRequest(new URL(`https://qx4.uk/t/${wrongTag.id}`));

    await expect(decodeTagId(request!, secrets)).resolves.toBeNull();
  });
});

describe("range validation", () => {
  it("TC-RANGE-001 finds an active range only for the matching length", async () => {
    const tag = await sixTag();
    const ranges = [range("range-six", tag.value, 6)];

    expect(findRange(ranges, tag.value, 6)?.id).toBe("range-six");
    expect(findRange(ranges, tag.value, 8)).toBeNull();
  });

  it("TC-RANGE-002 rejects an inactive matching range", async () => {
    const tag = await sixTag();

    expect(findRange([range("range-six", tag.value, 6, "group-default", false)], tag.value, 6)).toBeNull();
  });

  it("TC-RANGE-004 rejects overlapping or malformed global indexes", () => {
    const lower = 36n ** 5n;

    expect(
      isValidRangeIndex([
        {
          id: "first",
          start: lower.toString(),
          end: (lower + 10n).toString(),
          groupId: "one",
          length: 6,
          active: true,
        },
        {
          id: "second",
          start: (lower + 10n).toString(),
          end: (lower + 20n).toString(),
          groupId: "two",
          length: 6,
          active: true,
        },
      ]),
    ).toBe(false);
  });

  it("TC-RANGE-005 rejects 8-character ranges that do not cover complete slots", async () => {
    const tag = await eightTag();

    expect(
      isValidRangeIndex([
        {
          id: "bad-eight",
          start: (tag.base + 1n).toString(),
          end: (tag.base + 15n).toString(),
          groupId: "group-default",
          length: 8,
          active: true,
        },
      ]),
    ).toBe(false);
  });
});

describe("feature assignment priority", () => {
  it("TC-RULE-001 resolves tag assignments before range and group assignments", async () => {
    const tag = await sixTag();
    const entries = {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": {
        id: "group-default",
        featureIds: ["json-default"],
      },
      "range-rule:range-default": {
        featureIds: ["redirect-range"],
      },
      [`tag:${tag.value}`]: {
        featureIds: ["redirect-tag"],
      },
      "feature:redirect-tag": activeFeature("redirect-tag"),
    };

    const resolved = await resolveTag(tag.value, 6, createConfig(entries));

    expect(resolved?.features.map((feature) => feature.id)).toEqual([
      "redirect-tag",
    ]);
  });

  it("TC-RULE-002 resolves range assignments before group assignments", async () => {
    const tag = await sixTag();
    const entries = {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": {
        id: "group-default",
        featureIds: ["json-default"],
      },
      "range-rule:range-default": {
        featureIds: ["redirect-range"],
      },
      "feature:redirect-range": activeFeature("redirect-range"),
    };

    const resolved = await resolveTag(tag.value, 6, createConfig(entries));

    expect(resolved?.features.map((feature) => feature.id)).toEqual([
      "redirect-range",
    ]);
  });

  it("TC-RULE-003/005 uses the group when higher assignments are missing or empty", async () => {
    const tag = await sixTag();
    const entries = {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": fixtures.groups["group-default"],
      "range-rule:range-default": { featureIds: [] } satisfies FeatureAssignment,
      "feature:json-default": activeFeature("json-default"),
    };

    const resolved = await resolveTag(tag.value, 6, createConfig(entries));

    expect(resolved?.features.map((feature) => feature.id)).toEqual([
      "json-default",
    ]);
  });

  it("TC-RULE-004 does not read direct assignments when no active range exists", async () => {
    const tag = await sixTag();
    const reads: string[] = [];
    const response = await workerResponse(
      requestFor(tag.id),
      {
        ...rangeIndex([]),
        [`tag:${tag.value}`]: { featureIds: ["redirect-tag"] },
      },
      reads,
    );

    expect(response.status).toBe(404);
    expect(reads).toEqual(["tag-range-index"]);
  });

  it("TC-RULE-006 rejects invalid assignment feature IDs", async () => {
    const tag = await sixTag();
    const entries = {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": {
        id: "group-default",
        featureIds: ["json-default"],
      },
      [`tag:${tag.value}`]: { featureIds: ["not valid"] },
    };

    await expect(resolveTag(tag.value, 6, createConfig(entries))).resolves.toBeNull();
  });
});

describe("features, templates and worker responses", () => {
  it("TC-FEATURE-001 and TC-TEMPLATE-001 redirect through a fixed URL", async () => {
    const tag = await sixTag();
    const response = await workerResponse(requestFor(tag.id), {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": {
        id: "group-default",
        featureIds: ["redirect-default"],
      },
      "feature:redirect-default": activeFeature("redirect-default"),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://destination.example.test/fixed",
    );
  });

  it("TC-TEMPLATE-002 renders only server-defined template values", async () => {
    const tag = await sixTag();
    const response = await workerResponse(requestFor(tag.id), {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": {
        id: "group-default",
        featureIds: ["redirect-range"],
      },
      "feature:redirect-range": activeFeature("redirect-range"),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `https://app.example.test/tag/${tag.id}?id=${tag.value}&group=group-default&length=6`,
    );
  });

  it.each([
    ["unknown-placeholder", activeFeature("unknown-placeholder")],
    ["signature-placeholder", activeFeature("signature-placeholder")],
    ["unsafe-redirect", activeFeature("unsafe-redirect")],
  ])("TC-TEMPLATE-003/004/005 rejects %s", async (featureId, feature) => {
    const tag = await sixTag();
    const response = await workerResponse(requestFor(tag.id), {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": {
        id: "group-default",
        featureIds: [featureId],
      },
      [`feature:${featureId}`]: feature,
    });

    expect(response.status).toBe(404);
  });

  it("TC-TEMPLATE-006 rejects a redirect document with url and urlTemplate", async () => {
    const invalidFeature = {
      id: "invalid-redirect",
      type: "redirect",
      enabled: true,
      url: "https://example.test/fixed",
      urlTemplate: "https://example.test/{tagId}",
    } as unknown as RedirectFeature;

    await expect(
      toSafeRedirect(
        invalidFeature,
        {
          tagId: "abc123",
          decodedValue: "123",
          length: "6",
          groupId: "group-default",
        },
        secrets.REDIRECT_SIGNING_SECRET,
      ),
    ).resolves.toBeNull();
  });

  it("TC-REDIRECT-SIGN-001 creates a short-lived signed redirect URL", async () => {
    const context = {
      tagId: "abc123",
      decodedValue: "60478521",
      length: "6",
      groupId: "group-default",
    };
    const feature = activeFeature("redirect-signed") as RedirectFeature;
    const now = 1_790_786_000_000;
    const response = await toSafeRedirect(
      feature,
      context,
      secrets.REDIRECT_SIGNING_SECRET,
      now,
    );

    expect(response?.status).toBe(302);

    const location = new URL(response?.headers.get("location") ?? "");
    expect(location.origin).toBe("https://app.example.test");
    expect(location.pathname).toBe("/one-time");
    expect(location.searchParams.get("tag")).toBe(context.tagId);
    expect(location.searchParams.get("id")).toBe(context.decodedValue);
    expect(location.searchParams.get("exp")).toBe("1790786060");

    const unsignedDestination = new URL("https://app.example.test/one-time");
    unsignedDestination.searchParams.set("tag", context.tagId);
    unsignedDestination.searchParams.set("id", context.decodedValue);
    const expectedSignature = await calculateRedirectSignature(
      feature.id,
      unsignedDestination,
      context,
      1_790_786_060,
      secrets.REDIRECT_SIGNING_SECRET,
    );

    expect(location.searchParams.get("sig")).toBe(expectedSignature);
    expect(location.searchParams.get("sig")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("TC-REDIRECT-SIGN-002 binds signature to the redirect context", async () => {
    const destination = new URL(
      "https://app.example.test/one-time?tag=abc123&id=60478521",
    );
    const context = {
      tagId: "abc123",
      decodedValue: "60478521",
      length: "6",
      groupId: "group-default",
    };
    const expiresAt = 1_790_786_060;
    const signature = await calculateRedirectSignature(
      "redirect-signed",
      destination,
      context,
      expiresAt,
      secrets.REDIRECT_SIGNING_SECRET,
    );
    const tamperedSignature = await calculateRedirectSignature(
      "redirect-signed",
      new URL("https://app.example.test/one-time?tag=abc123&id=60478522"),
      context,
      expiresAt,
      secrets.REDIRECT_SIGNING_SECRET,
    );

    expect(signature).not.toBe(tamperedSignature);
  });

  it("TC-REDIRECT-SIGN-003 rejects signing without a secret or with reserved URL parameters", async () => {
    const context = {
      tagId: "abc123",
      decodedValue: "60478521",
      length: "6",
      groupId: "group-default",
    };
    const feature = activeFeature("redirect-signed") as RedirectFeature;
    const reservedParameterFeature = {
      ...feature,
      urlTemplate: "https://app.example.test/one-time?exp=123",
    };

    await expect(
      toSafeRedirect(feature, context, "", 1_790_786_000_000),
    ).resolves.toBeNull();
    await expect(
      toSafeRedirect(
        reservedParameterFeature,
        context,
        secrets.REDIRECT_SIGNING_SECRET,
        1_790_786_000_000,
      ),
    ).resolves.toBeNull();
  });

  it("TC-FEATURE-003/004 rejects missing and disabled feature documents", async () => {
    const tag = await sixTag();

    for (const featureId of ["missing-feature", "disabled-feature"]) {
      const response = await workerResponse(requestFor(tag.id), {
        ...rangeIndex([range("range-default", tag.value, 6)]),
        "group:group-default": {
          id: "group-default",
          featureIds: [featureId],
        },
        ...(featureId === "disabled-feature"
          ? { "feature:disabled-feature": activeFeature("disabled-feature") }
          : {}),
      });

      expect(response.status).toBe(404);
    }
  });

  it("TC-RESPONSE-001/002 returns JSON for non-redirect features", async () => {
    const tag = await sixTag();
    const response = await workerResponse(requestFor(tag.id), {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": fixtures.groups["group-default"],
      "feature:json-default": activeFeature("json-default"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      tag: { id: tag.id, value: tag.value.toString(), length: 6 },
      range: { id: "range-default", groupId: "group-default" },
      group: { id: "group-default" },
      features: [{ id: "json-default", type: "json" }],
    });
  });

  it("TC-HTTP-002/TC-RESPONSE-004 returns no body for a valid HEAD request", async () => {
    const tag = await sixTag();
    const response = await workerResponse(requestFor(tag.id, { method: "HEAD" }), {
      ...rangeIndex([range("range-default", tag.value, 6)]),
      "group:group-default": fixtures.groups["group-default"],
      "feature:json-default": activeFeature("json-default"),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("TC-HTTP-001 returns 405 for unsupported methods", async () => {
    const response = await workerResponse(
      requestFor("abc123", { method: "POST" }),
      {},
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });
});

describe("8-character edge integration", () => {
  it("TC-HMAC-003 rejects invalid HMAC before any KV read", async () => {
    const tag = await eightTag();
    const wrongTag = await publicTag(tag.base | ((tag.value + 1n) & 0x0fn), 8);
    const reads: string[] = [];

    const response = await workerResponse(requestFor(wrongTag.id), {}, reads);

    expect(response.status).toBe(404);
    expect(reads).toEqual([]);
  });

  it("TC-HMAC-004 uses the complete HMAC-valid integer for an 8-character range", async () => {
    const tag = await eightTag();
    const start = tag.base;
    const end = tag.base + 15n;
    const response = await workerResponse(requestFor(tag.id), {
      ...rangeIndex([
        {
          id: "range-eight",
          start: start.toString(),
          end: end.toString(),
          groupId: "group-default",
          length: 8,
          active: true,
        },
      ]),
      "group:group-default": fixtures.groups["group-default"],
      "feature:json-default": activeFeature("json-default"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tag: { id: tag.id, value: tag.value.toString(), length: 8 },
      range: { id: "range-eight" },
    });
  });
});
