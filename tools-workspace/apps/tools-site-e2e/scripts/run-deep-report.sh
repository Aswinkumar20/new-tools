#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/apps/tools-site-e2e"

npx playwright test src/deep-tool-audit.spec.ts \
  --grep @deep \
  --project=chromium \
  --reporter=html,line,json \
  "$@"

echo ""
echo "Open HTML report:"
echo "  npx playwright show-report ../../dist/.playwright/apps/tools-site-e2e/playwright-report"
