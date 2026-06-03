import { describe, expect, it } from "vitest";
import {
  mergeSelectionHighlightRects,
  selectedItemsToText,
  type TextSelectionItem
} from "../../src/webview/selection/text";

function item(
  text: string,
  top: number,
  left: number,
  right: number,
  height = 12
): TextSelectionItem {
  return { text, top, left, right, height };
}

describe("selection helpers", () => {
  it("merges adjacent items on the same line into one highlight band", () => {
    const merged = mergeSelectionHighlightRects([
      item("Quoting", 10, 0, 40),
      item("publicly", 10, 44, 90),
      item("available", 10, 94, 150)
    ]);

    expect(merged).toEqual([
      { top: 10, left: 0, right: 150, height: 12 }
    ]);
  });

  it("keeps separate highlight bands for different lines", () => {
    const merged = mergeSelectionHighlightRects([
      item("first", 10, 0, 30),
      item("line", 10, 34, 60),
      item("second", 28, 0, 40)
    ]);

    expect(merged).toEqual([
      { top: 10, left: 0, right: 60, height: 12 },
      { top: 28, left: 0, right: 40, height: 12 }
    ]);
  });

  it("joins line text using span gaps instead of always inserting spaces", () => {
    const text = selectedItemsToText([
      item("Attributi", 10, 0, 60),
      item("on", 10, 60, 78)
    ]);

    expect(text).toBe("Attribution");
  });

  it("inserts spaces between distant items on the same line", () => {
    const text = selectedItemsToText([
      item("first", 10, 0, 30),
      item("second", 10, 80, 120)
    ]);

    expect(text).toBe("first second");
  });

  it("keeps separate highlight bands for separate words on the same line", () => {
    const merged = mergeSelectionHighlightRects([
      item("first", 10, 0, 30),
      item("second", 10, 80, 120)
    ]);

    expect(merged).toEqual([
      { top: 10, left: 0, right: 30, height: 12 },
      { top: 10, left: 80, right: 120, height: 12 }
    ]);
  });
});
