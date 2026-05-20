import * as path from "node:path";
import * as vscode from "vscode";
import { VIEW_TYPE } from "./constants";
import { PdfDocument } from "./pdfDocument";
import { buildWebviewHtml } from "./webview/html";
import { isWebviewToExtensionMessage, type ExtensionToWebviewMessage } from "./webview/messages";
import { createNonce, sanitizeUiText } from "./webview/security";

export class PdfReadonlyEditorProvider implements vscode.CustomReadonlyEditorProvider<PdfDocument> {
  public static readonly viewType = VIEW_TYPE;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public openCustomDocument(uri: vscode.Uri): PdfDocument {
    return new PdfDocument(uri);
  }

  public async resolveCustomEditor(document: PdfDocument, panel: vscode.WebviewPanel): Promise<void> {
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

    const disposables: vscode.Disposable[] = [];
    panel.onDidDispose(() => vscode.Disposable.from(...disposables).dispose());

    disposables.push(
      webview.onDidReceiveMessage((message: unknown) => {
        if (!isWebviewToExtensionMessage(message)) {
          return;
        }

        if (message.type === "ready") {
          void postPdfOnce();
          return;
        }

        if (message.type === "viewerError") {
          console.warn(`PDF viewer error: ${sanitizeUiText(message.message, "Unknown viewer error")}`);
        }
      })
    );

    webview.html = buildWebviewHtml(
      webview,
      {
        viewerScriptUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "viewer", "viewer.js")).toString(),
        viewerStyleUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "viewer", "viewer.css")).toString(),
        pdfModuleUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "vendor", "pdf.mjs")).toString(),
        pdfWorkerUri: webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "vendor", "pdf.worker.mjs")).toString()
      },
      createNonce()
    );
  }

  private async postPdfBytes(document: PdfDocument, webview: vscode.Webview, requestId: number): Promise<void> {
    const fileName = sanitizeUiText(path.basename(document.uri.fsPath), "PDF");

    try {
      const bytes = await vscode.workspace.fs.readFile(document.uri);
      const message: ExtensionToWebviewMessage = {
        type: "loadPdf",
        requestId,
        fileName,
        dataBase64: Buffer.from(bytes).toString("base64")
      };
      await webview.postMessage(message);
    } catch (error) {
      const message: ExtensionToWebviewMessage = {
        type: "loadError",
        requestId,
        fileName,
        message: sanitizeUiText(error instanceof Error ? error.message : String(error), "Unable to read PDF")
      };
      await webview.postMessage(message);
    }
  }
}
