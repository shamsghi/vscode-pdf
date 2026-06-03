import { describe, expect, it } from "vitest";
import { boxesOverlap, getPolygonBounds } from "../../src/webview/selection/geometry";

describe("selection geometry", () => {
  it("derives axis-aligned bounds from a polygon", () => {
    expect(getPolygonBounds([
      { x: 10, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 40 },
      { x: 10, y: 40 }
    ])).toEqual({
      left: 10,
      top: 20,
      right: 80,
      bottom: 40
    });
  });

  it("detects overlapping boxes", () => {
    expect(boxesOverlap(
      { left: 0, top: 0, right: 50, bottom: 20 },
      { left: 40, top: 0, right: 90, bottom: 20 }
    )).toBe(true);

    expect(boxesOverlap(
      { left: 0, top: 0, right: 20, bottom: 20 },
      { left: 30, top: 0, right: 50, bottom: 20 }
    )).toBe(false);
  });
});
