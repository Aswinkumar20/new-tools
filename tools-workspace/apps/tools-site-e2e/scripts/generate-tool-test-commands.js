#!/usr/bin/env node
/**
 * Generates TEMP command cheat-sheets for per-tool deep Playwright audits.
 * Regenerate when tools-catalog.generated.ts changes:
 *   node apps/tools-site-e2e/scripts/generate-tool-test-commands.js
 */

const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../../..');
const catalogPath = path.join(
  workspaceRoot,
  'libs/features-home/src/lib/config/tools-catalog.generated.ts'
);
const seoCatalogPath = path.join(
  workspaceRoot,
  'apps/tools-site/src/app/config/tool-seo-catalog.generated.ts'
);
const outDir = path.join(workspaceRoot, 'apps/tools-site-e2e');

function readComingSoonPaths() {
  const source = fs.readFileSync(seoCatalogPath, 'utf8');
  const block = source.match(/COMING_SOON_PATHS[^[]*\[([\s\S]*?)\];/);
  if (!block) {
    return new Set();
  }
  return new Set([...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
}

function readCategories() {
  const source = fs.readFileSync(catalogPath, 'utf8');
  const categories = [];
  const categoryBlocks = source.matchAll(
    /name: '([^']+)',\s*\n\s*description: '[^']*',\s*\n\s*path: '([^']+)',\s*[\s\S]*?subCategories: \[([\s\S]*?)\n\s*\],/g
  );

  for (const match of categoryBlocks) {
    const [, name, categoryPath, subBlock] = match;
    const tools = [...subBlock.matchAll(/name: '([^']+)',\s*\n\s*description:[\s\S]*?\n\s*path: '([^']+)',/g)].map(
      (t) => ({ name: t[1], path: t[2] })
    );
    categories.push({ name, path: categoryPath, tools });
  }

  return categories;
}

function shellEscape(value) {
  return value.replace(/'/g, `'\\''`);
}

function buildMarkdown(categories, comingSoon) {
  const lines = [
    '# TEMP — Per-tool deep test commands',
    '',
    '> Auto-generated. Safe to delete. Regenerate:',
    '> `node apps/tools-site-e2e/scripts/generate-tool-test-commands.js`',
    '',
    '## Before you run anything',
    '',
    '```bash',
    '# Terminal 1',
    'npm start',
    '',
    '# Terminal 2 (one-time browser install)',
    'npx playwright install chromium',
    '```',
    '',
    '## All live tools (deep audit + HTML report)',
    '',
    '```bash',
    'npm run e2e:deep:report',
    'npx playwright show-report dist/.playwright/apps/tools-site-e2e/playwright-report',
    '```',
    '',
    '## One category (all tools in that library)',
    '',
  ];

  for (const category of categories) {
    lines.push('```bash');
    lines.push(`npm run e2e:category -- ${category.path}`);
    lines.push('```');
    lines.push('');
  }

  lines.push('## One specific tool (recommended for feature debugging)');
  lines.push('');

  for (const category of categories) {
    lines.push(`### ${category.name}`);
    lines.push('');
    for (const tool of category.tools) {
      const status = comingSoon.has(tool.path) ? 'coming soon' : 'live';
      lines.push(`#### ${tool.name} (\`${status}\`)`);
      lines.push('');
      lines.push('```bash');
      lines.push(`npm run e2e:tool -- '${shellEscape(tool.path)}'`);
      lines.push('# with HTML report saved for this run');
      lines.push(`npm run e2e:tool:report -- '${shellEscape(tool.path)}'`);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildShell(categories) {
  const lines = [
    '#!/usr/bin/env bash',
    '# TEMP — quick runners. Regenerate via generate-tool-test-commands.js',
    'set -euo pipefail',
    'ROOT="$(cd "$(dirname "$0")/../.." && pwd)"',
    'cd "$ROOT/apps/tools-site-e2e"',
    '',
    'run_tool() {',
    '  local tool_path="$1"',
    '  npx playwright test src/deep-tool-audit.spec.ts --grep "$tool_path" --project=chromium "$@"',
    '}',
    '',
    'case "${1:-help}" in',
    '  help)',
    '    echo "Usage: bash apps/tools-site-e2e/TEMP-run-tool-test.sh <tool-path>"',
    '    echo "Example: bash apps/tools-site-e2e/TEMP-run-tool-test.sh /text-utilities/character-counter"',
    '    ;;',
  ];

  for (const category of categories) {
    for (const tool of category.tools) {
      const key = tool.path.replace(/^\//, '').replace(/\//g, '-');
      lines.push(`  ${key})`);
      lines.push(`    run_tool '${shellEscape(tool.path)}' "$@"`);
      lines.push('    ;;');
    }
  }

  lines.push('  *)');
  lines.push('    run_tool "$1" "${@:2}"');
  lines.push('    ;;');
  lines.push('esac');
  lines.push('');

  return lines.join('\n');
}

const comingSoon = readComingSoonPaths();
const categories = readCategories();

const mdPath = path.join(outDir, 'TEMP-all-tool-test-commands.md');
const shPath = path.join(outDir, 'TEMP-run-tool-test.sh');

fs.writeFileSync(mdPath, buildMarkdown(categories, comingSoon));
fs.writeFileSync(shPath, buildShell(categories));
fs.chmodSync(shPath, 0o755);

const toolCount = categories.reduce((n, c) => n + c.tools.length, 0);
console.log(`Wrote ${mdPath}`);
console.log(`Wrote ${shPath}`);
console.log(`Tools: ${toolCount} across ${categories.length} categories`);
