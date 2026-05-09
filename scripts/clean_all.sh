#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_DEPS=0
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/clean_all.sh [--with-deps] [--dry-run]

Cleans local generated state for the HL7 AI Workbench.

Default cleanup removes:
  - backend/hl7_workbench.db plus SQLite WAL/SHM files
  - frontend/dist and frontend/.vite
  - Python caches and pytest caches
  - coverage folders

Options:
  --with-deps  Also remove .venv and frontend/node_modules.
  --dry-run    Show what would be removed without deleting anything.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --with-deps)
      WITH_DEPS=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$ROOT_DIR/backend" || ! -d "$ROOT_DIR/frontend" ]]; then
  echo "Refusing to clean: project root was not detected correctly." >&2
  exit 1
fi

DB_FILE="$ROOT_DIR/backend/hl7_workbench.db"
if [[ "$DRY_RUN" -eq 0 && -f "$DB_FILE" ]] && command -v lsof >/dev/null 2>&1 && lsof "$DB_FILE" >/dev/null 2>&1; then
  echo "Stop the backend first. The SQLite database is currently open:" >&2
  lsof "$DB_FILE" >&2
  exit 1
fi

remove_path() {
  local path="$1"
  if [[ -e "$path" ]]; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      printf '[dry-run] would remove %s\n' "$path"
    else
      rm -rf "$path"
      printf 'removed %s\n' "$path"
    fi
  fi
}

remove_find_result() {
  local path="$1"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] would remove %s\n' "$path"
  else
    rm -rf "$path"
    printf 'removed %s\n' "$path"
  fi
}

remove_path "$ROOT_DIR/backend/hl7_workbench.db"
remove_path "$ROOT_DIR/backend/hl7_workbench.db-wal"
remove_path "$ROOT_DIR/backend/hl7_workbench.db-shm"
remove_path "$ROOT_DIR/frontend/dist"
remove_path "$ROOT_DIR/frontend/.vite"
remove_path "$ROOT_DIR/coverage"
remove_path "$ROOT_DIR/frontend/coverage"

while IFS= read -r cache_path; do
  remove_find_result "$cache_path"
done < <(
  find "$ROOT_DIR" \
    \( -path "$ROOT_DIR/.venv" -o -path "$ROOT_DIR/frontend/node_modules" -o -path "$ROOT_DIR/frontend/dist" \) -prune -o \
    -type d \( -name "__pycache__" -o -name ".pytest_cache" -o -name ".ruff_cache" -o -name ".mypy_cache" \) -print
)

while IFS= read -r pyc_path; do
  remove_find_result "$pyc_path"
done < <(
  find "$ROOT_DIR" \
    \( -path "$ROOT_DIR/.venv" -o -path "$ROOT_DIR/frontend/node_modules" -o -path "$ROOT_DIR/frontend/dist" \) -prune -o \
    -type f -name "*.pyc" -print
)

if [[ "$WITH_DEPS" -eq 1 ]]; then
  remove_path "$ROOT_DIR/.venv"
  remove_path "$ROOT_DIR/frontend/node_modules"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run complete. Nothing was deleted."
else
  echo "Clean complete."
  if [[ "$WITH_DEPS" -eq 1 ]]; then
    echo "Dependencies were removed. Reinstall with: python3 -m venv .venv && . .venv/bin/activate && pip install -r backend/requirements.txt && cd frontend && npm install"
  else
    echo "Dependencies were kept. Restart the backend to recreate the local database with default references."
  fi
fi
