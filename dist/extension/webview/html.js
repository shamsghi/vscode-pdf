"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebviewHtml = buildWebviewHtml;
const security_1 = require("./security");
function buildWebviewHtml(webview, uris, nonce) {
    const csp = (0, security_1.buildContentSecurityPolicy)(webview);
    return [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `<meta http-equiv="Content-Security-Policy" content="${(0, security_1.escapeAttribute)(csp)}">`,
        `<link rel="stylesheet" href="${(0, security_1.escapeAttribute)(uris.viewerStyleUri)}">`,
        "<title>PDF Viewer</title>",
        "</head>",
        "<body>",
        '<main id="app" class="app" data-pdf-module-uri="' + (0, security_1.escapeAttribute)(uris.pdfModuleUri) + '" data-pdf-worker-uri="' + (0, security_1.escapeAttribute)(uris.pdfWorkerUri) + '">',
        '<div class="toolbar" role="toolbar" aria-label="PDF controls"><div class="toolbar-content">',
        '<button id="prevPage" type="button" title="Previous page" aria-label="Previous page">‹</button>',
        '<label class="page-control"><span>Page</span><input id="pageNumber" type="number" min="1" value="1" inputmode="numeric" aria-label="Page number"><span id="pageCount">/ -</span></label>',
        '<button id="nextPage" type="button" title="Next page" aria-label="Next page">›</button>',
        '<span class="separator" aria-hidden="true"></span>',
        '<button id="zoomOut" type="button" title="Zoom out" aria-label="Zoom out">−</button>',
        '<span id="zoomLabel" class="zoom-label" aria-live="polite">100%</span>',
        '<button id="zoomIn" type="button" title="Zoom in" aria-label="Zoom in">+</button>',
        '<button id="fitPage" type="button" title="Fit page">Fit page</button>',
        '<button id="rotate" type="button" title="Rotate clockwise" aria-label="Rotate clockwise">↻</button>',
        '<span class="separator" aria-hidden="true"></span>',
        '<span class="selection-label">Selection:</span>',
        '<div class="selection-mode-control" role="group" aria-label="Selection mode">',
        '<button id="selectFreestyle" class="icon-button" type="button" title="Freestyle selection" aria-label="Freestyle selection" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg></button>',
        '<button id="selectRectangle" class="icon-button" type="button" title="Rectangle selection" aria-label="Rectangle selection" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" rx="1.5"/></svg></button>',
        "</div>",
        '<span class="separator" aria-hidden="true"></span>',
        '<label class="search-control"><span class="search-icon" title="Search" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg></span><input id="searchInput" type="search" autocomplete="off" spellcheck="false" aria-label="Search text"></label>',
        '<button id="searchPrev" type="button" title="Previous match" aria-label="Previous match">‹</button>',
        '<button id="searchNext" type="button" title="Next match" aria-label="Next match">›</button>',
        '<span id="searchStatus" class="status-text" aria-live="polite"></span>',
        "</div></div>",
        '<section id="status" class="status" aria-live="polite">Loading viewer…</section>',
        '<section id="pages" class="pages" aria-label="PDF pages"></section>',
        "</main>",
        `<script nonce="${(0, security_1.escapeAttribute)(nonce)}" type="module" src="${(0, security_1.escapeAttribute)(uris.viewerScriptUri)}"></script>`,
        "</body>",
        "</html>"
    ].join("");
}
//# sourceMappingURL=html.js.map