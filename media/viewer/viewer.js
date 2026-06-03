import { createSelectionInteraction } from "./selection/interaction.js";
import { createSearchHandlers } from "./search.js";
import { base64ToBytes, clamp, debounce, errorMessage, requireElement, safeText } from "./shared/dom.js";
const vscode = acquireVsCodeApi();
const app = requireElement("app");
const pages = requireElement("pages");
const statusElement = requireElement("status");
const prevPage = requireElement("prevPage");
const nextPage = requireElement("nextPage");
const pageNumberInput = requireElement("pageNumber");
const pageCount = requireElement("pageCount");
const zoomOut = requireElement("zoomOut");
const zoomIn = requireElement("zoomIn");
const zoomLabel = requireElement("zoomLabel");
const fitPage = requireElement("fitPage");
const rotate = requireElement("rotate");
const selectFreestyle = requireElement("selectFreestyle");
const selectRectangle = requireElement("selectRectangle");
const searchInput = requireElement("searchInput");
const searchPrev = requireElement("searchPrev");
const searchNext = requireElement("searchNext");
const searchStatus = requireElement("searchStatus");
const pdfModuleUri = app.dataset.pdfModuleUri;
const pdfWorkerUri = app.dataset.pdfWorkerUri;
const selectionModeStorageKey = "vscode-pdf.selectionMode";
let pdfjs;
let pdfDocument;
let currentPage = 1;
let scale = 1;
let rotation = 0;
let fitMode = "width";
let textCache = new Map();
let pageShells = new Map();
let renderedPages = new Set();
let renderingPages = new Set();
let pageObserver;
let renderGeneration = 0;
let isProgrammaticScroll = false;
let selectionMode = getInitialTextSelectionMode();
const selection = createSelectionInteraction(pages, () => selectionMode);
const search = createSearchHandlers({
    pages,
    searchStatus,
    getPageCount: () => pdfDocument?.numPages ?? 0,
    getPageText,
    goToPage
});
void initialize();
window.addEventListener("message", (event) => {
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
fitPage.addEventListener("click", () => setFitMode("page"));
rotate.addEventListener("click", () => {
    rotation = (rotation + 90) % 360;
    void rerenderDocumentAtCurrentPage();
});
selectFreestyle.addEventListener("click", () => setTextSelectionMode("freestyle"));
selectRectangle.addEventListener("click", () => setTextSelectionMode("rectangle"));
searchInput.addEventListener("input", () => void search.updateSearch(searchInput.value));
searchPrev.addEventListener("click", () => search.moveMatch(-1));
searchNext.addEventListener("click", () => search.moveMatch(1));
pages.addEventListener("scroll", debounce(updateCurrentPageFromScroll, 80));
pages.addEventListener("pointerdown", (event) => selection.begin(event));
pages.addEventListener("pointermove", (event) => selection.update(event));
pages.addEventListener("pointerup", (event) => selection.finish(event));
pages.addEventListener("pointercancel", (event) => selection.finish(event));
document.addEventListener("copy", (event) => selection.copy(event));
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        selection.clear();
    }
});
window.addEventListener("resize", debounce(() => {
    if (fitMode !== "custom") {
        void rerenderDocumentAtCurrentPage();
    }
}, 150));
document.addEventListener("focusin", keepDocumentPinned, true);
updateTextSelectionModeControls();
async function initialize() {
    try {
        if (!pdfModuleUri || !pdfWorkerUri) {
            throw new Error("Viewer assets are unavailable.");
        }
        pdfjs = await import(pdfModuleUri);
        const workerResponse = await fetch(pdfWorkerUri);
        if (!workerResponse.ok) {
            throw new Error("Unable to load PDF worker.");
        }
        const workerSource = await workerResponse.text();
        pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
        setStatus("Waiting for PDF…");
        vscode.postMessage({ type: "ready" });
    }
    catch (error) {
        showError(errorMessage(error));
    }
}
async function loadPdf(dataBase64, fileName) {
    try {
        if (!pdfjs) {
            throw new Error("PDF renderer is not ready.");
        }
        setStatus(`Loading ${safeText(fileName, "PDF")}…`);
        await pdfDocument?.destroy();
        textCache = new Map();
        search.reset();
        pdfDocument = await pdfjs.getDocument({
            data: base64ToBytes(dataBase64),
            useSystemFonts: true
        }).promise;
        currentPage = 1;
        updatePageControls();
        await renderDocument();
        setStatus("");
    }
    catch (error) {
        showError(errorMessage(error));
    }
}
async function renderDocument(scrollToCurrent = false) {
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
                const pageNumber = Number(entry.target.dataset.pageNumber);
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
async function renderPage(pageNumber, generation) {
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
        const pageWidth = Math.floor(viewport.width);
        const pageHeight = Math.floor(viewport.height);
        const pageContent = document.createElement("div");
        pageContent.className = "page-content";
        pageContent.style.width = `${pageWidth}px`;
        pageContent.style.height = `${pageHeight}px`;
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
        textLayerContainer.dataset.pageNumber = String(pageNumber);
        syncPageContentScale(pageShell, pageContent, pageWidth, pageHeight);
        search.drawPageHighlights(textLayerContainer, pageNumber);
        renderedPages.add(pageNumber);
        updatePageControls();
    }
    catch (error) {
        showError(errorMessage(error));
    }
    finally {
        renderingPages.delete(pageNumber);
    }
}
function calculateScale(viewport) {
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
function getHorizontalPadding(element) {
    const style = getComputedStyle(element);
    return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
}
function syncPageContentScale(pageShell, pageContent, viewportWidth, viewportHeight) {
    const pagesElement = pageShell.parentElement;
    const availableWidth = pagesElement
        ? pagesElement.clientWidth - getHorizontalPadding(pagesElement)
        : viewportWidth;
    pageContent.style.transform = "";
    pageContent.style.transformOrigin = "top left";
    if (viewportWidth > availableWidth && availableWidth > 0) {
        const fitScale = availableWidth / viewportWidth;
        pageContent.style.transform = `scale(${fitScale})`;
        pageShell.style.width = `${Math.ceil(viewportWidth * fitScale)}px`;
        pageShell.style.minHeight = `${Math.ceil(viewportHeight * fitScale)}px`;
        return;
    }
    pageShell.style.width = `${viewportWidth}px`;
    pageShell.style.minHeight = `${viewportHeight}px`;
}
function setFitMode(mode) {
    fitMode = mode;
    void rerenderDocumentAtCurrentPage();
}
function setScale(nextScale) {
    fitMode = "custom";
    scale = clamp(nextScale, 0.2, 5);
    void rerenderDocumentAtCurrentPage();
}
function goToPage(page) {
    if (!pdfDocument || !Number.isFinite(page)) {
        updatePageControls();
        return;
    }
    currentPage = Math.trunc(clamp(page, 1, pdfDocument.numPages));
    scrollToPage(currentPage);
    void renderPage(currentPage, renderGeneration);
    updatePageControls();
}
function scrollToPage(pageNumber) {
    const pageShell = pageShells.get(pageNumber);
    if (!pageShell) {
        return;
    }
    isProgrammaticScroll = true;
    const pagesRect = pages.getBoundingClientRect();
    const pageRect = pageShell.getBoundingClientRect();
    pages.scrollTo({
        top: pages.scrollTop + pageRect.top - pagesRect.top - 16,
        behavior: "auto"
    });
    window.setTimeout(() => {
        isProgrammaticScroll = false;
        updateCurrentPageFromScroll();
    }, 120);
}
function keepDocumentPinned() {
    if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}
function rerenderDocumentAtCurrentPage() {
    void renderDocument(true);
}
function updateCurrentPageFromScroll() {
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
function getInitialTextSelectionMode() {
    const vscodeStateMode = vscode.getState()?.selectionMode;
    if (isTextSelectionMode(vscodeStateMode)) {
        return vscodeStateMode;
    }
    const storedMode = window.localStorage.getItem(selectionModeStorageKey);
    return isTextSelectionMode(storedMode) ? storedMode : "rectangle";
}
function setTextSelectionMode(mode) {
    selectionMode = mode;
    vscode.setState({ selectionMode });
    window.localStorage.setItem(selectionModeStorageKey, selectionMode);
    updateTextSelectionModeControls();
    selection.clear();
}
function updateTextSelectionModeControls() {
    selectFreestyle.setAttribute("aria-pressed", String(selectionMode === "freestyle"));
    selectRectangle.setAttribute("aria-pressed", String(selectionMode === "rectangle"));
}
function isTextSelectionMode(value) {
    return value === "freestyle" || value === "rectangle";
}
async function getPageText(pageNumber) {
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
function updatePageControls() {
    const total = pdfDocument?.numPages ?? 0;
    pageNumberInput.max = String(Math.max(total, 1));
    pageNumberInput.value = String(currentPage);
    pageCount.textContent = `/ ${total || "-"}`;
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    prevPage.disabled = !pdfDocument || currentPage <= 1;
    nextPage.disabled = !pdfDocument || currentPage >= total;
}
function setStatus(message) {
    statusElement.textContent = message;
    statusElement.hidden = message.length === 0;
}
function showError(message) {
    setStatus(message);
    statusElement.classList.add("error");
    vscode.postMessage({ type: "viewerError", message });
}
function isExtensionMessage(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    if (candidate.type === "loadPdf") {
        return typeof candidate.requestId === "number" && typeof candidate.fileName === "string" && typeof candidate.dataBase64 === "string";
    }
    return candidate.type === "loadError" && typeof candidate.requestId === "number" && typeof candidate.fileName === "string" && typeof candidate.message === "string";
}
//# sourceMappingURL=viewer.js.map