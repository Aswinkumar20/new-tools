#!/usr/bin/env bash
# Run deep audit for one tool path, e.g. /text-utilities/character-counter
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TOOL_PATH="${1:-}"

if [[ -z "$TOOL_PATH" ]]; then
  echo "Usage: npm run e2e:tool -- /text-utilities/character-counter"
  exit 1
fi

cd "$ROOT/apps/tools-site-e2e"

npx playwright test src/deep-tool-audit.spec.ts \
  --grep "$TOOL_PATH" \
  --project=chromium \
  "${@:2}"
