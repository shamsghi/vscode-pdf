"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNonce = createNonce;
exports.sanitizeUiText = sanitizeUiText;
exports.isWebviewToExtensionMessage = isWebviewToExtensionMessage;
exports.buildContentSecurityPolicy = buildContentSecurityPolicy;
exports.buildWebviewHtml = buildWebviewHtml;
const crypto = __importStar(require("node:crypto"));
function createNonce() {
    return crypto.randomBytes(16).toString("base64url");
}
function sanitizeUiText(value, fallback = "") {
    if (typeof value !== "string") {
        return fallback;
    }
    return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 1000);
}
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
function buildContentSecurityPolicy(webview) {
    const source = webview.cspSource;
    return [
        "default-src 'none'",
        `img-src ${source} data:`,
        `font-src ${source}`,
        `style-src ${source}`,
        `script-src ${source}`,
        `connect-src ${source}`,
        "worker-src blob:",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'"
    ].join("; ");
}
function buildWebviewHtml(webview, uris, nonce) {
    const csp = buildContentSecurityPolicy(webview);
    return [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">`,
        `<link rel="stylesheet" href="${escapeAttribute(uris.viewerStyleUri)}">`,
        "<title>PDF Viewer</title>",
        "</head>",
        "<body>",
        '<main id="app" class="app" data-pdf-module-uri="' + escapeAttribute(uris.pdfModuleUri) + '" data-pdf-worker-uri="' + escapeAttribute(uris.pdfWorkerUri) + '">',
        '<div class="toolbar" role="toolbar" aria-label="PDF controls">',
        '<button id="prevPage" type="button" title="Previous page" aria-label="Previous page">‹</button>',
        '<label class="page-control"><span>Page</span><input id="pageNumber" type="number" min="1" value="1" inputmode="numeric" aria-label="Page number"><span id="pageCount">/ -</span></label>',
        '<button id="nextPage" type="button" title="Next page" aria-label="Next page">›</button>',
        '<span class="separator" aria-hidden="true"></span>',
        '<button id="zoomOut" type="button" title="Zoom out" aria-label="Zoom out">−</button>',
        '<span id="zoomLabel" class="zoom-label" aria-live="polite">100%</span>',
        '<button id="zoomIn" type="button" title="Zoom in" aria-label="Zoom in">+</button>',
        '<button id="fitWidth" type="button" title="Fit width">Fit width</button>',
        '<button id="fitPage" type="button" title="Fit page">Fit page</button>',
        '<button id="rotate" type="button" title="Rotate clockwise" aria-label="Rotate clockwise">↻</button>',
        '<span class="separator" aria-hidden="true"></span>',
        '<label class="search-control"><span>Search</span><input id="searchInput" type="search" autocomplete="off" spellcheck="false" aria-label="Search text"></label>',
        '<button id="searchPrev" type="button" title="Previous match" aria-label="Previous match">‹</button>',
        '<button id="searchNext" type="button" title="Next match" aria-label="Next match">›</button>',
        '<span id="searchStatus" class="status-text" aria-live="polite"></span>',
        "</div>",
        '<section id="status" class="status" aria-live="polite">Loading viewer…</section>',
        '<section id="pages" class="pages" aria-label="PDF pages"></section>',
        "</main>",
        `<script nonce="${escapeAttribute(nonce)}" type="module" src="${escapeAttribute(uris.viewerScriptUri)}"></script>`,
        "</body>",
        "</html>"
    ].join("");
}
function escapeAttribute(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
//# sourceMappingURL=security.js.map