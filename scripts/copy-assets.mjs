import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pdfjsRoot = join(root, "node_modules", "pdfjs-dist");

const files = [
  ["legacy/build/pdf.mjs", "media/vendor/pdf.mjs"],
  ["legacy/build/pdf.worker.mjs", "media/vendor/pdf.worker.mjs"],
  ["../src/webview/viewer.css", "media/viewer/viewer.css"]
];

for (const [from, to] of files) {
  const destination = join(root, to);
  await mkdir(dirname(destination), { recursive: true });
  const source = from.startsWith("../") ? join(root, from.slice(3)) : join(pdfjsRoot, from);
  await copyFile(source, destination);
}
