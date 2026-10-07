import { describe, expect, it } from "vitest";
import type { TagRangeDefinition } from "../src/domain";
import {
  createTagListJson,
  generateTags,
  parseTagListJson,
} from "../src/tag-generation";

const testSecrets = {
  feistelSecret: "tag-generator-test-feistel-secret",
  hmacSecret: "tag-generator-test-hmac-secret",
};

const ranges: TagRangeDefinition[] = [
  {
    id: "six",
    name: "Sechsstelliger Bereich",
    start: "60466176",
    end: "60466178",
    tagLength: 6,
    labelText: "Test 6",
    qrProfile: { version: "auto", errorCorrectionLevel: "M", quietZoneModules: 4 },
    createdAt: "2026-10-07T15:00:00.000Z",
    updatedAt: "2026-10-07T15:00:00.000Z",
  },
  {
    id: "eight",
    name: "Achtstelliger Bereich",
    start: "78364164096",
    end: "78364164128",
    tagLength: 8,
    labelText: "Test 8",
    qrProfile: { version: "auto", errorCorrectionLevel: "M", quietZoneModules: 4 },
    createdAt: "2026-10-07T15:00:00.000Z",
    updatedAt: "2026-10-07T15:00:00.000Z",
  },
];

describe("TAG-Generierung mit Edge-Router-Codec", () => {
  it("generiert eindeutige öffentliche IDs und vollständige QR-Ziel-URLs", async () => {
    const tags = await generateTags(
      ranges,
      "https://s.myqr24.com/t/",
      testSecrets,
    );

    expect(tags).toHaveLength(6);
    expect(new Set(tags.map((tag) => tag.tagId)).size).toBe(tags.length);
    expect(tags.filter((tag) => tag.tagLength === 6)).toHaveLength(3);
    expect(tags.filter((tag) => tag.tagLength === 8)).toHaveLength(3);

    for (const tag of tags) {
      expect(tag.url).toBe(`https://s.myqr24.com/t/${tag.tagId}`);
      expect(tag.tagId).toMatch(tag.tagLength === 6 ? /^[0-9a-z]{6}$/ : /^[0-9a-z]{8}$/);
    }
  });

  it("meldet Fortschritt bis zum vollständigen Lauf", async () => {
    const progress: string[] = [];
    await generateTags([ranges[0]], "https://s.myqr24.com/t/", testSecrets, {
      onProgress: ({ completed, total }) => progress.push(`${completed}/${total}`),
    });
    expect(progress).toEqual(["3/3"]);
  });

  it("exportiert und importiert eine TAG-Liste ohne Secrets", async () => {
    const tags = await generateTags([ranges[0]], "https://s.myqr24.com/t/", testSecrets);
    const json = createTagListJson("https://s.myqr24.com/t/", [ranges[0]], tags);

    expect(json).not.toContain(testSecrets.feistelSecret);
    expect(json).not.toContain(testSecrets.hmacSecret);

    const imported = parseTagListJson(json);
    expect(imported.tags).toEqual(tags);
    expect(imported.source.baseUrl).toBe("https://s.myqr24.com/t/");
  });

  it("weist TAG-Listen mit doppelten IDs zurück", () => {
    const invalid = {
      schemaVersion: 1,
      kind: "myqr24.tag-generator.tag-list",
      generatedAt: "2026-10-07T15:00:00.000Z",
      source: { baseUrl: "https://s.myqr24.com/t/", ranges: [] },
      tags: [
        {
          tagId: "abc123",
          url: "https://s.myqr24.com/t/abc123",
          rangeId: "range",
          rangeName: "Range",
          ordinalInRange: "0",
          requestedValue: "60466176",
          decodedValue: "60466176",
          tagLength: 6,
          labelText: "",
        },
        {
          tagId: "abc123",
          url: "https://s.myqr24.com/t/abc123",
          rangeId: "range",
          rangeName: "Range",
          ordinalInRange: "1",
          requestedValue: "60466177",
          decodedValue: "60466177",
          tagLength: 6,
          labelText: "",
        },
      ],
    };

    expect(() => parseTagListJson(JSON.stringify(invalid))).toThrow(/doppelte TAG-IDs/);
  });
});
