import * as path from "node:path";
import { existsSync } from "node:fs";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = process.cwd();
  const extensionTestsPath = path.resolve(__dirname, "suite", "index");
  const localCode = "/Applications/Visual Studio Code.app/Contents/MacOS/Code";

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    vscodeExecutablePath: process.env.VSCODE_TEST_EXECUTABLE ?? (existsSync(localCode) ? localCode : undefined),
    launchArgs: ["--disable-extensions"]
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
