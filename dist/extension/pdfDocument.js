"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfDocument = void 0;
class PdfDocument {
    uri;
    constructor(uri) {
        this.uri = uri;
    }
    dispose() {
        // The document is read directly from workspace.fs for each editor instance.
    }
}
exports.PdfDocument = PdfDocument;
//# sourceMappingURL=pdfDocument.js.map