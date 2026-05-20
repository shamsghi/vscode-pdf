#!/usr/bin/env bash
set -euo pipefail

repo="shamsghi/vscode-pdf"
asset_url="https://github.com/${repo}/releases/latest/download/vscode-pdf.vsix"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

if command -v code >/dev/null 2>&1; then
  code_cmd="code"
elif command -v code-insiders >/dev/null 2>&1; then
  code_cmd="code-insiders"
else
  echo "VS Code CLI not found. In VS Code, run: Shell Command: Install 'code' command in PATH" >&2
  exit 1
fi

vsix="${tmp_dir}/vscode-pdf.vsix"
echo "Downloading VS Code PDF Viewer..."
curl -fL "$asset_url" -o "$vsix"

echo "Installing with ${code_cmd}..."
"$code_cmd" --install-extension "$vsix" --force

echo "Installed. Reload VS Code if the PDF viewer was already open."
