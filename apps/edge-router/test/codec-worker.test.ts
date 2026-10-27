import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/edge-routing.json";
import {
  handleCodecRequest,
  type CodecEnv,
} from "../src/codec-worker";
import { base36LowerBound } from "../src/codec";

const env: CodecEnv = {
  ...fixtures.secrets,
  TAG_CODEC_API_KEY_S01: "codec-api-test-key",
};

function request(
  endpoint: "encode" | "decode",
  body: unknown,
  init: RequestInit = {},
): Request {
  return new Request(
    `https://codec.s.myqr24.com/api/v1/tag-codec/${endpoint}`,
    {
      body: JSON.stringify(body),
      headers: {
        authorization: `Bearer ${env.TAG_CODEC_API_KEY_S01}`,
        "content-type": "application/json",
        ...init.headers,
      },
      method: "POST",
      ...init,
    },
  );
}

async function call(requestValue: Request): Promise<Response> {
  return handleCodecRequest(
    requestValue as Parameters<typeof handleCodecRequest>[0],
    env,
    {} as ExecutionContext,
  );
}

describe("private TAG codec API", () => {
  it("TC-CODEC-001 creates and decodes a canonical six-character tag through the shared kernel", async () => {
    const value = base36LowerBound(6) + 12345n;
    const encodeResponse = await call(
      request("encode", { length: 6, value: value.toString() }),
    );

    expect(encodeResponse.status).toBe(200);
    expect(encodeResponse.headers.get("cache-control")).toBe("no-store");

    const encoded = (await encodeResponse.json()) as {
      tag: { id: string; length: number; value: string };
    };
    expect(encoded.tag).toMatchObject({
      length: 6,
      value: value.toString(),
    });
    expect(encoded.tag.id).toMatch(/^[0-9a-z]{6}$/);

    const decodeResponse = await call(
      request("decode", { tagId: encoded.tag.id.toUpperCase() }),
    );

    expect(decodeResponse.status).toBe(200);
    await expect(decodeResponse.json()).resolves.toMatchObject({
      tag: { id: encoded.tag.id, length: 6, value: value.toString() },
    });
  });

  it("TC-CODEC-002 creates a linear eight-character tag without slot alignment", async () => {
    const value = base36LowerBound(8) + 65n;
    const encodeResponse = await call(
      request("encode", { length: 8, value: value.toString() }),
    );
    const encoded = (await encodeResponse.json()) as {
      tag: { id: string; length: number; value: string };
    };

    expect(encodeResponse.status).toBe(200);
    expect(encoded.tag).toMatchObject({
      length: 8,
      value: value.toString(),
    });
    expect(encoded.tag.id).toMatch(/^[0-9a-z]{8}$/);

    const decodeResponse = await call(
      request("decode", { tagId: encoded.tag.id }),
    );

    expect(decodeResponse.status).toBe(200);
    await expect(decodeResponse.json()).resolves.toMatchObject({
      tag: encoded.tag,
    });
  });

  it("TC-CODEC-003 round-trips a high canonical ten-character value", async () => {
    const value = base36LowerBound(10) + 1_000_000_000_000_000n;
    const encodeResponse = await call(
      request("encode", { length: 10, value: value.toString() }),
    );
    const encoded = (await encodeResponse.json()) as {
      tag: { id: string; length: number; value: string };
    };

    expect(encodeResponse.status).toBe(200);
    expect(encoded.tag).toMatchObject({
      length: 10,
      value: value.toString(),
    });
    expect(encoded.tag.id).toMatch(/^[0-9a-z]{10}$/);

    const decodeResponse = await call(
      request("decode", { tagId: encoded.tag.id }),
    );

    expect(decodeResponse.status).toBe(200);
    await expect(decodeResponse.json()).resolves.toMatchObject({
      tag: encoded.tag,
    });
  });

  it("TC-CODEC-004 fails closed for unknown paths, methods and missing credentials", async () => {
    const unknown = await call(
      new Request("https://codec.s.myqr24.com/api/v1/tag-codec/unknown"),
    );
    const get = await call(
      new Request("https://codec.s.myqr24.com/api/v1/tag-codec/encode"),
    );
    const unauthorizedRequest = request(
      "encode",
      { length: 6, value: base36LowerBound(6).toString() },
      { headers: { "content-type": "application/json" } },
    );
    const unauthorizedResponse = await call(unauthorizedRequest);

    expect(unknown.status).toBe(404);
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedResponse.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("TC-CODEC-005 rejects malformed and non-canonical input without exposing crypto details", async () => {
    const malformed = await call(
      request("encode", { length: 6, value: "12.5" }),
    );
    const sixBelowCanonical = await call(
      request("encode", { length: 6, value: "1" }),
    );
    const tenBelowCanonical = await call(
      request("encode", { length: 10, value: base36LowerBound(8).toString() }),
    );
    const badTag = await call(request("decode", { tagId: "invalid!" }));

    for (const response of [
      malformed,
      sixBelowCanonical,
      tenBelowCanonical,
      badTag,
    ]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: { code: "invalid_request" },
      });
    }
  });
});
