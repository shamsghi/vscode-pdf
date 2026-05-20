import * as vscode from "vscode";

export class PdfDocument implements vscode.CustomDocument {
  public constructor(public readonly uri: vscode.Uri) {}

  public dispose(): void {
    // The document is read directly from workspace.fs for each editor instance.
  }
}
