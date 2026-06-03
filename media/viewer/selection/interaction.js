import { pointDistance } from "./geometry.js";
import { applyTextSelection, selectedItemsToText } from "./text.js";
import { clamp } from "../shared/dom.js";
const svgNamespace = "http://www.w3.org/2000/svg";
const minLassoPointDistance = 2;
export function createSelectionInteraction(pages, getSelectionMode) {
    let selectionDrag;
    let selectionFrame;
    let selectedTextItems = [];
    return {
        getSelectedItems() {
            return selectedTextItems;
        },
        begin(event) {
            if (event.button !== 0) {
                return;
            }
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            const textLayer = target.closest(".textLayer");
            const pageContent = target.closest(".page-content");
            if (!textLayer || !pageContent) {
                clearSelection();
                return;
            }
            event.preventDefault();
            pages.setPointerCapture(event.pointerId);
            clearSelection();
            const layerRect = textLayer.getBoundingClientRect();
            const overlay = document.createElementNS(svgNamespace, "svg");
            overlay.classList.add("selection-lasso");
            overlay.classList.add(`selection-${getSelectionMode()}`);
            overlay.setAttribute("width", `${layerRect.width}`);
            overlay.setAttribute("height", `${layerRect.height}`);
            overlay.setAttribute("viewBox", `0 0 ${layerRect.width} ${layerRect.height}`);
            const outline = document.createElementNS(svgNamespace, "polygon");
            outline.classList.add("selection-lasso-outline");
            overlay.append(outline);
            textLayer.append(overlay);
            selectionDrag = {
                pageContent,
                textLayer,
                overlay,
                outline,
                mode: getSelectionMode(),
                points: [eventToSelectionPoint(event, layerRect)],
                pageNumber: Number(textLayer.dataset.pageNumber) || 0
            };
            updateSelection(event);
        },
        update(event) {
            updateSelection(event);
        },
        finish(event) {
            if (!selectionDrag) {
                return;
            }
            event.preventDefault();
            const polygon = getSelectionPolygon(selectionDrag);
            if (selectedTextItems.length > 0 && polygon.length >= 3) {
                removeSelectionFrame();
                renderSelectionOutline(selectionDrag, polygon);
                selectionDrag.overlay.classList.add("selection-lasso--committed");
                selectionFrame = {
                    pageContent: selectionDrag.pageContent,
                    overlay: selectionDrag.overlay
                };
            }
            else {
                selectionDrag.overlay.remove();
            }
            selectionDrag = undefined;
        },
        clear() {
            clearSelection();
        },
        copy(event) {
            if (selectedTextItems.length === 0 || !event.clipboardData) {
                return;
            }
            event.preventDefault();
            event.clipboardData.setData("text/plain", selectedItemsToText(selectedTextItems));
        }
    };
    function updateSelection(event) {
        if (!selectionDrag) {
            return;
        }
        event.preventDefault();
        const layerRect = selectionDrag.textLayer.getBoundingClientRect();
        const point = eventToSelectionPoint(event, layerRect);
        if (selectionDrag.mode === "rectangle") {
            selectionDrag.points[1] = point;
        }
        else {
            const previousPoint = selectionDrag.points.at(-1);
            if (!previousPoint || pointDistance(previousPoint, point) >= minLassoPointDistance) {
                selectionDrag.points.push(point);
            }
        }
        renderSelectionOutline(selectionDrag);
        selectedTextItems = applyTextSelection(selectionDrag.textLayer, getSelectionPolygon(selectionDrag), selectionDrag.mode);
    }
    function clearSelection() {
        selectionDrag?.overlay.remove();
        selectionDrag = undefined;
        removeSelectionFrame();
        pages.querySelectorAll(".custom-selection-highlight").forEach((element) => element.remove());
        selectedTextItems = [];
        window.getSelection()?.removeAllRanges();
    }
    function removeSelectionFrame() {
        selectionFrame?.overlay.remove();
        selectionFrame = undefined;
    }
}
function eventToSelectionPoint(event, contentRect) {
    return {
        x: clamp(event.clientX - contentRect.left, 0, contentRect.width),
        y: clamp(event.clientY - contentRect.top, 0, contentRect.height)
    };
}
function renderSelectionOutline(drag, points = getSelectionPolygon(drag)) {
    drag.outline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
}
function getSelectionPolygon(drag) {
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
//# sourceMappingURL=interaction.js.map