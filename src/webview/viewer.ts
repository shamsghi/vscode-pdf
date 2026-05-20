import { pointDistance, type SelectionPoint } from "./selection/geometry.js";
import {
  applyTextSelection,
  estimateTextRangeRect,
  measureTextNodeRange,
  normalizeTextLayerSelectionOrder,
  selectedItemsToText,
  type TextSelectionItem
} from "./selection/text.js";
import { base64ToBytes, clamp, debounce, errorMessage, requireElement, safeText } from "./shared/dom.js";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): ViewerState | undefined;
  setState(state: ViewerState): void;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  TextLayer: new (options: { textContentSource: PdfTextContent; container: HTMLElement; viewport: PdfViewport }) => {
    render(): Promise<void>;
  };
  getDocument(options: { data: Uint8Array; useSystemFonts: boolean }): {
    promise: Promise<PdfDocumentProxy>;
    destroy(): Promise<void>;
  };
};

type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
};

type PdfPageProxy = {
  getViewport(options: { scale: number; rotation: number }): PdfViewport;
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): { promise: Promise<void> };
  getTextContent(): Promise<PdfTextContent>;
};

type PdfViewport = {
  width: number;
  height: number;
};

type PdfTextContent = {
  items: Array<{ str?: string }>;
};

type ExtensionMessage =
  | { type: "loadPdf"; requestId: number; fileName: string; dataBase64: string }
  | { type: "loadError"; requestId: number; fileName: string; message: string };

type TextSelectionMode = "freestyle" | "rectangle";

type SelectionDrag = {
  pageContent: HTMLElement;
  textLayer: HTMLElement;
  overlay: SVGSVGElement;
  outline: SVGPolylineElement;
  mode: TextSelectionMode;
  points: SelectionPoint[];
  pageNumber: number;
};

type SearchMatch = {
  page: number;
  index: number;
  pageMatchIndex: number;
};

type SearchTextSegment = {
  span: HTMLElement;
  start: number;
  end: number;
};

type ViewerState = {
  selectionMode?: TextSelectionMode;
};

const vscode = acquireVsCodeApi();
const app = requireElement<HTMLElement>("app");
const pages = requireElement<HTMLElement>("pages");
const statusElement = requireElement<HTMLElement>("status");
const prevPage = requireElement<HTMLButtonElement>("prevPage");
const nextPage = requireElement<HTMLButtonElement>("nextPage");
const pageNumberInput = requireElement<HTMLInputElement>("pageNumber");
const pageCount = requireElement<HTMLElement>("pageCount");
const zoomOut = requireElement<HTMLButtonElement>("zoomOut");
const zoomIn = requireElement<HTMLButtonElement>("zoomIn");
const zoomLabel = requireElement<HTMLElement>("zoomLabel");
const fitWidth = requireElement<HTMLButtonElement>("fitWidth");
const fitPage = requireElement<HTMLButtonElement>("fitPage");
const rotate = requireElement<HTMLButtonElement>("rotate");
const selectFreestyle = requireElement<HTMLButtonElement>("selectFreestyle");
const selectRectangle = requireElement<HTMLButtonElement>("selectRectangle");
const searchInput = requireElement<HTMLInputElement>("searchInput");
const searchPrev = requireElement<HTMLButtonElement>("searchPrev");
const searchNext = requireElement<HTMLButtonElement>("searchNext");
const searchStatus = requireElement<HTMLElement>("searchStatus");

const pdfModuleUri = app.dataset.pdfModuleUri;
const pdfWorkerUri = app.dataset.pdfWorkerUri;
const svgNamespace = "http://www.w3.org/2000/svg";
const minLassoPointDistance = 2;
const selectionModeStorageKey = "vscode-pdf.selectionMode";

let pdfjs: PdfJsModule | undefined;
let pdfDocument: PdfDocumentProxy | undefined;
let currentPage = 1;
let scale = 1;
let rotation = 0;
let fitMode: "custom" | "width" | "page" = "width";
let textCache = new Map<number, string>();
let searchQuery = "";
let searchGeneration = 0;
let matches: SearchMatch[] = [];
let activeMatch = -1;
let pageShells = new Map<number, HTMLElement>();
let renderedPages = new Set<number>();
let renderingPages = new Set<number>();
let pageObserver: IntersectionObserver | undefined;
let renderGeneration = 0;
let isProgrammaticScroll = false;
let selectionMode: TextSelectionMode = getInitialTextSelectionMode();
let selectionDrag: SelectionDrag | undefined;
let selectedTextItems: TextSelectionItem[] = [];

void initialize();

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (!isExtensionMessage(message)) {
    return;
  }

  if (message.type === "loadError") {
    showError(message.message);
    return;
  }

  void loadPdf(message.dataBase64, message.fileName);
});

prevPage.addEventListener("click", () => goToPage(currentPage - 1));
nextPage.addEventListener("click", () => goToPage(currentPage + 1));
pageNumberInput.addEventListener("change", () => goToPage(Number(pageNumberInput.value)));
zoomOut.addEventListener("click", () => setScale(scale / 1.2));
zoomIn.addEventListener("click", () => setScale(scale * 1.2));
fitWidth.addEventListener("click", () => setFitMode("width"));
fitPage.addEventListener("click", () => setFitMode("page"));
rotate.addEventListener("click", () => {
  rotation = (rotation + 90) % 360;
  void rerenderDocumentAtCurrentPage();
});
selectFreestyle.addEventListener("click", () => setTextSelectionMode("freestyle"));
selectRectangle.addEventListener("click", () => setTextSelectionMode("rectangle"));
searchInput.addEventListener("input", () => void updateSearch(searchInput.value));
searchPrev.addEventListener("click", () => moveMatch(-1));
searchNext.addEventListener("click", () => moveMatch(1));
pages.addEventListener("scroll", debounce(updateCurrentPageFromScroll, 80));
pages.addEventListener("pointerdown", beginTextSelection);
pages.addEventListener("pointermove", updateTextSelection);
pages.addEventListener("pointerup", finishTextSelection);
pages.addEventListener("pointercancel", finishTextSelection);
document.addEventListener("copy", copySelectedText);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearTextSelection();
  }
});
window.addEventListener("resize", debounce(() => {
  if (fitMode !== "custom") {
    void rerenderDocumentAtCurrentPage();
  }
}, 150));

updateTextSelectionModeControls();

async function initialize(): Promise<void> {
  try {
    if (!pdfModuleUri || !pdfWorkerUri) {
      throw new Error("Viewer assets are unavailable.");
    }

    pdfjs = await import(pdfModuleUri) as PdfJsModule;
    const workerResponse = await fetch(pdfWorkerUri);
    if (!workerResponse.ok) {
      throw new Error("Unable to load PDF worker.");
    }
    const workerSource = await workerResponse.text();
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    setStatus("Waiting for PDF…");
    vscode.postMessage({ type: "ready" });
  } catch (error) {
    showError(errorMessage(error));
  }
}

async function loadPdf(dataBase64: string, fileName: string): Promise<void> {
  try {
    if (!pdfjs) {
      throw new Error("PDF renderer is not ready.");
    }

    setStatus(`Loading ${safeText(fileName, "PDF")}…`);
    await pdfDocument?.destroy();
    textCache = new Map();
    searchQuery = "";
    searchGeneration += 1;
    matches = [];
    activeMatch = -1;
    pdfDocument = await pdfjs.getDocument({
      data: base64ToBytes(dataBase64),
      useSystemFonts: true
    }).promise;
    currentPage = 1;
    updatePageControls();
    await renderDocument();
    setStatus("");
  } catch (error) {
    showError(errorMessage(error));
  }
}

async function renderDocument(scrollToCurrent = false): Promise<void> {
  if (!pdfDocument) {
    return;
  }

  const generation = ++renderGeneration;
  pageObserver?.disconnect();
  pageShells = new Map();
  renderedPages = new Set();
  renderingPages = new Set();
  pages.replaceChildren();
  setStatus("Preparing pages…");

  pageObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const pageNumber = Number((entry.target as HTMLElement).dataset.pageNumber);
        if (Number.isFinite(pageNumber)) {
          void renderPage(pageNumber, generation);
        }
      }
    }
  }, {
    root: pages,
    rootMargin: "900px 0px"
  });

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const pageShell = document.createElement("article");
    pageShell.className = "page pending";
    pageShell.dataset.pageNumber = String(pageNumber);
    pageShell.setAttribute("aria-label", `Page ${pageNumber}`);
    const label = document.createElement("span");
    label.className = "page-loading";
    label.textContent = `Page ${pageNumber}`;
    pageShell.append(label);
    pages.append(pageShell);
    pageShells.set(pageNumber, pageShell);
    pageObserver.observe(pageShell);
  }

  setStatus("");
  updatePageControls();
  await renderPage(currentPage, generation);
  if (scrollToCurrent) {
    scrollToPage(currentPage);
  }
}

async function renderPage(pageNumber: number, generation: number): Promise<void> {
  if (!pdfDocument || !pdfjs || renderedPages.has(pageNumber) || renderingPages.has(pageNumber)) {
    return;
  }

  const renderer = pdfjs;
  renderingPages.add(pageNumber);
  try {
    const page = await pdfDocument.getPage(pageNumber);
    if (generation !== renderGeneration) {
      return;
    }
    const viewportAtOne = page.getViewport({ scale: 1, rotation });
    const effectiveScale = calculateScale(viewportAtOne);
    scale = effectiveScale;
    const viewport = page.getViewport({ scale: effectiveScale, rotation });
    const textContentPromise = page.getTextContent();
    const pixelRatio = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to render PDF page.");
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    await page.render({ canvasContext: context, viewport }).promise;
    const textContent = await textContentPromise;
    if (generation !== renderGeneration) {
      return;
    }

    const pageShell = pageShells.get(pageNumber);
    if (!pageShell) {
      return;
    }
    pageShell.classList.remove("pending");
    pageShell.style.width = `${Math.floor(viewport.width)}px`;
    pageShell.style.minHeight = `${Math.floor(viewport.height)}px`;
    const pageContent = document.createElement("div");
    pageContent.className = "page-content";
    pageContent.style.width = `${Math.floor(viewport.width)}px`;
    pageContent.style.height = `${Math.floor(viewport.height)}px`;
    pageContent.style.setProperty("--scale-factor", String(effectiveScale));
    pageContent.style.setProperty("--user-unit", "1");
    pageContent.style.setProperty("--total-scale-factor", String(effectiveScale));
    pageContent.style.setProperty("--scale-round-x", "1px");
    pageContent.style.setProperty("--scale-round-y", "1px");
    const textLayerContainer = document.createElement("div");
    textLayerContainer.className = "textLayer";
    pageContent.append(canvas, textLayerContainer);
    pageShell.replaceChildren();
    pageShell.append(pageContent);
    await new renderer.TextLayer({
      textContentSource: textContent,
      container: textLayerContainer,
      viewport
    }).render();
    normalizeTextLayerSelectionOrder(textLayerContainer);
    textLayerContainer.dataset.pageNumber = String(pageNumber);
    drawSearchHighlights(textLayerContainer, pageNumber);
    renderedPages.add(pageNumber);
    updatePageControls();
  } catch (error) {
    showError(errorMessage(error));
  } finally {
    renderingPages.delete(pageNumber);
  }
}

function calculateScale(viewport: PdfViewport): number {
  const chromePadding = 32;
  if (fitMode === "width") {
    return clamp((pages.clientWidth - chromePadding) / viewport.width, 0.2, 5);
  }
  if (fitMode === "page") {
    const availableHeight = window.innerHeight - pages.getBoundingClientRect().top - chromePadding;
    return clamp(Math.min((pages.clientWidth - chromePadding) / viewport.width, availableHeight / viewport.height), 0.2, 5);
  }
  return clamp(scale, 0.2, 5);
}

function setFitMode(mode: "width" | "page"): void {
  fitMode = mode;
  void rerenderDocumentAtCurrentPage();
}

function setScale(nextScale: number): void {
  fitMode = "custom";
  scale = clamp(nextScale, 0.2, 5);
  void rerenderDocumentAtCurrentPage();
}

function goToPage(page: number): void {
  if (!pdfDocument || !Number.isFinite(page)) {
    updatePageControls();
    return;
  }
  currentPage = Math.trunc(clamp(page, 1, pdfDocument.numPages));
  scrollToPage(currentPage);
  void renderPage(currentPage, renderGeneration);
  updatePageControls();
}

function scrollToPage(pageNumber: number): void {
  const pageShell = pageShells.get(pageNumber);
  if (!pageShell) {
    return;
  }
  isProgrammaticScroll = true;
  pageShell.scrollIntoView({ block: "start" });
  window.setTimeout(() => {
    isProgrammaticScroll = false;
    updateCurrentPageFromScroll();
  }, 120);
}

function rerenderDocumentAtCurrentPage(): void {
  void renderDocument(true);
}

function updateCurrentPageFromScroll(): void {
  if (isProgrammaticScroll || pageShells.size === 0) {
    return;
  }

  const pagesTop = pages.getBoundingClientRect().top;
  let closestPage = currentPage;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const [pageNumber, pageShell] of pageShells) {
    const distance = Math.abs(pageShell.getBoundingClientRect().top - pagesTop - 12);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPage = pageNumber;
    }
  }

  if (closestPage !== currentPage) {
    currentPage = closestPage;
    updatePageControls();
  }
}

function getInitialTextSelectionMode(): TextSelectionMode {
  const vscodeStateMode = vscode.getState()?.selectionMode;
  if (isTextSelectionMode(vscodeStateMode)) {
    return vscodeStateMode;
  }

  const storedMode = window.localStorage.getItem(selectionModeStorageKey);
  return isTextSelectionMode(storedMode) ? storedMode : "freestyle";
}

function setTextSelectionMode(mode: TextSelectionMode): void {
  selectionMode = mode;
  vscode.setState({ selectionMode });
  window.localStorage.setItem(selectionModeStorageKey, selectionMode);
  updateTextSelectionModeControls();
  clearTextSelection();
}

function updateTextSelectionModeControls(): void {
  selectFreestyle.setAttribute("aria-pressed", String(selectionMode === "freestyle"));
  selectRectangle.setAttribute("aria-pressed", String(selectionMode === "rectangle"));
}

function isTextSelectionMode(value: unknown): value is TextSelectionMode {
  return value === "freestyle" || value === "rectangle";
}

function beginTextSelection(event: PointerEvent): void {
  if (event.button !== 0) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const textLayer = target.closest<HTMLElement>(".textLayer");
  const pageContent = target.closest<HTMLElement>(".page-content");
  if (!textLayer || !pageContent) {
    clearTextSelection();
    return;
  }

  event.preventDefault();
  pages.setPointerCapture(event.pointerId);
  clearTextSelection();

  const contentRect = pageContent.getBoundingClientRect();
  const overlay = document.createElementNS(svgNamespace, "svg");
  overlay.classList.add("selection-lasso");
  overlay.classList.add(`selection-${selectionMode}`);
  overlay.setAttribute("width", `${contentRect.width}`);
  overlay.setAttribute("height", `${contentRect.height}`);
  overlay.setAttribute("viewBox", `0 0 ${contentRect.width} ${contentRect.height}`);
  const outline = document.createElementNS(svgNamespace, "polyline");
  outline.classList.add("selection-lasso-outline");
  overlay.append(outline);
  pageContent.append(overlay);

  selectionDrag = {
    pageContent,
    textLayer,
    overlay,
    outline,
    mode: selectionMode,
    points: [eventToSelectionPoint(event, contentRect)],
    pageNumber: Number(textLayer.dataset.pageNumber) || 0
  };

  updateTextSelection(event);
}

function updateTextSelection(event: PointerEvent): void {
  if (!selectionDrag) {
    return;
  }

  event.preventDefault();
  const contentRect = selectionDrag.pageContent.getBoundingClientRect();
  const point = eventToSelectionPoint(event, contentRect);
  if (selectionDrag.mode === "rectangle") {
    selectionDrag.points[1] = point;
  } else {
    const previousPoint = selectionDrag.points.at(-1);
    if (!previousPoint || pointDistance(previousPoint, point) >= minLassoPointDistance) {
      selectionDrag.points.push(point);
    }
  }

  renderSelectionOutline(selectionDrag);
  selectedTextItems = applyTextSelection(selectionDrag.textLayer, getSelectionPolygon(selectionDrag));
}

function finishTextSelection(event: PointerEvent): void {
  if (!selectionDrag) {
    return;
  }

  event.preventDefault();
  selectionDrag.overlay.remove();
  selectionDrag = undefined;
}

function eventToSelectionPoint(event: PointerEvent, contentRect: DOMRect): SelectionPoint {
  return {
    x: clamp(event.clientX - contentRect.left, 0, contentRect.width),
    y: clamp(event.clientY - contentRect.top, 0, contentRect.height)
  };
}

function renderSelectionOutline(drag: SelectionDrag): void {
  const points = getSelectionPolygon(drag);
  drag.outline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
}

function getSelectionPolygon(drag: SelectionDrag): SelectionPoint[] {
  if (drag.mode === "rectangle") {
    const start = drag.points[0];
    const end = drag.points[1] ?? start;
    return [
      start,
      { x: end.x, y: start.y },
      end,
      { x: start.x, y: end.y },
      start
    ];
  }

  if (drag.points.length < 3) {
    return drag.points;
  }

  return [...drag.points, drag.points[0]];
}

function copySelectedText(event: ClipboardEvent): void {
  if (selectedTextItems.length === 0 || !event.clipboardData) {
    return;
  }

  event.preventDefault();
  event.clipboardData.setData("text/plain", selectedItemsToText(selectedTextItems));
}

function clearTextSelection(): void {
  selectionDrag?.overlay.remove();
  selectionDrag = undefined;
  pages.querySelectorAll(".custom-selection-highlight").forEach((element) => element.remove());
  selectedTextItems = [];
  window.getSelection()?.removeAllRanges();
}

async function updateSearch(rawQuery: string): Promise<void> {
  const query = safeText(rawQuery).trim().toLocaleLowerCase();
  const generation = ++searchGeneration;
  searchQuery = query;
  matches = [];
  activeMatch = -1;
  clearSearchHighlights();
  if (!pdfDocument || !query) {
    searchStatus.textContent = "";
    return;
  }

  setSearchStatus("Searching…");
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const text = await getPageText(pageNumber);
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
  refreshSearchHighlights();
  goToPage(matches[0].page);
}

async function getPageText(pageNumber: number): Promise<string> {
  const cached = textCache.get(pageNumber);
  if (cached !== undefined) {
    return cached;
  }
  if (!pdfDocument) {
    return "";
  }
  const page = await pdfDocument.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str ?? "").join(" ").toLocaleLowerCase();
  textCache.set(pageNumber, text);
  return text;
}

function moveMatch(delta: number): void {
  if (matches.length === 0) {
    return;
  }
  activeMatch = (activeMatch + delta + matches.length) % matches.length;
  setSearchStatus(`${activeMatch + 1} of ${matches.length}`);
  refreshSearchHighlights();
  goToPage(matches[activeMatch].page);
}

function refreshSearchHighlights(): void {
  for (const textLayer of pages.querySelectorAll<HTMLElement>(".textLayer")) {
    const pageNumber = Number(textLayer.dataset.pageNumber);
    if (Number.isFinite(pageNumber)) {
      drawSearchHighlights(textLayer, pageNumber);
    }
  }
}

function clearSearchHighlights(): void {
  pages.querySelectorAll(".search-highlight").forEach((element) => element.remove());
}

function drawSearchHighlights(textLayer: HTMLElement, pageNumber: number): void {
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

function updatePageControls(): void {
  const total = pdfDocument?.numPages ?? 0;
  pageNumberInput.max = String(Math.max(total, 1));
  pageNumberInput.value = String(currentPage);
  pageCount.textContent = `/ ${total || "-"}`;
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  prevPage.disabled = !pdfDocument || currentPage <= 1;
  nextPage.disabled = !pdfDocument || currentPage >= total;
}

function setStatus(message: string): void {
  statusElement.textContent = message;
  statusElement.hidden = message.length === 0;
}

function setSearchStatus(message: string): void {
  searchStatus.textContent = message;
}

function showError(message: string): void {
  setStatus(message);
  statusElement.classList.add("error");
  vscode.postMessage({ type: "viewerError", message });
}

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "loadPdf") {
    return typeof candidate.requestId === "number" && typeof candidate.fileName === "string" && typeof candidate.dataBase64 === "string";
  }
  return candidate.type === "loadError" && typeof candidate.requestId === "number" && typeof candidate.fileName === "string" && typeof candidate.message === "string";
}
