import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { VIEW_TYPE } from "../../src/extension/constants";

const manifest = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { name: string; publisher: string };
const extensionId = `${manifest.publisher}.${manifest.name}`;

suite("VS Code PDF Viewer extension", () => {
  test("is present and contributes the PDF custom editor", () => {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension);

    const packageJson = extension.packageJSON as {
      contributes: { customEditors: Array<{ viewType: string; selector: Array<{ filenamePattern: string }>; priority: string }> };
    };
    const editor = packageJson.contributes.customEditors.find((candidate) => candidate.viewType === VIEW_TYPE);

    assert.ok(editor);
    assert.equal(editor.priority, "default");
    assert.deepEqual(editor.selector, [{ filenamePattern: "*.pdf" }]);
  });

  test("activates the provider", async () => {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension);

    await extension.activate();
    assert.equal(extension.isActive, true);
  });
});
