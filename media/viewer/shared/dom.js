export function requireElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing element: ${id}`);
    }
    return element;
}
export function safeText(value, fallback = "") {
    return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 1000) : fallback;
}
export function errorMessage(error) {
    const raw = error instanceof Error ? error.message : String(error);
    return safeText(raw, "Unable to display PDF.");
}
export function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function debounce(callback, delayMs) {
    let handle = 0;
    return () => {
        window.clearTimeout(handle);
        handle = window.setTimeout(callback, delayMs);
    };
}
//# sourceMappingURL=dom.js.map