import * as crypto from "node:crypto";

export interface WebviewLike {
  cspSource: string;
}

export function createNonce(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export function sanitizeUiText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 1000);
}

export function buildContentSecurityPolicy(webview: WebviewLike): string {
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

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
