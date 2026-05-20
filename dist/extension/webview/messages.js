"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWebviewToExtensionMessage = isWebviewToExtensionMessage;
function isWebviewToExtensionMessage(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    if (candidate.type === "ready") {
        return true;
    }
    return candidate.type === "viewerError" && typeof candidate.message === "string";
}
//# sourceMappingURL=messages.js.map