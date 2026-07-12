/**
 * Shared route extraction from app.routes.ts
 */
const fs = require('fs');
const path = require('path');

const ROUTES_FILE = path.join(__dirname, '../../src/app/app.routes.ts');

const CATEGORY_META = {
  'text-utilities': {
    name: 'Text & Utilities',
    description: 'Tools for text manipulation and utilities',
    faIcon: 'fas fa-font',
    materialIcon: 'text_fields',
  },
  'file-viewers': {
    name: 'File Viewers',
    description: 'Easily open, preview, and explore different file types directly in your browser.',
    faIcon: 'fas fa-file-alt',
    materialIcon: 'insert_drive_file',
  },
  'data-converters': {
    name: 'JSON / Data Converters',
    description: 'Tools to convert, format, and validate JSON and data formats',
    faIcon: 'fas fa-database',
    materialIcon: 'data_object',
  },
  'math-date-utils': {
    name: 'Number & Date Tools',
    description: 'Calculators, converters, and date utilities',
    faIcon: 'fas fa-calculator',
    materialIcon: 'calculate',
  },
  'pdf-tools': {
    name: 'PDF Tools',
    description: 'View, edit, generate, and secure PDFs',
    faIcon: 'fas fa-file-pdf',
    materialIcon: 'picture_as_pdf',
  },
  'image-color-tools': {
    name: 'Image & Color Tools',
    description: 'Image manipulation and color utilities',
    faIcon: 'fas fa-palette',
    materialIcon: 'palette',
  },
  'code-file-tools': {
    name: 'File & Code Tools',
    description: 'Code formatting and file utilities',
    faIcon: 'fas fa-code',
    materialIcon: 'code',
  },
  'dev-design-tools': {
    name: 'Design & Web Dev Tools',
    description: 'CSS tools, responsive design helpers, and web dev utilities',
    faIcon: 'fas fa-laptop-code',
    materialIcon: 'developer_mode',
  },
  'testing-tools': {
    name: 'Validation & Testing Tools',
    description: 'Validators and testing utilities',
    faIcon: 'fas fa-check-circle',
    materialIcon: 'rule',
  },
  'security-tools': {
    name: 'Security & Crypto Tools',
    description: 'Hashing, encryption, and secure utilities',
    faIcon: 'fas fa-lock',
    materialIcon: 'lock',
  },
  'media-tools': {
    name: 'Media & Audio Tools',
    description: 'Audio, video, and media utilities',
    faIcon: 'fas fa-music',
    materialIcon: 'music_note',
  },
  'browser-utils': {
    name: 'System / Browser Utilities',
    description: 'System information and browser tools',
    faIcon: 'fas fa-desktop',
    materialIcon: 'computer',
  },
  'fun-tools': {
    name: 'Fun & Productivity Tools',
    description: 'Entertainment and productivity helpers',
    faIcon: 'fas fa-gamepad',
    materialIcon: 'sports_esports',
  },
};

function readRoutesFile() {
  return fs.readFileSync(ROUTES_FILE, 'utf8');
}

function extractRoutedTools(content = readRoutesFile()) {
  const toolsByCategory = new Map();
  const lines = content.split('\n');
  let currentCategory = null;

  for (let i = 0; i < lines.length; i++) {
    const nextLines = lines.slice(i, i + 6);
    const catMatch = lines[i].match(/^\s*path:\s*'([^']+)',\s*$/);
    if (catMatch && lines[i + 1]?.includes('children:')) {
      const cat = catMatch[1];
      if (cat !== 'tools' && cat !== '**') {
        currentCategory = cat;
        if (!toolsByCategory.has(cat)) {
          toolsByCategory.set(cat, []);
        }
      }
      continue;
    }

    const toolMatch = lines[i].match(/^\s*path:\s*'([^']+)',\s*$/);
    if (toolMatch && currentCategory && nextLines.some((l) => l.includes('loadComponent'))) {
      toolsByCategory.get(currentCategory).push(toolMatch[1]);
    }
  }

  return toolsByCategory;
}

function extractPrerenderRoutes(content = readRoutesFile()) {
  const routes = ['/tools/home'];
  for (const [category, tools] of extractRoutedTools(content)) {
    for (const tool of tools) {
      routes.push(`/${category}/${tool}`);
    }
  }
  return [...new Set(routes)].sort();
}

function slugToTitle(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

module.exports = {
  ROUTES_FILE,
  CATEGORY_META,
  readRoutesFile,
  extractRoutedTools,
  extractPrerenderRoutes,
  slugToTitle,
};
