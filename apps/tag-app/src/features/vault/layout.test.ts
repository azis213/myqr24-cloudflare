import { describe, expect, it } from "vitest";
import { breakpointForWidth, effectiveColumns, effectiveSpan, layoutGap } from "./layout";

describe("vault layout", () => {
  const layout = {
    columns: 12,
    gap: "md" as const,
    responsive: {
      preferredColumns: { mobile: 1, tablet: 3, desktop: 4 },
      minColumnWidth: { tablet: "16rem", desktop: "18rem" },
    },
  };

  it("selects breakpoints and responsive column counts for common viewport widths", () => {
    expect(breakpointForWidth(360)).toBe("mobile");
    expect(effectiveColumns(layout, 360)).toBe(1);
    expect(breakpointForWidth(768)).toBe("tablet");
    expect(effectiveColumns(layout, 768)).toBe(3);
    expect(breakpointForWidth(1280)).toBe("desktop");
    expect(effectiveColumns(layout, 1280)).toBe(4);
  });

  it("maps placement fractions from the twelve-column source grid and defaults full-width", () => {
    expect(effectiveSpan({ span: { desktop: 8 } }, 12, "desktop")).toBe(8);
    expect(effectiveSpan({ span: { desktop: 4 } }, 12, "desktop")).toBe(4);
    expect(effectiveSpan(undefined, 12, "desktop")).toBe(12);
  });

  it("maps design gaps", () => {
    expect(layoutGap("sm")).toBe(8);
    expect(layoutGap("md")).toBe(16);
    expect(layoutGap("lg")).toBe(24);
  });
});