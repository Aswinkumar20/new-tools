/**
 * Generate sitemap.xml from app.routes.ts
 * Run: node apps/tools-site/scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');
const { extractPrerenderRoutes } = require('./lib/extract-routes');

const baseUrl = 'https://easytoolhub.com';
const outputPath = path.join(__dirname, '../public/sitemap.xml');

const HIGH_PRIORITY_SLUGS = new Set([
  'character-counter',
  'json-formatter-beautifier-validator',
  'merge-pdfs',
  'split-pdfs',
  'compress-pdf',
  'pdf-viewer',
  'image-viewer',
  'hash-generator',
  'qr-code-generator',
  'unit-converter',
  'currency-converter',
  'csv-to-json-json-to-csv',
  'password-strength-checker',
  'random-password-generator',
  'image-resizer',
  'image-compressor',
  'color-picker',
  'base64-encode-and-decode',
]);

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getRouteMeta(routePath) {
  if (routePath === '/tools/home') {
    return { priority: 1.0, changefreq: 'daily' };
  }

  const slug = routePath.split('/').pop() || '';
  if (HIGH_PRIORITY_SLUGS.has(slug)) {
    return { priority: 0.9, changefreq: 'weekly' };
  }

  return { priority: 0.8, changefreq: 'weekly' };
}

function generateSitemap() {
  const routes = extractPrerenderRoutes();
  const lastmod = new Date().toISOString().split('T')[0];

  const xmlUrls = routes
    .map((routePath) => {
      const meta = getRouteMeta(routePath);
      return `  <url>
    <loc>${escapeXml(`${baseUrl}${routePath}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${meta.changefreq}</changefreq>
    <priority>${meta.priority}</priority>
  </url>`;
    })
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, sitemap, 'utf8');
  console.log(`✅ Sitemap generated successfully at ${outputPath}`);
  console.log(`   Total URLs: ${routes.length}`);
}

generateSitemap();
