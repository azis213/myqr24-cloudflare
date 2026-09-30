import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/index";

describe("edge router worker", () => {
  it("returns an OK status response", async () => {
    const request = new Request("https://tags.example.test/nfc/demo-tag");
    const response = await handleRequest(
      request as Parameters<typeof handleRequest>[0],
      {},
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "myqr24-edge-router",
      path: "/nfc/demo-tag",
    });
  });
});
