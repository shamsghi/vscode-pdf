# Shared helpers for locating VS Code / Cursor CLI tools.
# Source from other bash scripts; do not execute directly.

EDITOR_CANDIDATES=(cursor code code-insiders)

_INSTALL_UI_STEP=0

_install_ui_is_tty() {
  [ -t 1 ] && [ -z "${NO_COLOR:-}" ]
}

_install_ui_color() {
  local code="$1"
  if _install_ui_is_tty; then
    printf '\033[%sm' "$code"
  fi
}

_install_ui_reset() {
  _install_ui_color 0
}

fail() {
  if _install_ui_is_tty; then
    printf '%sError:%s %s\n' "$(_install_ui_color 31)" "$(_install_ui_reset)" "$*" >&2
  else
    echo "Error: $*" >&2
  fi
  exit 1
}

# install_ui_title <heading>
# Prints a banner and resets the step counter.
install_ui_title() {
  _INSTALL_UI_STEP=0
  echo "" >&2
  if _install_ui_is_tty; then
    printf '%s%s%s\n' "$(_install_ui_color 1)" "$1" "$(_install_ui_reset)" >&2
    printf '%s\n' "$(_install_ui_color 2)────────────────────────────────────────$(_install_ui_reset)" >&2
  else
    printf '%s\n' "$1" >&2
    printf '%s\n' "----------------------------------------" >&2
  fi
}

# install_ui_step <label>
install_ui_step() {
  _INSTALL_UI_STEP=$((_INSTALL_UI_STEP + 1))
  if _install_ui_is_tty; then
    printf '\n%s[%s]%s %s\n' "$(_install_ui_color 36)" "$_INSTALL_UI_STEP" "$(_install_ui_reset)" "$1" >&2
  else
    printf '\n[%s] %s\n' "$_INSTALL_UI_STEP" "$1" >&2
  fi
}

# install_ui_detail <message>
install_ui_detail() {
  printf '      %s\n' "$1" >&2
}

# install_ui_ok [message]
install_ui_ok() {
  local message="${1:-Done}"
  if _install_ui_is_tty; then
    printf '      %s✓ %s%s\n' "$(_install_ui_color 32)" "$message" "$(_install_ui_reset)" >&2
  else
    printf '      OK: %s\n' "$message" >&2
  fi
}

# install_ui_skip <reason>
install_ui_skip() {
  if _install_ui_is_tty; then
    printf '      %s— skipped (%s)%s\n' "$(_install_ui_color 2)" "$1" "$(_install_ui_reset)" >&2
  else
    printf '      Skipped: %s\n' "$1" >&2
  fi
}

# install_ui_elapsed <start_seconds>
install_ui_elapsed() {
  local start="$1"
  local elapsed=$((SECONDS - start))
  if [ "$elapsed" -le 0 ]; then
    printf '<1s'
  else
    printf '%ss' "$elapsed"
  fi
}

# install_ui_finish <editor_name> [version]
install_ui_finish() {
  local editor_name="$1"
  local version="${2:-}"
  echo "" >&2
  if _install_ui_is_tty; then
    printf '%s✓ Installation complete%s\n' "$(_install_ui_color 32)" "$(_install_ui_reset)" >&2
  else
    printf '%s\n' "Installation complete" >&2
  fi
  if [ -n "$version" ]; then
    install_ui_detail "Extension version: ${version}"
  fi
  install_ui_detail "Target editor: ${editor_name}"
  install_ui_detail "Reload ${editor_name} if a PDF viewer tab was already open."
  echo "" >&2
}

editor_display_name() {
  case "$1" in
    cursor) printf '%s' "Cursor" ;;
    code) printf '%s' "VS Code" ;;
    code-insiders) printf '%s' "VS Code Insiders" ;;
    *) printf '%s' "editor" ;;
  esac
}

editor_cli_id() {
  basename "$1"
}

is_editor_candidate() {
  local candidate="$1"
  local item
  for item in "${EDITOR_CANDIDATES[@]}"; do
    if [ "$item" = "$candidate" ]; then
      return 0
    fi
  done
  return 1
}

# discover_editor_path <candidate>
# Prints an executable path, or returns non-zero if not found.
discover_editor_path() {
  local candidate="$1"
  local path

  if command -v "$candidate" >/dev/null 2>&1; then
    command -v "$candidate"
    return 0
  fi

  case "$(uname -s)" in
    Darwin)
      case "$candidate" in
        cursor)
          for path in \
            "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" \
            "$HOME/Applications/Cursor.app/Contents/Resources/app/bin/cursor"; do
            if [ -x "$path" ]; then
              printf '%s' "$path"
              return 0
            fi
          done
          ;;
        code)
          for path in \
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
            "$HOME/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; do
            if [ -x "$path" ]; then
              printf '%s' "$path"
              return 0
            fi
          done
          ;;
        code-insiders)
          for path in \
            "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders" \
            "$HOME/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders"; do
            if [ -x "$path" ]; then
              printf '%s' "$path"
              return 0
            fi
          done
          ;;
      esac
      ;;
    Linux)
      case "$candidate" in
        cursor)
          for path in \
            "$HOME/.local/bin/cursor" \
            "/usr/local/bin/cursor" \
            "/usr/bin/cursor" \
            "/opt/Cursor/usr/bin/cursor" \
            "/opt/cursor/usr/bin/cursor"; do
            if [ -x "$path" ]; then
              printf '%s' "$path"
              return 0
            fi
          done
          ;;
        code)
          for path in \
            "$HOME/.local/bin/code" \
            "/usr/local/bin/code" \
            "/usr/bin/code" \
            "/usr/share/code/bin/code" \
            "/opt/visual-studio-code/usr/bin/code"; do
            if [ -x "$path" ]; then
              printf '%s' "$path"
              return 0
            fi
          done
          ;;
        code-insiders)
          for path in \
            "$HOME/.local/bin/code-insiders" \
            "/usr/local/bin/code-insiders" \
            "/usr/bin/code-insiders" \
            "/usr/share/code-insiders/bin/code-insiders"; do
            if [ -x "$path" ]; then
              printf '%s' "$path"
              return 0
            fi
          done
          ;;
      esac
      ;;
  esac

  return 1
}

editor_not_found_help() {
  local candidate="$1"
  case "$candidate" in
    cursor)
      printf '%s\n' "Cursor CLI not found. In Cursor, run: Shell Command: Install 'cursor' command in PATH"
      ;;
    code)
      printf '%s\n' "VS Code CLI not found. In VS Code, run: Shell Command: Install 'code' command in PATH"
      ;;
    code-insiders)
      printf '%s\n' "VS Code Insiders CLI not found. In Insiders, run: Shell Command: Install 'code-insiders' command in PATH"
      ;;
  esac
}

validate_editor_cli() {
  local candidate="$1"
  local path

  if ! is_editor_candidate "$candidate"; then
    fail "Unknown editor '${candidate}'. Use: cursor, code, or code-insiders."
  fi

  path="$(discover_editor_path "$candidate" || true)"
  if [ -z "$path" ]; then
    fail "$(editor_not_found_help "$candidate")"
  fi

  printf '%s' "$path"
}

prompt_tty() {
  if [ -t 0 ]; then
    printf '%s' "/dev/stdin"
    return 0
  fi
  if [ -r /dev/tty ]; then
    printf '%s' "/dev/tty"
    return 0
  fi
  return 1
}

prompt_editor_selection() {
  local tty_in choice candidate path status
  local count="${#EDITOR_CANDIDATES[@]}"

  if ! tty_in="$(prompt_tty)"; then
    fail "Interactive editor selection requires a TTY. Pass --editor <name> or set VSCODE_PDF_EDITOR."
  fi

  echo "" >&2
  echo "Select editor to install into:" >&2
  local index=1
  for candidate in "${EDITOR_CANDIDATES[@]}"; do
    path="$(discover_editor_path "$candidate" || true)"
    if [ -n "$path" ]; then
      status="found at ${path}"
    else
      status="not found"
    fi
    printf '  %s) %s — %s\n' "$index" "$(editor_display_name "$candidate")" "$status" >&2
    index=$((index + 1))
  done
  echo "" >&2

  while true; do
    printf 'Choice [1-%s]: ' "$count" >&2
    if ! IFS= read -r choice <"$tty_in"; then
      fail "Selection cancelled."
    fi

    case "$choice" in
      '' | *[!0-9]*)
        printf 'Enter a number from 1 to %s.\n' "$count" >&2
        ;;
      *)
        if [ "$choice" -ge 1 ] && [ "$choice" -le "$count" ]; then
          candidate="${EDITOR_CANDIDATES[$((choice - 1))]}"
          path="$(discover_editor_path "$candidate" || true)"
          if [ -z "$path" ]; then
            echo "" >&2
            editor_not_found_help "$candidate" >&2
            fail "Cannot install into $(editor_display_name "$candidate") until its CLI is available."
          fi
          printf '%s' "$path"
          return 0
        fi
        printf 'Enter a number from 1 to %s.\n' "$count" >&2
        ;;
    esac
  done
}

# resolve_editor_cli [requested_editor]
# Prints the executable path. Honors VSCODE_PDF_EDITOR, then requested_editor, then menu.
resolve_editor_cli() {
  local requested="${1:-}"
  local editor_path editor_id

  if [ -n "${VSCODE_PDF_EDITOR:-}" ]; then
    requested="$VSCODE_PDF_EDITOR"
  fi

  if [ -n "$requested" ]; then
    editor_path="$(validate_editor_cli "$requested")"
    editor_id="$(editor_cli_id "$editor_path")"
    install_ui_ok "Using $(editor_display_name "$editor_id") (${editor_path})"
    printf '%s' "$editor_path"
    return 0
  fi

  editor_path="$(prompt_editor_selection)"
  editor_id="$(editor_cli_id "$editor_path")"
  install_ui_ok "Using $(editor_display_name "$editor_id") (${editor_path})"
  printf '%s' "$editor_path"
}

install_extension_vsix() {
  local editor_cmd="$1"
  local editor_name="$2"
  local extension_id="$3"
  local vsix="$4"
  local package_version=""
  local step_start="$SECONDS"

  install_ui_step "Installing extension into ${editor_name}"

  if [ ! -s "$vsix" ]; then
    fail "VSIX not found or empty: ${vsix}"
  fi

  install_ui_detail "Package: ${vsix}"

  if command -v unzip >/dev/null 2>&1 && ! unzip -tq "$vsix" >/dev/null 2>&1; then
    fail "VSIX is not a valid zip archive: ${vsix}"
  fi

  if command -v unzip >/dev/null 2>&1; then
    package_version="$(
      unzip -p "$vsix" extension/package.json \
        | sed -n 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/p' \
        | head -n 1
    )"
    if [ -n "$package_version" ]; then
      install_ui_detail "Version: ${package_version}"
    fi
  fi

  install_ui_detail "Running: ${editor_cmd} --install-extension … --force"
  "$editor_cmd" --install-extension "$vsix" --force \
    || fail "${editor_name} failed to install the extension"

  install_ui_detail "Verifying ${extension_id} is registered..."
  if ! "$editor_cmd" --list-extensions | grep -Fxq "$extension_id"; then
    fail "${editor_name} did not report ${extension_id} after installation"
  fi

  install_ui_ok "Installed in $(install_ui_elapsed "$step_start")"
  install_ui_finish "$editor_name" "$package_version"
}
