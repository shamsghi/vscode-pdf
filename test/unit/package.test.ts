import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  activationEvents: string[];
  capabilities: { untrustedWorkspaces: { supported: boolean } };
  contributes: { customEditors: Array<Record<string, unknown>> };
  engines: { vscode: string };
};

describe("extension manifest", () => {
  it("registers the PDF custom editor as the default viewer", () => {
    expect(packageJson.activationEvents).toContain("onCustomEditor:vscode-pdf.viewer");
    expect(packageJson.engines.vscode).toBe("^1.120.0");
    expect(packageJson.capabilities.untrustedWorkspaces.supported).toBe(true);

    const editor = packageJson.contributes.customEditors[0];
    expect(editor.viewType).toBe("vscode-pdf.viewer");
    expect(editor.priority).toBe("default");
    expect(editor.selector).toEqual([{ filenamePattern: "*.pdf" }]);
  });
});
