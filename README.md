<p align="center">
  <img src="https://github.com/user-attachments/assets/92b4d436-fba5-4f08-85ce-17eb2409575d" width="200" />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://github.com/user-attachments/assets/7507a2f9-7095-46ce-b813-194c956c22f2" width="180" />
</p>

# 📖 VS Code & Cursor PDF Viewer

A secure, read-only VS Code custom editor for `.pdf` files using bundled `pdf.js`. We support VSCode and Cursor.

The extension does not launch external applications, run local servers, load CDN assets, or request broad workspace resource access. You are encouraged to let your agent inspect repo before installing.

## Install

Run this command:

```sh
curl -fsSL https://raw.githubusercontent.com/shamsghi/vscode-pdf/main/install.sh | bash
```
## Safety Install

If you want another agent to install safely, you can give it this prompt:

```text
Review this repository's code for suspicious, malicious, or privacy-invasive behavior. https://github.com/shamsghi/vscode-pdf. If repo is safe, install it, there's already a script on main. Use question tool to ask user if they want to install it on VSCode or Cursor
```

## How does Installer work
The installer always asks which editor to use (`cursor`, `code`, or `code-insiders`). It finds CLIs on your PATH and in standard app install locations (e.g. `/Applications/Cursor.app/...` on macOS). Skip the menu with `--editor cursor` or `VSCODE_PDF_EDITOR=cursor`.

Then reload your editor if a PDF viewer tab was already open.

The extension targets VS Code `^1.74.0`, which includes current **Cursor** builds (Cursor reports its embedded VS Code version when installing extensions).


## Local install (testing)

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

## Features

- Opens `.pdf` files inside VS Code.
- Bundles `pdf.js`, so no CDN or external viewer is needed.
- Supports search, zoom, rotate, and page navigation.
- Supports freeform dotted lasso text selection for copying selected text.
