import { describe, expect, it } from "vitest";
import {
  CONTENT_ROOT,
  ITEM_FILE_NAME,
  descriptionFileName,
  globalDescriptionFileKey,
  globalItemFileKey,
  globalItemVariantKey,
  tagContentFileKey,
  tagContentFileName,
  tagElementFileKey,
  tagElementFileName,
  tagItemFileKey,
  tagItemOriginalKey,
  tagItemVariantKey,
  tagRangeDescriptionFileKey,
} from "../workers/content-paths";

describe("content path derivation", () => {
  it("defines the exact revisioned file names used by publisher and API", () => {
    expect(CONTENT_ROOT).toBe("content/v1");
    expect(ITEM_FILE_NAME).toBe("item.json");
    expect(tagContentFileName(8)).toBe("tag-rev8.json");
    expect(tagElementFileName(8)).toBe("element-rev8.json");
    expect(descriptionFileName(7)).toBe("content-rev7.json");
    expect(() => tagContentFileName(0)).toThrow();
    expect(() => tagElementFileName(1.5)).toThrow();
  });

  it("derives every operative path from numeric identifiers only", () => {
    expect(tagContentFileKey(623187229, "tag-rev8.json"))
      .toBe("content/v1/tags/623187229/tag-rev8.json");
    expect(tagElementFileKey(623187229, "cel_gallery", "element-rev8.json"))
      .toBe("content/v1/tags/623187229/elements/cel_gallery/element-rev8.json");
    expect(tagItemFileKey(623187229, 1850000000000000))
      .toBe("content/v1/tags/623187229/items/1850000000000000/item.json");
    expect(tagItemOriginalKey(623187229, 1850000000000000, "Titelbild.JPG"))
      .toBe("content/v1/tags/623187229/items/1850000000000000/Titelbild.JPG");
    expect(tagItemVariantKey(623187229, 1850000000000000, "large"))
      .toBe("content/v1/tags/623187229/items/1850000000000000/variants/large");
    expect(globalItemFileKey(1850000000000001))
      .toBe("content/v1/global/items/1850000000000001/item.json");
    expect(globalItemVariantKey(1850000000000001, "cover"))
      .toBe("content/v1/global/items/1850000000000001/variants/cover");
    expect(tagRangeDescriptionFileKey("campaign-summer-6-001", "redirect-default", "content-rev7.json"))
      .toBe("content/v1/tag-ranges/campaign-summer-6-001/descriptions/redirect-default/content-rev7.json");
    expect(globalDescriptionFileKey("redirect-default", "content-rev3.json"))
      .toBe("content/v1/global/descriptions/redirect-default/content-rev3.json");
  });

  it("does not accept Base36 TAG ids or client-shaped path segments", () => {
    expect(() => tagContentFileKey("ab12cd", "tag-rev8.json")).toThrow();
    expect(() => tagContentFileKey("0623187229", "tag-rev8.json")).toThrow();
    expect(() => tagElementFileKey(623187229, "gallery", "element-rev8.json")).toThrow();
    expect(() => tagElementFileKey(623187229, "cel_gallery", "../element.json")).toThrow();
    expect(() => tagItemVariantKey(623187229, 1850000000000000, "../cover")).toThrow();
    expect(() => tagItemOriginalKey(623187229, 1850000000000000, "../cover.jpg")).toThrow();
    expect(() => tagItemOriginalKey(623187229, 1850000000000000, "folder/photo.jpg")).toThrow();
    expect(() => tagRangeDescriptionFileKey("../range", "redirect-default", "content-rev1.json")).toThrow();
    expect(() => globalDescriptionFileKey("Redirect Default", "content-rev1.json")).toThrow();
  });
});
