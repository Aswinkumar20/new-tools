#!/usr/bin/env node
/**
 * One-shot: split app.routes.ts into per-category route files with deep loadComponent imports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ROUTES = path.join(ROOT, 'apps/tools-site/src/app/app.routes.ts');
const ROUTES_DIR = path.join(ROOT, 'apps/tools-site/src/app/routes');
const LIBS_DIR = path.join(ROOT, 'libs');

function exportConstName(slug) {
  return `${slug.replace(/-/g, '_').toUpperCase()}_ROUTES`;
}

function buildComponentMap() {
  /** @type {Map<string, { deep: string }>} */
  const map = new Map();
  for (const lib of fs.readdirSync(LIBS_DIR)) {
    const indexPath = path.join(LIBS_DIR, lib, 'src/index.ts');
    if (!fs.existsSync(indexPath)) continue;
    const alias = `@tools-workspace/${lib}`;
    const indexSrc = fs.readFileSync(indexPath, 'utf8');
    const exportRe = /export\s+(?:\*|\{[^}]*\})\s+from\s+'(\.\/lib\/component\/[^']+)'/g;
    let m;
    while ((m = exportRe.exec(indexSrc))) {
      const rel = m[1].replace(/^\.\/lib\/component\//, '');
      const filePath = path.join(LIBS_DIR, lib, 'src/lib/component', `${rel}.ts`);
      if (!fs.existsSync(filePath)) continue;
      const src = fs.readFileSync(filePath, 'utf8');
      const classRe = /export class (\w+)/g;
      let c;
      while ((c = classRe.exec(src))) {
        map.set(c[1], { deep: `${alias}/${rel}` });
      }
    }
  }
  return map;
}

function parseCategories(content) {
  const lines = content.split('\n');
  const categories = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const catMatch = lines[i].match(/^\s*path:\s*'([^']+)',\s*$/);
    if (catMatch && lines[i + 1]?.includes('children:')) {
      const slug = catMatch[1];
      if (slug !== '**') {
        current = { slug, tools: [] };
        categories.push(current);
      } else {
        current = null;
      }
      continue;
    }
    const toolMatch = lines[i].match(/^\s*path:\s*'([^']+)',\s*$/);
    if (
      toolMatch &&
      current &&
      toolMatch[1] &&
      lines.slice(i, i + 6).some((l) => l.includes('loadComponent'))
    ) {
      const block = lines.slice(i, i + 8).join('\n');
      const imp = block.match(/import\('([^']+)'\)\.then\(\s*m\s*=>\s*m\.(\w+)/);
      if (imp) {
        current.tools.push({ path: toolMatch[1], lib: imp[1], component: imp[2] });
      }
    }
  }
  return categories;
}

function main() {
  const componentMap = buildComponentMap();
  const appSrc = fs.readFileSync(APP_ROUTES, 'utf8');
  const categories = parseCategories(appSrc);
  fs.mkdirSync(ROUTES_DIR, { recursive: true });

  const missing = [];
  for (const cat of categories) {
    for (const tool of cat.tools) {
      if (!componentMap.has(tool.component)) {
        missing.push(`${cat.slug}/${tool.path} → ${tool.component}`);
      }
    }
  }
  if (missing.length) {
    console.error('Missing component file mappings:\n' + missing.map((x) => `  ${x}`).join('\n'));
    process.exit(1);
  }

  const categoryIndexImport =
    "    loadComponent: () =>\n      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),";

  for (const cat of categories) {
    const constName = exportConstName(cat.slug);
    const lines = [
      "import { Routes } from '@angular/router';",
      '',
      `export const ${constName}: Routes = [`,
    ];
    if (cat.slug === 'tools') {
      lines.push("  { path: '', redirectTo: 'home', pathMatch: 'full' },");
    } else {
      lines.push('  {');
      lines.push("    path: '',");
      lines.push(categoryIndexImport);
      lines.push('  },');
    }
    for (const tool of cat.tools) {
      const deep = componentMap.get(tool.component).deep;
      lines.push('  {');
      lines.push(`    path: '${tool.path}',`);
      lines.push('    loadComponent: () =>');
      lines.push(`      import('${deep}').then(m => m.${tool.component}),`);
      if (tool.path === 'text-difference') {
        lines.push(
          "    providers: [], // Monaco is provided on TextDifferenceComponent",
        );
      }
      lines.push('  },');
    }
    lines.push('];', '');
    fs.writeFileSync(path.join(ROUTES_DIR, `${cat.slug}.routes.ts`), lines.join('\n'));
  }

  const rootLines = [
    "import { Routes } from '@angular/router';",
    '',
    'export const appRoutes: Routes = [',
  ];
  for (const cat of categories) {
    const constName = exportConstName(cat.slug);
    const fileBase = `./routes/${cat.slug}.routes`;
    rootLines.push('  {');
    rootLines.push(`    path: '${cat.slug}',`);
    rootLines.push(
      `    loadChildren: () => import('${fileBase}').then(m => m.${constName}),`,
    );
    rootLines.push('  },');
  }
  rootLines.push("  { path: '', redirectTo: 'tools', pathMatch: 'full' },");
  rootLines.push('  {');
  rootLines.push("    path: '404',");
  rootLines.push(
    "    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFoundComponent),",
  );
  rootLines.push('  },');
  rootLines.push('  {');
  rootLines.push("    path: '**',");
  rootLines.push(
    "    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFoundComponent),",
  );
  rootLines.push('  },');
  rootLines.push('];', '');
  fs.writeFileSync(APP_ROUTES, rootLines.join('\n'));

  console.log(`Wrote ${categories.length} category route files + slim app.routes.ts`);
}

main();
