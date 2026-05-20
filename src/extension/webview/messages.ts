export interface LoadPdfMessage {
  type: "loadPdf";
  requestId: number;
  fileName: string;
  dataBase64: string;
}

export interface LoadErrorMessage {
  type: "loadError";
  requestId: number;
  fileName: string;
  message: string;
}

export type ExtensionToWebviewMessage = LoadPdfMessage | LoadErrorMessage;

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "viewerError"; message: string };

export function isWebviewToExtensionMessage(value: unknown): value is WebviewToExtensionMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.type === "ready") {
    return true;
  }

  return candidate.type === "viewerError" && typeof candidate.message === "string";
}
