#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TOOL_PATH="${1:-}"

if [[ -z "$TOOL_PATH" ]]; then
  echo "Usage: npm run e2e:tool:report -- /text-utilities/character-counter"
  exit 1
fi

cd "$ROOT/apps/tools-site-e2e"

REPORT_DIR="$ROOT/dist/.playwright/tool-audit/$(echo "$TOOL_PATH" | tr '/' '_')"
mkdir -p "$REPORT_DIR"

PLAYWRIGHT_HTML_OUTPUT_DIR="$REPORT_DIR" \
  npx playwright test src/deep-tool-audit.spec.ts \
  --grep "$TOOL_PATH" \
  --project=chromium \
  --reporter=html,line \
  "${@:2}"

echo ""
echo "Report: $REPORT_DIR/index.html"
