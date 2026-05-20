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
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const constants_1 = require("./constants");
const security_1 = require("./security");
class PdfDocument {
    uri;
    constructor(uri) {
        this.uri = uri;
    }
    dispose() {
        // The document is read directly from workspace.fs for each editor instance.
    }
}
class PdfReadonlyEditorProvider {
    extensionUri;
    static viewType = constants_1.VIEW_TYPE;
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    openCustomDocument(uri) {
        return new PdfDocument(uri);
    }
    async resolveCustomEditor(document, panel) {
        const webview = panel.webview;
        const mediaRoot = vscode.Uri.joinPath(this.extensionUri, "media");
        const requestId = Date.now();
        let didPostPdf = false;
        const postPdfOnce = async () => {
            if (didPostPdf) {
                return;
            }
            didPostPdf = true;
            await this.postPdfBytes(document, webview, requestId);
        };
        webview.options = {
            enableScripts: true,
            localResourceRoots: [mediaRoot]
        };
        const disposables = [];
        panel.onDidDispose(() => vscode.Disposable.from(...disposables).dispose());
        disposables.push(webview.onDidReceiveMessage((message) => {
            if (!(0, security_1.isWebviewToExtensionMessage)(message)) {
                return;
            }
            if (message.type === "ready") {
                void postPdfOnce();
                return;
            }
            if (message.type === "viewerError") {
                console.warn(`PDF viewer error: ${(0, security_1.sanitizeUiText)(message.message, "Unknown viewer error")}`);
            }
        }));
        webview.html = (0, security_1.buildWebviewHtml)(webview, {
            viewerScriptUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "viewer", "viewer.js")).toString(),
            viewerStyleUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "viewer", "viewer.css")).toString(),
            pdfModuleUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "vendor", "pdf.mjs")).toString(),
            pdfWorkerUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "vendor", "pdf.worker.mjs")).toString()
        }, (0, security_1.createNonce)());
    }
    async postPdfBytes(document, webview, requestId) {
        const fileName = (0, security_1.sanitizeUiText)(path.basename(document.uri.fsPath), "PDF");
        try {
            const bytes = await vscode.workspace.fs.readFile(document.uri);
            const message = {
                type: "loadPdf",
                requestId,
                fileName,
                dataBase64: Buffer.from(bytes).toString("base64")
            };
            await webview.postMessage(message);
        }
        catch (error) {
            const message = {
                type: "loadError",
                requestId,
                fileName,
                message: (0, security_1.sanitizeUiText)(error instanceof Error ? error.message : String(error), "Unable to read PDF")
            };
            await webview.postMessage(message);
        }
    }
}
function activate(context) {
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(constants_1.VIEW_TYPE, new PdfReadonlyEditorProvider(context.extensionUri), {
        supportsMultipleEditorsPerDocument: true,
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map