import { describe, expect, it } from "vitest";
import { buildWebviewHtml } from "../../src/extension/webview/html";
import { isWebviewToExtensionMessage } from "../../src/extension/webview/messages";
import {
  buildContentSecurityPolicy,
  sanitizeUiText
} from "../../src/extension/webview/security";

describe("webview security helpers", () => {
  it("builds a strict CSP for bundled viewer assets only", () => {
    const csp = buildContentSecurityPolicy({ cspSource: "vscode-webview://abc" });

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src vscode-webview://abc");
    expect(csp).toContain("style-src vscode-webview://abc");
    expect(csp).toContain("connect-src vscode-webview://abc");
    expect(csp).toContain("worker-src blob:");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("http:");
    expect(csp).not.toContain("https:");
  });

  it("uses nonced module script tags and escapes resource attributes", () => {
    const html = buildWebviewHtml(
      { cspSource: "vscode-webview://abc" },
      {
        viewerScriptUri: "vscode-webview://abc/viewer.js?x=<bad>",
        viewerStyleUri: "vscode-webview://abc/viewer.css",
        pdfModuleUri: "vscode-webview://abc/pdf.mjs",
        pdfWorkerUri: "vscode-webview://abc/pdf.worker.mjs"
      },
      "nonce-value"
    );

    expect(html).toContain('nonce="nonce-value"');
    expect(html).toContain("viewer.js?x=&lt;bad&gt;");
    expect(html).not.toContain("onclick=");
  });

  it("validates the narrow webview-to-extension message surface", () => {
    expect(isWebviewToExtensionMessage({ type: "ready" })).toBe(true);
    expect(isWebviewToExtensionMessage({ type: "viewerError", message: "nope" })).toBe(true);
    expect(isWebviewToExtensionMessage({ type: "viewerError", message: 1 })).toBe(false);
    expect(isWebviewToExtensionMessage({ type: "openExternal", uri: "https://example.com" })).toBe(false);
  });

  it("sanitizes PDF and workspace derived text", () => {
    expect(sanitizeUiText("safe\u0000name.pdf")).toBe("safename.pdf");
    expect(sanitizeUiText(42, "fallback")).toBe("fallback");
    expect(sanitizeUiText("a".repeat(1100))).toHaveLength(1000);
  });
});
