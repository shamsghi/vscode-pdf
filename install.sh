#!/usr/bin/env bash
set -euo pipefail

repo="shamsghi/vscode-pdf"
extension_id="shamsghi.vscode-pdf"
release_api_url="https://api.github.com/repos/${repo}/releases/latest"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

fail() {
  echo "Error: $*" >&2
  exit 1
}

if command -v code >/dev/null 2>&1; then
  code_cmd="code"
elif command -v code-insiders >/dev/null 2>&1; then
  code_cmd="code-insiders"
else
  fail "VS Code CLI not found. In VS Code, run: Shell Command: Install 'code' command in PATH"
fi

echo "Resolving latest VS Code PDF Viewer release..."
release_json="${tmp_dir}/release.json"
curl -fsSL \
  -H "Accept: application/vnd.github+json" \
  -H "User-Agent: vscode-pdf-installer" \
  "$release_api_url" \
  -o "$release_json" || fail "Unable to fetch latest release metadata from GitHub"

release_tag="$(
  sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' "$release_json" | head -n 1
)"
release_version="${release_tag#v}"

asset_url="$(
  sed -n 's/.*"browser_download_url":[[:space:]]*"\([^"]*\.vsix\)".*/\1/p' "$release_json" \
    | awk -v release_version="$release_version" '
      release_version != "" && $0 ~ "/vscode-pdf-" release_version "\\.vsix$" { versioned = $0 }
      /\/vscode-pdf\.vsix$/ { preferred = $0 }
      first == "" { first = $0 }
      END {
        if (versioned != "") {
          print versioned
        } else if (preferred != "") {
          print preferred
        } else {
          print first
        }
      }
    '
)"

if [ -z "$asset_url" ]; then
  fail "Latest release does not include a .vsix asset"
fi

vsix="${tmp_dir}/vscode-pdf.vsix"
if [ -n "$release_tag" ]; then
  echo "Latest release: ${release_tag}"
fi

echo "Downloading VS Code PDF Viewer from ${asset_url}..."
curl -fL "$asset_url" -o "$vsix" || fail "Unable to download VSIX asset"

if [ ! -s "$vsix" ]; then
  fail "Downloaded VSIX is empty"
fi

if command -v unzip >/dev/null 2>&1 && ! unzip -tq "$vsix" >/dev/null 2>&1; then
  fail "Downloaded VSIX is not a valid zip archive"
fi

if command -v unzip >/dev/null 2>&1; then
  package_version="$(
    unzip -p "$vsix" extension/package.json \
      | sed -n 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -n 1
  )"

  if [ -n "$package_version" ]; then
    echo "Extension package version: ${package_version}"
  fi
fi

echo "Installing with ${code_cmd}..."
"$code_cmd" --install-extension "$vsix" --force || fail "VS Code failed to install the extension"

if ! "$code_cmd" --list-extensions | grep -Fxq "$extension_id"; then
  fail "VS Code did not report ${extension_id} after installation"
fi

echo "Installed. Reload VS Code if the PDF viewer was already open."
