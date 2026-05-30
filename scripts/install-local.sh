#!/usr/bin/env bash
# Build, package, and install this extension from the local repo (VS Code / Cursor).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/editor-cli.sh
source "$ROOT/scripts/lib/editor-cli.sh"

extension_id="shamsghi.vscode-pdf"
skip_build=0
skip_package=0
requested_editor=""

usage() {
  cat <<'EOF'
Usage: install-local.sh [options]

Builds a .vsix from the current repository and installs it into VS Code or Cursor
(same artifact you would ship).

Options:
  --editor <name>   Install into cursor, code, or code-insiders (skips menu)
  --skip-build      Skip compile; use existing dist/ and media/ outputs
  --skip-package    Install vscode-pdf.vsix without rebuilding (implies --skip-build)
  -h, --help        Show this help

Environment:
  VSCODE_PDF_EDITOR   Same as --editor (non-interactive)

When several editor CLIs are on PATH and neither is set, you are prompted to choose.

Examples:
  ./install-local.sh
  ./install-local.sh --editor cursor
  pnpm install:local
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --editor)
      [ $# -ge 2 ] || fail "Missing value for --editor"
      requested_editor="$2"
      shift 2
      ;;
    --skip-build)
      skip_build=1
      shift
      ;;
    --skip-package)
      skip_build=1
      skip_package=1
      shift
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

cd "$ROOT"

install_ui_title "VS Code PDF Viewer — local install"

if [ ! -d node_modules ]; then
  fail "node_modules missing. Install dependencies first (pnpm install, npm install, etc.)."
fi

local_bin() {
  local name="$1"
  local path="$ROOT/node_modules/.bin/$name"
  if [ ! -x "$path" ]; then
    fail "Missing ${path}. Install dependencies first (pnpm install, npm install, etc.)."
  fi
  printf '%s' "$path"
}

run_compile() {
  local step_start="$SECONDS"
  install_ui_step "Compiling extension and webview"
  install_ui_detail "Copying bundled assets"
  node ./scripts/copy-assets.mjs
  install_ui_detail "Type-checking extension (tsconfig.json)"
  "$(local_bin tsc)" -p tsconfig.json
  install_ui_detail "Type-checking webview (tsconfig.webview.json)"
  "$(local_bin tsc)" -p tsconfig.webview.json
  install_ui_ok "Build finished in $(install_ui_elapsed "$step_start")"
}

run_package() {
  local step_start="$SECONDS"
  local version
  version="$(node -e "console.log(require('./package.json').version)")"
  install_ui_step "Packaging VSIX"
  install_ui_detail "Removing old vscode-pdf*.vsix files"
  rm -f vscode-pdf*.vsix
  install_ui_detail "Running vsce package (version ${version})"
  "$(local_bin vsce)" package --no-dependencies --allow-missing-repository
  cp "vscode-pdf-${version}.vsix" vscode-pdf.vsix
  install_ui_ok "Created vscode-pdf-${version}.vsix ($(install_ui_elapsed "$step_start"))"
  install_ui_detail "Stable path: ${ROOT}/vscode-pdf.vsix"
}

install_ui_step "Selecting editor"
editor_cmd="$(resolve_editor_cli "$requested_editor")"
editor_name="$(editor_display_name "$(editor_cli_id "$editor_cmd")")"

if [ "$skip_package" -eq 0 ]; then
  if [ "$skip_build" -eq 0 ]; then
    run_compile
  else
    install_ui_step "Compiling extension and webview"
    install_ui_skip "--skip-build"
  fi
  run_package
else
  install_ui_step "Compiling extension and webview"
  install_ui_skip "--skip-package"
  install_ui_step "Packaging VSIX"
  install_ui_skip "--skip-package"
fi

vsix="${ROOT}/vscode-pdf.vsix"
if [ ! -f "$vsix" ]; then
  fail "No ${vsix}. Run without --skip-package or run: pnpm package"
fi

install_extension_vsix "$editor_cmd" "$editor_name" "$extension_id" "$vsix"
