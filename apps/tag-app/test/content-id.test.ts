import { describe, expect, it } from "vitest";
import {
  CONTENT_ID_MAX,
  CONTENT_ID_RANDOM_BITS,
  CONTENT_ID_RANDOM_MASK,
  contentIdTimestampSeconds,
  formatContentId,
  generateContentId,
  parseContentId,
} from "../workers/content-id";

describe("content item ids", () => {
  it("packs Unix seconds and random bits into a JavaScript-safe integer", () => {
    const nowMs = 1_760_000_000_000;
    const id = generateContentId(nowMs, () => CONTENT_ID_RANDOM_MASK);
    expect(Number.isSafeInteger(id)).toBe(true);
    expect(id).toBe(1_760_000_000 * 2 ** CONTENT_ID_RANDOM_BITS + CONTENT_ID_RANDOM_MASK);
    expect(contentIdTimestampSeconds(id)).toBe(1_760_000_000);
    expect(id).toBeLessThanOrEqual(CONTENT_ID_MAX);
  });

  it("round-trips through the JSON decimal string boundary", () => {
    const id = generateContentId(1_760_000_000_000, () => 42);
    expect(parseContentId(formatContentId(id))).toBe(id);
  });

  it("rejects malformed, unsafe and out-of-range ids", () => {
    expect(parseContentId("")).toBeNull();
    expect(parseContentId("0")).toBeNull();
    expect(parseContentId("0185000000000000")).toBeNull();
    expect(parseContentId("+1850000000000000")).toBeNull();
    expect(parseContentId("cnt_1850000000000000")).toBeNull();
    expect(parseContentId("4503599627370496")).toBeNull();
    expect(parseContentId("1850000000000000")).toBe(1_850_000_000_000_000);
    expect(() => formatContentId(0)).toThrow();
  });

  it("fails closed for timestamps or random values outside the packed range", () => {
    expect(() => generateContentId(2 ** 32 * 1000, () => 0)).toThrow(/timestamp/);
    expect(() => generateContentId(1_760_000_000_000, () => CONTENT_ID_RANDOM_MASK + 1)).toThrow(/random/);
    expect(contentIdTimestampSeconds(0)).toBeNull();
  });
});
