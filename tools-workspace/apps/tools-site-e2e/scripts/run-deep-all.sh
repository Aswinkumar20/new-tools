#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/apps/tools-site-e2e"

npx playwright test src/deep-tool-audit.spec.ts \
  --grep @deep \
  --project=chromium \
  "$@"
