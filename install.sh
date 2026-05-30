#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=scripts/lib/editor-cli.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/lib/editor-cli.sh"

repo="shamsghi/vscode-pdf"
extension_id="shamsghi.vscode-pdf"
release_api_url="https://api.github.com/repos/${repo}/releases/latest"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
requested_editor=""

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Install the latest VS Code PDF Viewer release from GitHub.

Options:
  --editor <name>   Install into cursor, code, or code-insiders (skips menu)
  -h, --help        Show this help

Environment:
  VSCODE_PDF_EDITOR   Same as --editor (non-interactive)

When several editor CLIs are on PATH and neither is set, you are prompted to choose.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --editor)
      [ $# -ge 2 ] || fail "Missing value for --editor"
      requested_editor="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1 (try --help)"
      ;;
  esac
done

install_ui_title "VS Code PDF Viewer — release install"

install_ui_step "Selecting editor"
editor_cmd="$(resolve_editor_cli "$requested_editor")"
editor_name="$(editor_display_name "$(editor_cli_id "$editor_cmd")")"

install_ui_step "Resolving latest GitHub release"
step_start="$SECONDS"
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

if [ -n "$release_tag" ]; then
  install_ui_ok "Latest release ${release_tag} ($(install_ui_elapsed "$step_start"))"
else
  install_ui_ok "Release metadata fetched ($(install_ui_elapsed "$step_start"))"
fi

install_ui_step "Downloading VSIX"
step_start="$SECONDS"
vsix="${tmp_dir}/vscode-pdf.vsix"
install_ui_detail "$asset_url"
if [ -t 2 ] && [ -z "${NO_COLOR:-}" ]; then
  curl -fL --progress-bar "$asset_url" -o "$vsix" \
    || fail "Unable to download VSIX asset"
else
  curl -fLsS "$asset_url" -o "$vsix" \
    || fail "Unable to download VSIX asset"
fi

if [ ! -s "$vsix" ]; then
  fail "Downloaded VSIX is empty"
fi

install_ui_ok "Downloaded $(install_ui_elapsed "$step_start")"

install_extension_vsix "$editor_cmd" "$editor_name" "$extension_id" "$vsix"
