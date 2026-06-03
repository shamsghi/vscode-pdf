import { safeText } from "./shared/dom.js";
import { estimateTextRangeRect, measureTextNodeRange } from "./selection/text.js";

export type SearchMatch = {
  page: number;
  index: number;
  pageMatchIndex: number;
};

type SearchTextSegment = {
  span: HTMLElement;
  start: number;
  end: number;
};

export type SearchHandlers = {
  reset(): void;
  updateSearch(rawQuery: string): Promise<void>;
  moveMatch(delta: number): void;
  refreshHighlights(): void;
  drawPageHighlights(textLayer: HTMLElement, pageNumber: number): void;
};

type SearchDeps = {
  pages: HTMLElement;
  searchStatus: HTMLElement;
  getPageCount(): number;
  getPageText(pageNumber: number): Promise<string>;
  goToPage(page: number): void;
};

export function createSearchHandlers(deps: SearchDeps): SearchHandlers {
  let searchQuery = "";
  let searchGeneration = 0;
  let matches: SearchMatch[] = [];
  let activeMatch = -1;

  function setSearchStatus(message: string): void {
    deps.searchStatus.textContent = message;
  }

  function clearSearchHighlights(): void {
    deps.pages.querySelectorAll(".search-highlight").forEach((element) => element.remove());
  }

  function refreshHighlights(): void {
    for (const textLayer of deps.pages.querySelectorAll<HTMLElement>(".textLayer")) {
      const pageNumber = Number(textLayer.dataset.pageNumber);
      if (Number.isFinite(pageNumber)) {
        drawPageHighlights(textLayer, pageNumber);
      }
    }
  }

  function drawPageHighlights(textLayer: HTMLElement, pageNumber: number): void {
    textLayer.querySelectorAll(".search-highlight").forEach((element) => element.remove());
    if (!searchQuery) {
      return;
    }

    const active = activeMatch >= 0 ? matches[activeMatch] : undefined;
    const layerRect = textLayer.getBoundingClientRect();
    const searchable = getSearchableTextFromLayer(textLayer);
    let pageMatchIndex = 0;
    let index = searchable.text.toLocaleLowerCase().indexOf(searchQuery);
    while (index !== -1) {
      const isActive = active?.page === pageNumber && active.pageMatchIndex === pageMatchIndex;
      drawSearchMatch(textLayer, layerRect, searchable.segments, index, index + searchQuery.length, isActive);
      pageMatchIndex += 1;
      index = searchable.text.toLocaleLowerCase().indexOf(searchQuery, index + searchQuery.length);
    }
  }

  return {
    reset(): void {
      searchQuery = "";
      searchGeneration += 1;
      matches = [];
      activeMatch = -1;
      clearSearchHighlights();
      setSearchStatus("");
    },

    async updateSearch(rawQuery: string): Promise<void> {
      const query = safeText(rawQuery).trim().toLocaleLowerCase();
      const generation = ++searchGeneration;
      searchQuery = query;
      matches = [];
      activeMatch = -1;
      clearSearchHighlights();
      const pageCount = deps.getPageCount();
      if (!pageCount || !query) {
        setSearchStatus("");
        return;
      }

      setSearchStatus("Searching…");
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const text = await deps.getPageText(pageNumber);
        if (generation !== searchGeneration) {
          return;
        }
        let pageMatchIndex = 0;
        let index = text.indexOf(query);
        while (index !== -1) {
          matches.push({ page: pageNumber, index, pageMatchIndex });
          pageMatchIndex += 1;
          index = text.indexOf(query, index + query.length);
        }
      }

      if (matches.length === 0) {
        setSearchStatus("No matches");
        return;
      }
      activeMatch = 0;
      setSearchStatus(`1 of ${matches.length}`);
      refreshHighlights();
      deps.goToPage(matches[0].page);
    },

    moveMatch(delta: number): void {
      if (matches.length === 0) {
        return;
      }
      activeMatch = (activeMatch + delta + matches.length) % matches.length;
      setSearchStatus(`${activeMatch + 1} of ${matches.length}`);
      refreshHighlights();
      deps.goToPage(matches[activeMatch].page);
    },

    refreshHighlights,
    drawPageHighlights
  };
}

function getSearchableTextFromLayer(textLayer: HTMLElement): { text: string; segments: SearchTextSegment[] } {
  let text = "";
  const segments: SearchTextSegment[] = [];
  for (const span of textLayer.querySelectorAll<HTMLElement>("span[role='presentation']")) {
    const spanText = span.textContent ?? "";
    if (!spanText) {
      continue;
    }
    const start = text.length;
    text += spanText;
    segments.push({ span, start, end: text.length });
    text += " ";
  }
  return { text, segments };
}

function drawSearchMatch(
  textLayer: HTMLElement,
  layerRect: DOMRect,
  segments: SearchTextSegment[],
  start: number,
  end: number,
  isActive: boolean
): void {
  for (const segment of segments) {
    const overlapStart = Math.max(start, segment.start);
    const overlapEnd = Math.min(end, segment.end);
    if (overlapStart >= overlapEnd || !segment.span.firstChild) {
      continue;
    }

    const rect = measureTextNodeRange(
      segment.span.firstChild,
      overlapStart - segment.start,
      overlapEnd - segment.start
    ) ?? estimateTextRangeRect(segment.span, segment.span.textContent ?? "", overlapStart - segment.start, overlapEnd - segment.start);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    const highlight = document.createElement("div");
    highlight.className = isActive ? "search-highlight active" : "search-highlight";
    highlight.style.left = `${rect.left - layerRect.left}px`;
    highlight.style.top = `${rect.top - layerRect.top}px`;
    highlight.style.width = `${Math.max(1, rect.width)}px`;
    highlight.style.height = `${Math.max(1, rect.height)}px`;
    textLayer.append(highlight);
  }
}
