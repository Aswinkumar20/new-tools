/**
 * Generates SEO catalog, homepage/navigation catalog, and prerender routes
 * from app.routes.ts (routed tools only).
 * Run: node apps/tools-site/scripts/generate-tool-seo-catalog.js
 */

const fs = require('fs');
const path = require('path');
const {
  CATEGORY_META,
  extractRoutedTools,
  extractPrerenderRoutes,
  extractComingSoonPaths,
  slugToTitle,
} = require('./lib/extract-routes');
const { getEnrichment, buildEnhancedKeywords } = require('./lib/tool-seo-enrichment');

const ROOT = path.join(__dirname, '../../..');
const FOOTER_FILE = path.join(ROOT, 'libs/features-home/src/lib/component/footer/footer.config.ts');
const TEXT_CATALOG_FILE = path.join(ROOT, 'libs/features-home/src/lib/config/text-utilities-catalog.ts');
const HOMEPAGE_FILE = path.join(ROOT, 'libs/features-home/src/lib/component/myComponent/my-component.ts');
const SEO_OUTPUT = path.join(ROOT, 'apps/tools-site/src/app/config/tool-seo-catalog.generated.ts');
const CATALOG_OUTPUT = path.join(ROOT, 'libs/features-home/src/lib/config/tools-catalog.generated.ts');
const PRERENDER_ROUTES_OUTPUT = path.join(ROOT, 'apps/tools-site/prerender-routes.txt');

const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([slug, meta]) => [slug, meta.name])
);

function extractToolEntries(content) {
  const entries = new Map();
  const patterns = [
    /name:\s*'((?:\\'|[^'])*)'[\s\S]*?description:\s*'((?:\\'|[^'])*)'[\s\S]*?path:\s*'([^']+)'/g,
    /label:\s*'((?:\\'|[^'])*)'[\s\S]*?path:\s*'([^']+)'[\s\S]*?description:\s*'((?:\\'|[^'])*)'/g,
    /label:\s*'((?:\\'|[^'])*)'[\s\S]*?description:\s*'((?:\\'|[^'])*)'[\s\S]*?path:\s*'([^']+)'/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let name, description, rawPath;
      if (pattern.source.startsWith('label')) {
        if (
          match.length === 4 &&
          match[0].includes('description') &&
          match[0].indexOf('path') < match[0].indexOf('description')
        ) {
          [, name, rawPath, description] = match;
        } else {
          [, name, description, rawPath] = match;
        }
      } else {
        [, name, description, rawPath] = match;
      }

      const routePath = normalizePath(rawPath);
      if (!routePath || routePath === '/tools/home') continue;

      const existing = entries.get(routePath);
      if (!existing || description.length > existing.description.length) {
        entries.set(routePath, {
          name: cleanString(name),
          description: cleanString(description),
        });
      }
    }
  }

  return entries;
}

function normalizePath(p) {
  if (!p || p.includes('**')) return null;
  const cleaned = p.replace(/^\//, '');
  if (!cleaned.includes('/')) return null;
  return `/${cleaned}`;
}

function cleanString(s) {
  return s.replace(/\\'/g, "'").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

function shortToolName(name) {
  const parenIndex = name.indexOf('(');
  return (parenIndex > 0 ? name.slice(0, parenIndex) : name).trim();
}

function buildSeoTitle(name, categorySlug) {
  const short = shortToolName(name);
  const category = CATEGORY_LABELS[categorySlug] || slugToTitle(categorySlug);
  const title = `${short} - Free Online ${category} Tool`;
  return title.length <= 60 ? title : `${short} - Free Online Tool`;
}

function buildSeoDescription(description, name, categorySlug) {
  const category = (CATEGORY_LABELS[categorySlug] || slugToTitle(categorySlug)).toLowerCase();
  const suffix = ' Free, fast, and private — runs in your browser on EasyToolHub.';
  const base = description.endsWith('.') ? description : `${description}.`;
  const withSuffix = `${base}${suffix}`;
  if (withSuffix.length <= 160) return withSuffix;

  const trimmed = `${shortToolName(name)} — free online ${category} tool.${suffix}`;
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157)}...`;
}

function buildKeywords(name, categorySlug, routePath, enrichmentKeywords) {
  return buildEnhancedKeywords(name, categorySlug, routePath, enrichmentKeywords);
}

function escapeTs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function generate() {
  const footerContent = fs.readFileSync(FOOTER_FILE, 'utf8');
  const textCatalogContent = fs.readFileSync(TEXT_CATALOG_FILE, 'utf8');
  const homepageContent = fs.readFileSync(HOMEPAGE_FILE, 'utf8');

  const prerenderRoutes = extractPrerenderRoutes();
  const toolsByCategory = extractRoutedTools();
  const descriptions = new Map();

  for (const [routePath, entry] of extractToolEntries(footerContent)) {
    descriptions.set(routePath, entry);
  }
  for (const [routePath, entry] of extractToolEntries(textCatalogContent)) {
    descriptions.set(routePath, entry);
  }
  for (const [routePath, entry] of extractToolEntries(homepageContent)) {
    const existing = descriptions.get(routePath);
    if (!existing || entry.description.length > existing.description.length) {
      descriptions.set(routePath, entry);
    }
  }

  const seoCatalog = {};
  const uiCategories = [];
  const homeEnrichment = getEnrichment('/tools/home');

  seoCatalog['/tools/home'] = {
    name: 'EasyToolHub',
    category: 'Home',
    categorySlug: 'home',
    title: homeEnrichment?.title || 'EasyToolHub - Free Online Tools for Everyone',
    description:
      homeEnrichment?.description ||
      'Discover 160+ free online tools for text editing, file conversion, PDF manipulation, image editing, security, and more. No signup required. Fast, secure, and privacy-focused.',
    keywords:
      homeEnrichment?.keywords ||
      'free online tools, text tools, file converter, PDF tools, image tools, developer tools, web tools, utility tools',
  };

  for (const [categorySlug, toolSlugs] of toolsByCategory) {
    const meta = CATEGORY_META[categorySlug] || {
      name: slugToTitle(categorySlug),
      description: `${slugToTitle(categorySlug)} tools`,
      faIcon: 'fas fa-wrench',
      materialIcon: 'build',
    };

    seoCatalog[`/${categorySlug}`] = {
      name: meta.name,
      category: meta.name,
      categorySlug,
      title: `${meta.name} - Free Online Tools`,
      description: buildSeoDescription(meta.description, meta.name, categorySlug),
      keywords: `${meta.name.toLowerCase()}, free online tools, easytoolhub, ${categorySlug.replace(/-/g, ' ')}`,
    };

    const subCategories = toolSlugs.map((toolSlug) => {
      const route = `/${categorySlug}/${toolSlug}`;
      const enrichment = getEnrichment(route);
      const entry = descriptions.get(route);
      const name = enrichment?.name || entry?.name || slugToTitle(toolSlug);
      const rawDescription =
        enrichment?.description ||
        entry?.description ||
        `Free online ${slugToTitle(toolSlug).toLowerCase()} — fast, private, and browser-based.`;
      const description = rawDescription.startsWith('Use our free online')
        ? enrichment?.description ||
          `Free online ${shortToolName(name).toLowerCase()} — fast, private, and browser-based.`
        : rawDescription;

      seoCatalog[route] = {
        name: shortToolName(name),
        category: meta.name,
        categorySlug,
        title: enrichment?.title || buildSeoTitle(name, categorySlug),
        description: enrichment?.description
          ? buildSeoDescription(enrichment.description, name, categorySlug)
          : buildSeoDescription(description, name, categorySlug),
        keywords: buildKeywords(name, categorySlug, route, enrichment?.keywords),
      };

      return {
        name,
        description,
        path: route,
      };
    });

    uiCategories.push({
      name: meta.name,
      description: meta.description,
      path: categorySlug,
      faIcon: meta.faIcon,
      materialIcon: meta.materialIcon,
      subCategories,
    });
  }

  writeSeoCatalog(seoCatalog);
  writeUiCatalog(uiCategories);
  writePrerenderRoutes(prerenderRoutes);

  const toolCount = Object.keys(seoCatalog).length - 1;
  const comingSoonCount = extractComingSoonPaths().length;
  console.log(`✅ Tool SEO catalog: ${SEO_OUTPUT}`);
  console.log(`✅ UI tools catalog: ${CATALOG_OUTPUT}`);
  console.log(`✅ Prerender routes: ${PRERENDER_ROUTES_OUTPUT}`);
  console.log(
    `   Categories: ${uiCategories.length}, routed tools: ${toolCount}, prerender URLs: ${prerenderRoutes.length}, coming-soon (noindex): ${comingSoonCount}`,
  );
}

function writeSeoCatalog(catalog) {
  const lines = [
    '// AUTO-GENERATED — do not edit manually.',
    '// Regenerate: node apps/tools-site/scripts/generate-tool-seo-catalog.js',
    '',
    'export interface ToolSeoEntry {',
    '  name: string;',
    '  category: string;',
    '  categorySlug: string;',
    '  title: string;',
    '  description: string;',
    '  keywords: string;',
    '}',
    '',
    'export const TOOL_SEO_CATALOG: Record<string, ToolSeoEntry> = {',
  ];

  for (const [route, entry] of Object.entries(catalog)) {
    lines.push(`  '${route}': {`);
    lines.push(`    name: '${escapeTs(entry.name)}',`);
    lines.push(`    category: '${escapeTs(entry.category)}',`);
    lines.push(`    categorySlug: '${escapeTs(entry.categorySlug)}',`);
    lines.push(`    title: '${escapeTs(entry.title)}',`);
    lines.push(`    description: '${escapeTs(entry.description)}',`);
    lines.push(`    keywords: '${escapeTs(entry.keywords)}',`);
    lines.push('  },');
  }

  lines.push('};', '');
  lines.push('/** Coming-soon placeholder routes — noindex; omitted from sitemap. */');
  lines.push('export const COMING_SOON_PATHS: readonly string[] = [');
  for (const route of extractComingSoonPaths()) {
    lines.push(`  '${escapeTs(route)}',`);
  }
  lines.push('];', '');
  fs.writeFileSync(SEO_OUTPUT, lines.join('\n'), 'utf8');
}

function writeUiCatalog(categories) {
  const lines = [
    '// AUTO-GENERATED — do not edit manually.',
    '// Regenerate: node apps/tools-site/scripts/generate-tool-seo-catalog.js',
    '',
    'export interface ToolCatalogEntry {',
    '  name: string;',
    '  description: string;',
    '  path: string;',
    '}',
    '',
    'export interface ToolCategoryCatalog {',
    '  name: string;',
    '  description: string;',
    '  path: string;',
    '  faIcon: string;',
    '  materialIcon: string;',
    '  subCategories: ToolCatalogEntry[];',
    '}',
    '',
    '/** Routed tools only — synced with app.routes.ts */',
    'export const TOOL_CATEGORIES: ToolCategoryCatalog[] = [',
  ];

  for (const category of categories) {
    lines.push('  {');
    lines.push(`    name: '${escapeTs(category.name)}',`);
    lines.push(`    description: '${escapeTs(category.description)}',`);
    lines.push(`    path: '${escapeTs(category.path)}',`);
    lines.push(`    faIcon: '${escapeTs(category.faIcon)}',`);
    lines.push(`    materialIcon: '${escapeTs(category.materialIcon)}',`);
    lines.push('    subCategories: [');
    for (const tool of category.subCategories) {
      lines.push('      {');
      lines.push(`        name: '${escapeTs(tool.name)}',`);
      lines.push(`        description: '${escapeTs(tool.description)}',`);
      lines.push(`        path: '${escapeTs(tool.path)}',`);
      lines.push('      },');
    }
    lines.push('    ],');
    lines.push('  },');
  }

  lines.push('];', '');
  fs.writeFileSync(CATALOG_OUTPUT, lines.join('\n'), 'utf8');
}

function writePrerenderRoutes(routes) {
  const cleaned = routes.map((route) => route.trim()).filter(Boolean);
  // No trailing newline: empty line would be treated as route "/".
  // Inventory for CI validation against dist/.../browser/**/index.html counts.
  fs.writeFileSync(PRERENDER_ROUTES_OUTPUT, cleaned.join('\n'), 'utf8');
}

generate();
