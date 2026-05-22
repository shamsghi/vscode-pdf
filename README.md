# VS Code PDF Viewer

A secure, read-only VS Code custom editor for `.pdf` files using bundled `pdf.js`.

The extension does not launch external applications, run local servers, load CDN assets, or request broad workspace resource access.

## Install

Run this command:

```sh
curl -fsSL https://raw.githubusercontent.com/shamsghi/vscode-pdf/main/install.sh | bash
```

Then reload VS Code if a PDF viewer tab was already open.

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
