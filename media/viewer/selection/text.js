import { polygonIntersectsBox } from "./geometry.js";
export function normalizeTextLayerSelectionOrder(container) {
    const textSpans = Array.from(container.querySelectorAll("span[role='presentation']"));
    if (textSpans.length < 2) {
        return;
    }
    const containerRect = container.getBoundingClientRect();
    const orderedSpans = textSpans
        .map((span, originalIndex) => {
        const rect = span.getBoundingClientRect();
        return {
            span,
            originalIndex,
            top: rect.top - containerRect.top,
            left: rect.left - containerRect.left,
            height: rect.height
        };
    })
        .sort((a, b) => {
        const lineTolerance = Math.max(3, Math.min(a.height || 0, b.height || 0) * 0.45);
        if (Math.abs(a.top - b.top) > lineTolerance) {
            return a.top - b.top;
        }
        if (Math.abs(a.left - b.left) > 1) {
            return a.left - b.left;
        }
        return a.originalIndex - b.originalIndex;
    });
    const fragment = document.createDocumentFragment();
    let previousTop;
    for (const item of orderedSpans) {
        if (previousTop !== undefined && Math.abs(item.top - previousTop) > Math.max(4, item.height * 0.6)) {
            const lineBreak = document.createElement("br");
            lineBreak.setAttribute("role", "presentation");
            fragment.append(lineBreak);
        }
        fragment.append(item.span);
        previousTop = item.top;
    }
    const endOfContent = container.querySelector(".endOfContent");
    container.replaceChildren(fragment);
    if (endOfContent) {
        container.append(endOfContent);
    }
}
export function applyTextSelection(textLayer, points) {
    const layerRect = textLayer.getBoundingClientRect();
    textLayer.querySelectorAll(".custom-selection-highlight").forEach((element) => element.remove());
    const selectedTextItems = [];
    if (points.length < 3) {
        return selectedTextItems;
    }
    for (const span of Array.from(textLayer.querySelectorAll("span[role='presentation']"))) {
        for (const item of getSelectableWordItems(span, layerRect)) {
            if (polygonIntersectsBox(points, {
                left: item.left,
                top: item.top,
                right: item.right,
                bottom: item.top + item.height
            })) {
                selectedTextItems.push(item);
                drawSelectionHighlight(textLayer, item);
            }
        }
    }
    return selectedTextItems.sort(compareTextItemsVisually);
}
export function measureTextNodeRange(node, start, end) {
    if (node.nodeType !== Node.TEXT_NODE) {
        return undefined;
    }
    const range = document.createRange();
    try {
        range.setStart(node, start);
        range.setEnd(node, end);
        const rect = range.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 ? rect : undefined;
    }
    finally {
        range.detach();
    }
}
export function estimateTextRangeRect(span, text, start, end) {
    const rect = span.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || text.length === 0) {
        return undefined;
    }
    const left = rect.left + rect.width * (start / text.length);
    const right = rect.left + rect.width * (end / text.length);
    return new DOMRect(left, rect.top, right - left, rect.height);
}
export function selectedItemsToText(items) {
    const lines = [];
    for (const item of items) {
        const lastLine = lines.at(-1);
        const tolerance = Math.max(4, item.height * 0.7);
        if (!lastLine || Math.abs(lastLine[0].top - item.top) > tolerance) {
            lines.push([item]);
        }
        else {
            lastLine.push(item);
        }
    }
    return lines
        .map((line) => line
        .sort((a, b) => a.left - b.left)
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim())
        .filter(Boolean)
        .join("\n");
}
function getSelectableWordItems(span, layerRect) {
    const text = span.textContent ?? "";
    if (!text.trim() || !span.firstChild) {
        return [];
    }
    const items = [];
    const matcher = /\S+/g;
    for (const match of text.matchAll(matcher)) {
        const word = match[0];
        const start = match.index ?? 0;
        const end = start + word.length;
        const rect = measureTextNodeRange(span.firstChild, start, end) ?? estimateTextRangeRect(span, text, start, end);
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            continue;
        }
        items.push({
            text: word,
            top: rect.top - layerRect.top,
            left: rect.left - layerRect.left,
            right: rect.right - layerRect.left,
            height: rect.height
        });
    }
    return items;
}
function drawSelectionHighlight(textLayer, item) {
    const highlight = document.createElement("div");
    highlight.className = "custom-selection-highlight";
    highlight.style.left = `${item.left}px`;
    highlight.style.top = `${item.top}px`;
    highlight.style.width = `${Math.max(1, item.right - item.left)}px`;
    highlight.style.height = `${Math.max(1, item.height)}px`;
    textLayer.append(highlight);
}
function compareTextItemsVisually(a, b) {
    const lineTolerance = Math.max(4, Math.min(a.height || 0, b.height || 0) * 0.7);
    if (Math.abs(a.top - b.top) > lineTolerance) {
        return a.top - b.top;
    }
    if (Math.abs(a.left - b.left) > 1) {
        return a.left - b.left;
    }
    return 0;
}
//# sourceMappingURL=text.js.map