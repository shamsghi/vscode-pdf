# VS Code PDF Viewer

A secure, read-only VS Code custom editor for `.pdf` files using bundled `pdf.js`.

The extension does not launch external applications, run local servers, load CDN assets, or request broad workspace resource access.

## Install

Run this command (works with **VS Code** and **Cursor**):

```sh
curl -fsSL https://raw.githubusercontent.com/shamsghi/vscode-pdf/main/install.sh | bash
```

The installer always asks which editor to use (`cursor`, `code`, or `code-insiders`). It finds CLIs on your PATH and in standard app install locations (e.g. `/Applications/Cursor.app/...` on macOS). Skip the menu with `--editor cursor` or `VSCODE_PDF_EDITOR=cursor`.

Then reload your editor if a PDF viewer tab was already open.

The extension targets VS Code `^1.74.0`, which includes current **Cursor** builds (Cursor reports its embedded VS Code version when installing extensions).

## Local install (test before shipping)

From a clone of this repo, build a `.vsix` from your working tree and install it into VS Code or Cursor (same flow as a release, without downloading from GitHub):

```sh
pnpm install
pnpm install:local
```

Or run the script directly:

```sh
./install-local.sh
./install-local.sh --editor cursor
```

Options:

- `--editor <name>` — install into `cursor`, `code`, or `code-insiders` without a menu
- `--skip-build` — package and install using an existing compile
- `--skip-package` — reinstall `vscode-pdf.vsix` only (after `pnpm package`)

After install, reload the editor and open any `.pdf` file to exercise the viewer. Bump `version` in `package.json` when you need to confirm an upgrade replaced an older build (`--force` is used automatically).

## Safety review prompt

If you want another agent to inspect this repository for suspicious or malware-like behavior before installing it, you can give it this prompt:

```text
Review this repository for suspicious, malicious, or privacy-invasive behavior.

Focus on:
- Install scripts, package manager lifecycle hooks, postinstall behavior, shell commands, and generated files.
- Network calls, telemetry, exfiltration paths, remote code loading, CDN usage, or external process execution.
- VS Code extension permissions, workspace access, file system access, command registration, and webview behavior.
- Obfuscated, minified, vendored, or binary content that could hide behavior.
- Dependency and lockfile risks, including unusual packages, native modules, scripts, or mismatched metadata.

Do not assume the README is accurate. Inspect the source, manifests, scripts, lockfiles, and bundled assets directly.
Do not run install scripts or execute repository code unless you first explain why it is necessary and how you will sandbox it.

Return:
- A short verdict: low, medium, or high risk.
- Concrete findings with file paths and line numbers.
- Any behavior that reaches outside the local PDF viewer purpose.
- Commands you ran and whether they executed repo code.
- Remaining uncertainty or files that need manual review.
```

## Features

- Opens `.pdf` files inside VS Code.
- Bundles `pdf.js`, so no CDN or external viewer is needed.
- Supports search, zoom, rotate, and page navigation.
- Supports freeform dotted lasso text selection for copying selected text.
