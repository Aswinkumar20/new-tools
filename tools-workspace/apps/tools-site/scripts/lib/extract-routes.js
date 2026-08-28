/**
 * Shared route extraction from app.routes.ts + category *.routes.ts
 */
const fs = require('fs');
const path = require('path');

const ROUTES_FILE = path.join(__dirname, '../../src/app/app.routes.ts');
const ROUTES_DIR = path.join(__dirname, '../../src/app/routes');

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
  'cad-viewers': {
    name: 'CAD & Engineering Viewers',
    description: 'Open DWG, DXF, STEP, IFC, and PCB files in the browser.',
    faIcon: 'fas fa-drafting-compass',
    materialIcon: 'architecture',
  },
  'gis-viewers': {
    name: 'GIS & Mapping Viewers',
    description: 'Explore GeoJSON, GPX, Shapefiles, and maps online.',
    faIcon: 'fas fa-map-marked-alt',
    materialIcon: 'map',
  },
  'medical-viewers': {
    name: 'Medical & Healthcare Viewers',
    description: 'DICOM, NIfTI, FHIR, and clinical file viewers.',
    faIcon: 'fas fa-notes-medical',
    materialIcon: 'medical_services',
  },
  'science-viewers': {
    name: 'Scientific Data Viewers',
    description: 'NetCDF, HDF5, FITS, seismic, and research datasets.',
    faIcon: 'fas fa-flask',
    materialIcon: 'science',
  },
  'network-viewers': {
    name: 'Network & Traffic Viewers',
    description: 'HAR, PCAP, and protocol analysis in the browser.',
    faIcon: 'fas fa-network-wired',
    materialIcon: 'lan',
  },
  'process-viewers': {
    name: 'Process & Workflow Viewers',
    description: 'BPMN, DMN, Petri nets, and process mining tools.',
    faIcon: 'fas fa-project-diagram',
    materialIcon: 'account_tree',
  },
  'diagram-viewers': {
    name: 'Diagram & Graph Viewers',
    description: 'Mermaid, PlantUML, Graphviz, UML, and mind maps.',
    faIcon: 'fas fa-sitemap',
    materialIcon: 'schema',
  },
  'data-explorers': {
    name: 'Data Explorers',
    description: 'Browse Parquet, Avro, SQLite, and columnar files.',
    faIcon: 'fas fa-table',
    materialIcon: 'table_chart',
  },
  'ml-viewers': {
    name: 'ML Model Viewers',
    description: 'Inspect ONNX and other ML model graphs.',
    faIcon: 'fas fa-brain',
    materialIcon: 'psychology',
  },
};

function readRoutesFile() {
  const chunks = [fs.readFileSync(ROUTES_FILE, 'utf8')];
  if (fs.existsSync(ROUTES_DIR)) {
    for (const name of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.routes.ts'))) {
      chunks.push(`\n/* ${name} */\n${fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8')}`);
    }
  }
  return chunks.join('\n');
}

/** Tools that use a real component but mark themselves as coming-soon placeholders. */
const EXTRA_COMING_SOON_PATHS = [
  '/file-viewers/video-player',
  '/media-tools/audio-trimmer',
  '/media-tools/video-to-gif',
  '/media-tools/webcam-snapshot',
];

function extractRoutedTools() {
  const toolsByCategory = new Map();
  if (!fs.existsSync(ROUTES_DIR)) {
    return toolsByCategory;
  }

  for (const name of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.routes.ts'))) {
    const slug = name.replace(/\.routes\.ts$/, '');
    if (slug === 'tools') continue;
    const src = fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8');
    const tools = [];
    const re = /path:\s*'([^']*)',(?:(?!\bpath:\s*')[\s\S])*?loadComponent:/g;
    let match;
    while ((match = re.exec(src))) {
      const toolPath = match[1];
      if (!toolPath || toolPath === '404') continue;
      tools.push(toolPath);
    }
    toolsByCategory.set(slug, tools);
  }

  return toolsByCategory;
}

/**
 * Routes that load ComingSoonPageComponent (thin placeholders — noindex / omit from sitemap).
 */
function extractComingSoonPaths() {
  const paths = new Set(EXTRA_COMING_SOON_PATHS);
  if (!fs.existsSync(ROUTES_DIR)) {
    return [...paths].sort();
  }

  for (const name of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.routes.ts'))) {
    const slug = name.replace(/\.routes\.ts$/, '');
    if (slug === 'tools') continue;
    const src = fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8');
    const re =
      /path:\s*'([^']*)',(?:(?!\bpath:\s*')[\s\S])*?ComingSoonPageComponent/g;
    let match;
    while ((match = re.exec(src))) {
      const toolPath = match[1];
      if (!toolPath || toolPath === '404') continue;
      paths.add(`/${slug}/${toolPath}`);
    }
  }

  return [...paths].sort();
}

function extractPrerenderRoutes() {
  const routes = ['/tools/home'];
  for (const [category, tools] of extractRoutedTools()) {
    routes.push(`/${category}`);
    for (const tool of tools) {
      routes.push(`/${category}/${tool}`);
    }
  }
  return [...new Set(routes)].sort();
}

/** Public sitemap routes — excludes coming-soon placeholders. */
function extractSitemapRoutes() {
  const comingSoon = new Set(extractComingSoonPaths());
  return extractPrerenderRoutes().filter((route) => !comingSoon.has(route));
}

function slugToTitle(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

module.exports = {
  ROUTES_FILE,
  ROUTES_DIR,
  CATEGORY_META,
  EXTRA_COMING_SOON_PATHS,
  readRoutesFile,
  extractRoutedTools,
  extractComingSoonPaths,
  extractPrerenderRoutes,
  extractSitemapRoutes,
  slugToTitle,
};
