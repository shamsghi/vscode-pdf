import {
  boxesOverlap,
  getPolygonBounds,
  polygonIntersectsBox,
  type SelectionBounds,
  type SelectionPoint
} from "./geometry.js";

export type TextSelectionMode = "rectangle" | "freestyle";

export type TextSelectionItem = {
  text: string;
  top: number;
  left: number;
  right: number;
  height: number;
};

export type SelectionHighlightRect = {
  top: number;
  left: number;
  right: number;
  height: number;
};

type WordCandidate = {
  key: string;
  item: TextSelectionItem;
};

const selectionSlopPx = 3;

export function applyTextSelection(
  textLayer: HTMLElement,
  points: SelectionPoint[],
  mode: TextSelectionMode = "rectangle"
): TextSelectionItem[] {
  const layerRect = textLayer.getBoundingClientRect();
  textLayer.querySelectorAll(".custom-selection-highlight").forEach((element) => element.remove());
  if (points.length < 3) {
    return [];
  }

  const candidates = collectWordCandidates(textLayer, layerRect);
  const selected = new Map<string, TextSelectionItem>();
  for (const candidate of candidates) {
    if (intersectsSelection(points, candidate.item)) {
      selected.set(candidate.key, candidate.item);
    }
  }

  if (mode === "rectangle" && selected.size > 0) {
    expandRectangleSelection(candidates, selected, getPolygonBounds(points));
  }

  const sortedItems = Array.from(selected.values()).sort(compareTextItemsVisually);
  drawMergedSelectionHighlights(textLayer, sortedItems);
  return sortedItems;
}

export function mergeSelectionHighlightRects(items: TextSelectionItem[]): SelectionHighlightRect[] {
  if (items.length === 0) {
    return [];
  }

  const merged: SelectionHighlightRect[] = [];
  for (const item of [...items].sort(compareTextItemsVisually)) {
    const previous = merged.at(-1);
    const lineTolerance = Math.max(4, Math.min(item.height || 0, previous?.height || item.height || 0) * 0.7);
    const gapThreshold = Math.max(8, item.height * 0.5);
    if (
      previous
      && Math.abs(previous.top - item.top) <= lineTolerance
      && item.left - previous.right <= gapThreshold
    ) {
      previous.right = Math.max(previous.right, item.right);
      previous.top = Math.min(previous.top, item.top);
      previous.height = Math.max(previous.height, item.top + item.height - previous.top);
      continue;
    }

    merged.push({
      top: item.top,
      left: item.left,
      right: item.right,
      height: item.height
    });
  }

  return merged;
}

export function getSpanBounds(span: HTMLElement): DOMRect | undefined {
  if (span.firstChild?.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    try {
      range.selectNodeContents(span);
      const rects = Array.from(range.getClientRects());
      if (rects.length > 0) {
        let left = Number.POSITIVE_INFINITY;
        let top = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;
        let bottom = Number.NEGATIVE_INFINITY;

        for (const rect of rects) {
          if (rect.width <= 0 && rect.height <= 0) {
            continue;
          }
          left = Math.min(left, rect.left);
          top = Math.min(top, rect.top);
          right = Math.max(right, rect.right);
          bottom = Math.max(bottom, rect.bottom);
        }

        if (Number.isFinite(left)) {
          return new DOMRect(left, top, right - left, bottom - top);
        }
      }
    } finally {
      range.detach();
    }
  }

  const rect = span.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? rect : undefined;
}

export function measureTextNodeRange(node: ChildNode, start: number, end: number): DOMRect | undefined {
  if (node.nodeType !== Node.TEXT_NODE) {
    return undefined;
  }

  const range = document.createRange();
  try {
    range.setStart(node, start);
    range.setEnd(node, end);
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : undefined;
  } finally {
    range.detach();
  }
}

export function estimateTextRangeRect(span: HTMLElement, text: string, start: number, end: number): DOMRect | undefined {
  const rect = getSpanBounds(span) ?? span.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || text.length === 0) {
    return undefined;
  }

  const left = rect.left + rect.width * (start / text.length);
  const right = rect.left + rect.width * (end / text.length);
  return new DOMRect(left, rect.top, right - left, rect.height);
}

export function selectedItemsToText(items: TextSelectionItem[]): string {
  const lines: TextSelectionItem[][] = [];
  for (const item of items) {
    const lastLine = lines.at(-1);
    const tolerance = Math.max(4, item.height * 0.7);
    if (!lastLine || Math.abs(lastLine[0].top - item.top) > tolerance) {
      lines.push([item]);
    } else {
      lastLine.push(item);
    }
  }

  return lines
    .map((line) => joinLineItems(line))
    .filter(Boolean)
    .join("\n");
}

function collectWordCandidates(textLayer: HTMLElement, layerRect: DOMRect): WordCandidate[] {
  const spanIds = new WeakMap<HTMLElement, number>();
  let nextSpanId = 0;
  const candidates: WordCandidate[] = [];

  for (const span of textLayer.querySelectorAll<HTMLElement>("span[role='presentation']")) {
    if (!spanIds.has(span)) {
      spanIds.set(span, nextSpanId++);
    }

    const spanId = spanIds.get(span) ?? 0;
    for (const item of getSelectableWordItems(span, layerRect)) {
      candidates.push({
        key: `${spanId}:${item.left}:${item.text}`,
        item
      });
    }
  }

  return candidates;
}

function getSelectableWordItems(span: HTMLElement, layerRect: DOMRect): TextSelectionItem[] {
  const text = span.textContent ?? "";
  if (!text.trim() || !span.firstChild) {
    return [];
  }

  const items: TextSelectionItem[] = [];
  const matcher = /\S+/g;
  for (const match of text.matchAll(matcher)) {
    const word = match[0];
    const start = match.index ?? 0;
    const end = start + word.length;
    const rect = measureTextNodeRange(span.firstChild, start, end)
      ?? estimateTextRangeRect(span, text, start, end);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    items.push(textItemFromRect(word, rect, layerRect));
  }

  return items;
}

function expandRectangleSelection(
  candidates: WordCandidate[],
  selected: Map<string, TextSelectionItem>,
  selectionBounds: SelectionBounds
): void {
  const paddedBounds: SelectionBounds = {
    left: selectionBounds.left - selectionSlopPx,
    top: selectionBounds.top - selectionSlopPx,
    right: selectionBounds.right + selectionSlopPx,
    bottom: selectionBounds.bottom + selectionSlopPx
  };

  for (const line of groupCandidatesByLine(candidates)) {
    const lineTouchesSelection = line.some((candidate) => {
      return selected.has(candidate.key) || spansSelectionBand(candidate.item, paddedBounds);
    });
    if (!lineTouchesSelection) {
      continue;
    }

    for (const candidate of line) {
      if (spansSelectionBand(candidate.item, paddedBounds)) {
        selected.set(candidate.key, candidate.item);
      }
    }
  }
}

function groupCandidatesByLine(candidates: WordCandidate[]): WordCandidate[][] {
  const lines: WordCandidate[][] = [];
  for (const candidate of [...candidates].sort((a, b) => compareTextItemsVisually(a.item, b.item))) {
    const lastLine = lines.at(-1);
    const tolerance = Math.max(4, candidate.item.height * 0.7);
    if (!lastLine || Math.abs(lastLine[0].item.top - candidate.item.top) > tolerance) {
      lines.push([candidate]);
    } else {
      lastLine.push(candidate);
    }
  }

  return lines;
}

function spansSelectionBand(item: TextSelectionItem, bounds: SelectionBounds): boolean {
  return boxesOverlap(itemToBounds(item), bounds);
}

function itemToBounds(item: TextSelectionItem): SelectionBounds {
  return {
    left: item.left,
    top: item.top,
    right: item.right,
    bottom: item.top + item.height
  };
}

function textItemFromRect(text: string, rect: DOMRect, layerRect: DOMRect): TextSelectionItem {
  return {
    text,
    top: rect.top - layerRect.top,
    left: rect.left - layerRect.left,
    right: rect.right - layerRect.left,
    height: rect.height
  };
}

function intersectsSelection(points: SelectionPoint[], item: TextSelectionItem): boolean {
  return polygonIntersectsBox(points, itemToBounds(item));
}

function joinLineItems(line: TextSelectionItem[]): string {
  const sortedLine = line.sort((a, b) => a.left - b.left);
  let result = "";
  let previous: TextSelectionItem | undefined;

  for (const item of sortedLine) {
    if (!previous) {
      result = item.text;
      previous = item;
      continue;
    }

    const gap = item.left - previous.right;
    const gapThreshold = Math.max(4, Math.min(item.height, previous.height) * 0.35);
    result += gap <= gapThreshold ? item.text : ` ${item.text}`;
    previous = item;
  }

  return result.replace(/\s+/g, " ").trim();
}

function drawMergedSelectionHighlights(textLayer: HTMLElement, items: TextSelectionItem[]): void {
  for (const rect of mergeSelectionHighlightRects(items)) {
    const highlight = document.createElement("div");
    highlight.className = "custom-selection-highlight";
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${Math.max(1, rect.right - rect.left)}px`;
    highlight.style.height = `${Math.max(1, rect.height)}px`;
    textLayer.append(highlight);
  }
}

function compareTextItemsVisually(a: TextSelectionItem, b: TextSelectionItem): number {
  const lineTolerance = Math.max(4, Math.min(a.height || 0, b.height || 0) * 0.7);
  if (Math.abs(a.top - b.top) > lineTolerance) {
    return a.top - b.top;
  }
  if (Math.abs(a.left - b.left) > 1) {
    return a.left - b.left;
  }
  return 0;
}
