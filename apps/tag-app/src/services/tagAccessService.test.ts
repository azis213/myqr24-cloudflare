import { describe, expect, it } from "vitest";
import { bootstrapFromLocation } from "./tagAccessService";

describe("tag bootstrap parsing", () => {
  it("accepts a signed public bootstrap only for canonical 6, 8 and 10 character IDs", () => {
    const search = "?mode=public&av=1&rv=2&nonce=nonce-value&exp=1790786060&sig=signature-value";
    for (const tagId of ["ab12cd", "ab12cd34", "ab12cd34ef"]) {
      expect(bootstrapFromLocation(tagId, search)).toMatchObject({ mode: "public", accessVersion: 1, revision: 2 });
    }
    expect(bootstrapFromLocation("invalid!", search)).toBeNull();
  });

  it("rejects missing or malformed access parameters so React cannot infer authorization", () => {
    expect(bootstrapFromLocation("ab12cd", "?mode=public&av=0&rv=2&nonce=x&exp=1&sig=x")).toBeNull();
    expect(bootstrapFromLocation("ab12cd", "?mode=owner&av=1&rv=2&nonce=x&exp=1&sig=x")).toBeNull();
    expect(bootstrapFromLocation("ab12cd", "")).toBeNull();
  });
});