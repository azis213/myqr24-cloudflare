import { argon2id } from "hash-wasm";
import { describe, expect, it } from "vitest";

describe("Argon2id worker calibration", () => {
  it("uses the documented starting parameters and records a local timing sample", async () => {
    const startedAt = performance.now();
    const hash = await argon2id({
      password: "benchmark-only-pin",
      secret: "benchmark-only-pepper",
      salt: "benchmark-local-salt",
      iterations: 1,
      parallelism: 1,
      memorySize: 8192,
      hashLength: 32,
      outputType: "encoded",
    });
    const elapsedMs = performance.now() - startedAt;
    expect(hash).toContain("$argon2id$");
    expect(elapsedMs).toBeGreaterThan(0);
  });
});