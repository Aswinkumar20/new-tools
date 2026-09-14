#!/usr/bin/env bash
# Run deep audit for all tools in a category slug, e.g. text-utilities
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CATEGORY="${1:-}"

if [[ -z "$CATEGORY" ]]; then
  echo "Usage: npm run e2e:category -- text-utilities"
  exit 1
fi

CATEGORY="${CATEGORY#/}"
CATEGORY="${CATEGORY%/}"

cd "$ROOT/apps/tools-site-e2e"

npx playwright test src/deep-tool-audit.spec.ts \
  --grep "/${CATEGORY}/" \
  --project=chromium \
  "${@:2}"
