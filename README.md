# VS Code PDF Viewer

A secure, read-only VS Code custom editor for `.pdf` files using bundled `pdf.js`.

The extension does not launch external applications, run local servers, load CDN assets, or request broad workspace resource access.

## Install

Run this in a terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/shamsghi/vscode-pdf/main/install.sh | bash
```

Then reload VS Code if a PDF viewer tab was already open.

## Features

- Opens `.pdf` files inside VS Code.
- Bundles `pdf.js`, so no CDN or external viewer is needed.
- Supports search, zoom, rotate, and page navigation.
- Supports freeform dotted lasso text selection for copying selected text.
