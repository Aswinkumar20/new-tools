/**
 * Generate sitemap.xml for EasyToolHub
 * Run this script after building: node apps/tools-site/scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

const baseUrl = 'https://easytoolhub.com';
const outputPath = path.join(__dirname, '../public/sitemap.xml');

// All routes from the application
// Update this list when adding new routes
const routes = [
  // Home
  { path: '/tools/home', priority: 1.0, changefreq: 'daily' },
  
  // Text Utilities
  { path: '/text-utilities/character-counter', priority: 0.9, changefreq: 'weekly' },
  { path: '/text-utilities/text-case-convertor', priority: 0.8, changefreq: 'weekly' },
  { path: '/text-utilities/text-to-ascii', priority: 0.8, changefreq: 'weekly' },
  { path: '/text-utilities/remove-duplicate-lines', priority: 0.8, changefreq: 'weekly' },
  { path: '/text-utilities/text-reversal-and-palindrome-checker', priority: 0.8, changefreq: 'weekly' },
  { path: '/text-utilities/base64-encode-and-decode', priority: 0.9, changefreq: 'weekly' },
  { path: '/text-utilities/slug-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/text-utilities/text-difference', priority: 0.8, changefreq: 'weekly' },
  { path: '/text-utilities/code-merge', priority: 0.8, changefreq: 'weekly' },
  
  // File Viewers
  { path: '/file-viewers/image-viewer', priority: 0.9, changefreq: 'weekly' },
  { path: '/file-viewers/pdf-viewer', priority: 0.9, changefreq: 'weekly' },
  { path: '/file-viewers/word-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/powerpoint-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/text-file-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/markdown-previewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/excel-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/log-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/audio-player', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/video-player', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/font-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/3d-model-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/file-viewers/archive-viewer', priority: 0.8, changefreq: 'weekly' },
  
  // Data Converters
  { path: '/data-converters/json-formatter-beautifier-validator', priority: 0.9, changefreq: 'weekly' },
  { path: '/data-converters/csv-to-json-json-to-csv', priority: 0.9, changefreq: 'weekly' },
  { path: '/data-converters/yaml-to-json-json-to-yaml', priority: 0.8, changefreq: 'weekly' },
  { path: '/data-converters/html-table-to-json', priority: 0.8, changefreq: 'weekly' },
  { path: '/data-converters/markdown-to-html', priority: 0.8, changefreq: 'weekly' },
  { path: '/data-converters/json-linter-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/data-converters/excel-to-json', priority: 0.8, changefreq: 'weekly' },
  { path: '/data-converters/json-parser', priority: 0.8, changefreq: 'weekly' },
  
  // Math & Date Utils
  { path: '/math-date-utils/unit-converter', priority: 0.9, changefreq: 'weekly' },
  { path: '/math-date-utils/number-to-words', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/percentage-calculator', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/age-calculator', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/date-difference-calculator', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/simple-compound-interest-calculator', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/bmi-calculator', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/loan-emi-calculator', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/tip-calculator', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/currency-converter', priority: 0.9, changefreq: 'weekly' },
  { path: '/math-date-utils/fraction-calculator', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/date-to-day-of-week', priority: 0.8, changefreq: 'weekly' },
  { path: '/math-date-utils/zodiac-finder', priority: 0.8, changefreq: 'weekly' },
  
  // PDF Tools
  { path: '/pdf-tools/pdf-viewer', priority: 0.9, changefreq: 'weekly' },
  { path: '/pdf-tools/merge-pdfs', priority: 0.9, changefreq: 'weekly' },
  { path: '/pdf-tools/split-pdfs', priority: 0.9, changefreq: 'weekly' },
  { path: '/pdf-tools/delete-pages', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/rotate-pages', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/reorder-pages', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/extract-pages', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/compress-pdf', priority: 0.9, changefreq: 'weekly' },
  { path: '/pdf-tools/create-pdf-from-html', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/tables-charts-to-pdf', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/resume-invoice-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/text-to-pdf', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/screenshot-to-pdf', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/annotate-pdf', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/highlight-text', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/add-signature', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/fill-pdf-forms', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/pdf-metadata-editor', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/add-watermark', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/pdf-to-base64', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/password-protect-pdf', priority: 0.8, changefreq: 'weekly' },
  { path: '/pdf-tools/flatten-pdf-forms', priority: 0.8, changefreq: 'weekly' },
  
  // Image & Color Tools
  { path: '/image-color-tools/image-to-base64', priority: 0.8, changefreq: 'weekly' },
  { path: '/image-color-tools/image-resizer', priority: 0.9, changefreq: 'weekly' },
  { path: '/image-color-tools/image-compressor', priority: 0.9, changefreq: 'weekly' },
  { path: '/image-color-tools/color-picker', priority: 0.9, changefreq: 'weekly' },
  { path: '/image-color-tools/hex-to-rgb', priority: 0.8, changefreq: 'weekly' },
  { path: '/image-color-tools/gradient-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/image-color-tools/palette-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/image-color-tools/image-to-text', priority: 0.8, changefreq: 'weekly' },
  { path: '/image-color-tools/favicon-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/image-color-tools/drawing-pad', priority: 0.8, changefreq: 'weekly' },
  
  // Code & File Tools
  { path: '/code-file-tools/html-minifier', priority: 0.8, changefreq: 'weekly' },
  { path: '/code-file-tools/css-minifier', priority: 0.8, changefreq: 'weekly' },
  { path: '/code-file-tools/javascript-minifier', priority: 0.8, changefreq: 'weekly' },
  { path: '/code-file-tools/html-entity-encoder', priority: 0.8, changefreq: 'weekly' },
  { path: '/code-file-tools/clipboard-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/code-file-tools/clipboard-history', priority: 0.8, changefreq: 'weekly' },
  { path: '/code-file-tools/file-metadata-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/code-file-tools/markdown-to-pdf', priority: 0.8, changefreq: 'weekly' },
  { path: '/code-file-tools/html-table-exporter', priority: 0.8, changefreq: 'weekly' },
  
  // Dev & Design Tools
  { path: '/dev-design-tools/css-gradient-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/box-shadow-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/border-radius-preview', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/pixel-to-rem', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/responsive-breakpoint-tester', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/viewport-size-detector', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/postman-lite', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/cors-test-tool', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/http-header-decoder', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/websocket-client', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/http-request-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/dev-design-tools/mock-json-generator', priority: 0.8, changefreq: 'weekly' },
  
  // Testing Tools
  { path: '/testing-tools/json-schema-validator', priority: 0.8, changefreq: 'weekly' },
  { path: '/testing-tools/password-rule-validator', priority: 0.8, changefreq: 'weekly' },
  { path: '/testing-tools/email-url-ip-checker', priority: 0.8, changefreq: 'weekly' },
  { path: '/testing-tools/user-agent-parser', priority: 0.8, changefreq: 'weekly' },
  { path: '/testing-tools/credit-card-validator', priority: 0.8, changefreq: 'weekly' },
  { path: '/testing-tools/jwt-decoder', priority: 0.8, changefreq: 'weekly' },
  
  // Security Tools
  { path: '/security-tools/hash-generator', priority: 0.9, changefreq: 'weekly' },
  { path: '/security-tools/uuid-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/security-tools/password-strength-checker', priority: 0.9, changefreq: 'weekly' },
  { path: '/security-tools/random-password-generator', priority: 0.9, changefreq: 'weekly' },
  { path: '/security-tools/text-encrypt-decrypt', priority: 0.8, changefreq: 'weekly' },
  { path: '/security-tools/secure-clipboard', priority: 0.8, changefreq: 'weekly' },
  { path: '/security-tools/private-notes', priority: 0.8, changefreq: 'weekly' },
  
  // Media Tools
  { path: '/media-tools/voice-recorder', priority: 0.8, changefreq: 'weekly' },
  { path: '/media-tools/audio-player', priority: 0.8, changefreq: 'weekly' },
  { path: '/media-tools/audio-trimmer', priority: 0.8, changefreq: 'weekly' },
  { path: '/media-tools/video-to-gif', priority: 0.8, changefreq: 'weekly' },
  { path: '/media-tools/webcam-snapshot', priority: 0.8, changefreq: 'weekly' },
  
  // Browser Utils
  { path: '/browser-utils/screen-resolution-info', priority: 0.8, changefreq: 'weekly' },
  { path: '/browser-utils/battery-status-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/browser-utils/device-orientation-logger', priority: 0.8, changefreq: 'weekly' },
  { path: '/browser-utils/storage-viewer', priority: 0.8, changefreq: 'weekly' },
  { path: '/browser-utils/cookie-editor', priority: 0.8, changefreq: 'weekly' },
  { path: '/browser-utils/network-speed-test', priority: 0.8, changefreq: 'weekly' },
  
  // Fun Tools
  { path: '/fun-tools/qr-code-generator', priority: 0.9, changefreq: 'weekly' },
  { path: '/fun-tools/barcode-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/stopwatch-timer', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/random-number-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/coin-toss-dice-roller', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/lorem-ipsum-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/timezone-converter', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/typing-speed-test', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/pomodoro-timer', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/flashcard-quiz-generator', priority: 0.8, changefreq: 'weekly' },
  { path: '/fun-tools/motivational-quote-generator', priority: 0.8, changefreq: 'weekly' },
];

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemap() {
  const lastmod = new Date().toISOString().split('T')[0];
  
  const xmlUrls = routes
    .map(
      (route) => `  <url>
    <loc>${escapeXml(`${baseUrl}${route.path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq || 'weekly'}</changefreq>
    <priority>${route.priority || 0.8}</priority>
  </url>`
    )
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, sitemap, 'utf8');
  console.log(`✅ Sitemap generated successfully at ${outputPath}`);
  console.log(`   Total URLs: ${routes.length}`);
}

generateSitemap();

