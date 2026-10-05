import { describe, expect, it } from "vitest";
import {
  getPublicTagView,
  UnknownPublicTagError,
} from "./publicTagViewService";

describe("getPublicTagView", () => {
  it("returns the published public fixture for a valid tag ID", async () => {
    await expect(getPublicTagView("KOFFER24")).resolves.toMatchObject({
      tag: {
        id: "koffer24",
        displayName: "Reisekoffer",
      },
      enabledFeatures: ["vault", "lost-found"],
    });
  });

  it("returns the wedding fixture with public documents and a contribution demo", async () => {
    await expect(getPublicTagView("TRAUUNG1")).resolves.toMatchObject({
      tag: {
        id: "trauung1",
        presentation: "wedding",
      },
      vault: {
        guestContributionDemo: {
          enabled: true,
          maxImages: 5,
        },
      },
    });

    const view = await getPublicTagView("trauung1");
    const documents = view.vault.blocks.find((block) => block.type === "documents");

    expect(documents).toMatchObject({
      type: "documents",
      documents: expect.arrayContaining([
        expect.objectContaining({ kind: "menu" }),
        expect.objectContaining({ kind: "invitation" }),
        expect.objectContaining({ kind: "thank-you" }),
      ]),
    });
  });

  it("models a wedding configuration without guest uploads", async () => {
    const view = await getPublicTagView("fest2026");

    expect(view.vault.guestContributionDemo).toMatchObject({
      enabled: false,
      maxImages: 0,
    });
  });

  it("rejects malformed tag IDs without exposing a view", async () => {
    await expect(getPublicTagView("invalid!")).rejects.toBeInstanceOf(
      UnknownPublicTagError,
    );
  });

  it("rejects well-formed but unpublished tag IDs", async () => {
    await expect(getPublicTagView("abcdef")).rejects.toBeInstanceOf(
      UnknownPublicTagError,
    );
  });
});
