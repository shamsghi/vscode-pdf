import * as vscode from "vscode";
import { VIEW_TYPE } from "./extension/constants";
import { PdfReadonlyEditorProvider } from "./extension/pdfReadonlyEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new PdfReadonlyEditorProvider(context.extensionUri), {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );
}

export function deactivate(): void {}
