/**
 * Hand-tuned names, descriptions, and keyword extras for SEO/catalog generation.
 * Used by generate-tool-seo-catalog.js — prefer this over generic slug fallbacks.
 */

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'or',
  'the',
  'to',
  'of',
  'for',
  'in',
  'on',
  'with',
  'from',
  'by',
  'at',
  'as',
  'is',
  'tool',
  'tools',
  'online',
  'free',
]);

/** Route path → { name?, description?, keywords? } */
const TOOL_ENRICHMENT = {
  '/tools/home': {
    title: 'EasyToolHub - Free Online Tools for Everyone',
    description:
      'Discover 160+ free online tools for text editing, PDF editing, file conversion, image tools, calculators, developer utilities, and security. No signup — fast, private, and browser-based.',
    keywords:
      'free online tools, online utilities, text tools, PDF tools, file converter, image tools, JSON formatter, developer tools, password generator, QR code generator, unit converter, hash generator, word counter, merge PDF, compress PDF, easytoolhub',
  },
  '/file-viewers/word-viewer': {
    name: 'Word Viewer',
    description: 'Open and preview DOCX Word documents in your browser without installing Office.',
    keywords: 'word viewer online, docx viewer, open word document online, microsoft word viewer',
  },
  '/file-viewers/powerpoint-viewer': {
    name: 'PowerPoint Viewer',
    description: 'Preview PPTX presentations online with slides, notes, and zoom controls.',
    keywords: 'powerpoint viewer online, pptx viewer, open powerpoint online, presentation viewer',
  },
  '/file-viewers/text-file-viewer': {
    name: 'Text File Viewer',
    description: 'Open TXT, LOG, and plain-text files with search, wrap, and encoding support.',
    keywords: 'text file viewer, txt viewer online, open text file, log file viewer',
  },
  '/file-viewers/3d-model-viewer': {
    name: '3D Model Viewer',
    description: 'Inspect GLB, GLTF, and other 3D models with orbit, zoom, and lighting controls.',
    keywords: '3d model viewer online, glb viewer, gltf viewer, 3d file viewer',
  },
  '/math-date-utils/number-to-words': {
    name: 'Number to Words Converter',
    description: 'Convert numbers into written words for checks, invoices, and documents.',
    keywords: 'number to words, numbers to words converter, convert number to text, cheque amount in words',
  },
  '/math-date-utils/bmi-calculator': {
    name: 'BMI Calculator',
    description: 'Calculate body mass index from height and weight with clear category results.',
    keywords: 'bmi calculator, body mass index calculator, calculate bmi online, bmi chart',
  },
  '/math-date-utils/fraction-calculator': {
    name: 'Fraction Calculator',
    description: 'Add, subtract, multiply, and divide fractions with simplified results.',
    keywords: 'fraction calculator, add fractions, simplify fractions, fraction solver',
  },
  '/math-date-utils/date-to-day-of-week': {
    name: 'Date to Day of Week',
    description: 'Find which weekday any date falls on — past, present, or future.',
    keywords: 'what day is this date, day of week calculator, date to weekday, calendar day finder',
  },
  '/pdf-tools/delete-pages': {
    name: 'Delete PDF Pages',
    description: 'Remove unwanted pages from a PDF instantly. Files stay private in your browser.',
    keywords: 'delete pdf pages, remove pages from pdf, pdf page remover, drop pdf pages',
  },
  '/pdf-tools/rotate-pages': {
    name: 'Rotate PDF Pages',
    description: 'Rotate PDF pages 90°, 180°, or 270° and save a corrected document.',
    keywords: 'rotate pdf, rotate pdf pages, fix sideways pdf, pdf page rotator',
  },
  '/pdf-tools/reorder-pages': {
    name: 'Reorder PDF Pages',
    description: 'Drag and rearrange PDF page order before downloading the new file.',
    keywords: 'reorder pdf pages, rearrange pdf, change pdf page order, organize pdf pages',
  },
  '/pdf-tools/extract-pages': {
    name: 'Extract PDF Pages',
    description: 'Pull selected pages into a new PDF without uploading to a server.',
    keywords: 'extract pdf pages, save pages from pdf, pdf page extractor, split pages from pdf',
  },
  '/pdf-tools/tables-charts-to-pdf': {
    name: 'Tables & Charts to PDF',
    description: 'Turn tables and charts into clean, printable PDF documents.',
    keywords: 'table to pdf, chart to pdf, export table pdf, convert chart to pdf',
  },
  '/pdf-tools/screenshot-to-pdf': {
    name: 'Screenshot to PDF',
    description: 'Convert screenshots and images into a multi-page PDF in seconds.',
    keywords: 'screenshot to pdf, image screenshot pdf, convert screenshot pdf',
  },
  '/pdf-tools/annotate-pdf': {
    name: 'Annotate PDF',
    description: 'Add notes, markup, and comments to PDF pages in your browser.',
    keywords: 'annotate pdf online, pdf markup, comment on pdf, pdf annotation tool',
  },
  '/pdf-tools/highlight-text': {
    name: 'Highlight PDF Text',
    description: 'Highlight important text in PDFs and export the marked-up file.',
    keywords: 'highlight pdf, pdf highlighter, mark text in pdf, highlight pdf online',
  },
  '/pdf-tools/add-signature': {
    name: 'Add Signature to PDF',
    description: 'Draw or upload a signature and place it on any PDF page.',
    keywords: 'sign pdf online, add signature to pdf, electronic signature pdf, pdf signer',
  },
  '/pdf-tools/pdf-metadata-editor': {
    name: 'PDF Metadata Editor',
    description: 'Edit PDF title, author, subject, and keywords without desktop software.',
    keywords: 'pdf metadata editor, edit pdf properties, pdf title author, change pdf metadata',
  },
  '/pdf-tools/pdf-to-base64': {
    name: 'PDF to Base64',
    description: 'Encode a PDF as Base64 for APIs, embeds, and data URLs — or decode back.',
    keywords: 'pdf to base64, encode pdf base64, base64 pdf converter, pdf data uri',
  },
  '/pdf-tools/flatten-pdf-forms': {
    name: 'Flatten PDF Forms',
    description: 'Flatten fillable PDF form fields into a non-editable document.',
    keywords: 'flatten pdf form, flatten pdf fields, make pdf non editable, pdf form flattener',
  },
  '/image-color-tools/image-to-text': {
    name: 'Image to Text (OCR)',
    description: 'Extract text from images with OCR — paste or upload and copy results.',
    keywords: 'image to text, ocr online, extract text from image, photo to text converter',
  },
  '/dev-design-tools/cors-test-tool': {
    name: 'CORS Test Tool',
    description: 'Test cross-origin request headers and CORS responses from any URL.',
    keywords: 'cors tester, cors test tool, check cors headers, cross origin test',
  },
  '/dev-design-tools/websocket-client': {
    name: 'WebSocket Client',
    description: 'Connect to WebSocket endpoints, send messages, and inspect responses live.',
    keywords: 'websocket client online, ws tester, websocket tester, socket.io client tool',
  },
  '/fun-tools/coin-toss-dice-roller': {
    name: 'Coin Toss & Dice Roller',
    description: 'Flip a coin or roll dice for quick random decisions and games.',
    keywords: 'coin toss online, dice roller, flip a coin, random dice roller',
  },
  '/fun-tools/lorem-ipsum-generator': {
    name: 'Lorem Ipsum Generator',
    description: 'Generate placeholder Lorem Ipsum paragraphs for mockups and wireframes.',
    keywords: 'lorem ipsum generator, placeholder text generator, dummy text, lipsum generator',
  },
};

/** Extra high-intent keyword phrases keyed by route (merged into generated keywords). */
const KEYWORD_EXTRAS = {
  '/text-utilities/character-counter':
    'word counter, character count, letter counter, sentence counter, reading time calculator',
  '/text-utilities/text-case-convertor':
    'uppercase converter, lowercase converter, title case, sentence case, camel case converter',
  '/text-utilities/base64-encode-and-decode':
    'base64 encoder, base64 decoder, encode base64 online, decode base64',
  '/text-utilities/url-encode-and-decode':
    'url encoder, url decoder, percent encode, decode url online',
  '/text-utilities/slug-generator': 'url slug generator, seo slug, permalink generator, slugify',
  '/text-utilities/regex-tester': 'regex tester online, regular expression tester, regex match',
  '/text-utilities/find-and-replace': 'find and replace online, text replace, regex replace',
  '/text-utilities/keyword-density': 'keyword density checker, seo keyword analyzer, word frequency',
  '/data-converters/json-formatter-beautifier-validator':
    'json formatter, json beautifier, json validator, pretty print json, json prettifier',
  '/data-converters/csv-to-json-json-to-csv': 'csv to json, json to csv, convert csv json',
  '/data-converters/yaml-to-json-json-to-yaml': 'yaml to json, json to yaml, yaml converter',
  '/pdf-tools/merge-pdfs': 'merge pdf, combine pdf, pdf merger, join pdf files',
  '/pdf-tools/split-pdfs': 'split pdf, pdf splitter, separate pdf pages',
  '/pdf-tools/compress-pdf': 'compress pdf, reduce pdf size, pdf compressor online',
  '/pdf-tools/pdf-viewer': 'pdf viewer online, view pdf in browser, free pdf reader',
  '/pdf-tools/password-protect-pdf': 'password protect pdf, encrypt pdf, lock pdf',
  '/pdf-tools/image-to-pdf': 'image to pdf, jpg to pdf, png to pdf, convert image pdf',
  '/security-tools/hash-generator': 'md5 hash, sha256 generator, sha512 hash, checksum calculator',
  '/security-tools/random-password-generator':
    'password generator, strong password, random password maker',
  '/security-tools/password-strength-checker': 'password strength meter, check password strength',
  '/security-tools/uuid-generator': 'uuid generator, guid generator, random uuid v4',
  '/fun-tools/qr-code-generator': 'qr code generator, create qr code, qr code maker',
  '/fun-tools/barcode-generator': 'barcode generator, create barcode online',
  '/math-date-utils/unit-converter': 'unit converter, metric converter, length weight converter',
  '/math-date-utils/currency-converter': 'currency converter, exchange rate calculator',
  '/math-date-utils/age-calculator': 'age calculator, calculate age from date of birth',
  '/math-date-utils/loan-emi-calculator': 'emi calculator, loan calculator, monthly emi',
  '/image-color-tools/image-resizer': 'image resizer, resize photo online, change image size',
  '/image-color-tools/image-compressor': 'image compressor, compress jpg, reduce image size',
  '/image-color-tools/color-picker': 'color picker, hex color picker, eyedropper tool',
  '/image-color-tools/hex-to-rgb': 'hex to rgb, rgb to hex, color converter',
  '/testing-tools/jwt-decoder': 'jwt decoder, decode jwt token, jwt debugger',
  '/code-file-tools/html-minifier': 'html minifier, minify html online',
  '/code-file-tools/css-minifier': 'css minifier, minify css online',
  '/code-file-tools/javascript-minifier': 'js minifier, minify javascript online',
  '/dev-design-tools/css-gradient-generator': 'css gradient generator, gradient maker',
  '/dev-design-tools/box-shadow-generator': 'box shadow generator, css box shadow',
  '/browser-utils/network-speed-test': 'internet speed test, network speed test, bandwidth test',
};

const CATEGORY_KEYWORD_HINTS = {
  'text-utilities': 'text tool, text editor online, string utility',
  'file-viewers': 'file viewer online, document viewer, open file in browser',
  'data-converters': 'data converter, format converter, json tools',
  'math-date-utils': 'calculator online, converter tool, math utility',
  'pdf-tools': 'pdf tool online, edit pdf free, pdf utility',
  'image-color-tools': 'image tool online, photo editor utility, color tool',
  'code-file-tools': 'code tool online, developer utility, minify tool',
  'dev-design-tools': 'web developer tool, css tool, api testing tool',
  'testing-tools': 'validator online, testing utility, format checker',
  'security-tools': 'security tool, crypto utility, encryption tool',
  'media-tools': 'audio tool online, video utility, media converter',
  'browser-utils': 'browser tool, system utility, web utility',
  'fun-tools': 'productivity tool, generator online, fun utility',
};

function uniqueKeywords(parts) {
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    const cleaned = String(part || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

function meaningfulSlugPhrases(slug) {
  const words = slug.split('-').filter((w) => w && !STOP_WORDS.has(w));
  const phrases = [];
  if (words.length) {
    phrases.push(words.join(' '));
  }
  // Keep useful 2-word combos from the slug (e.g. "merge pdf", "hash generator")
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }
  return phrases;
}

function buildEnhancedKeywords(name, categorySlug, routePath, enrichmentKeywords) {
  const short = name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase();
  const slug = routePath.split('/').pop() || '';
  const categoryHint = CATEGORY_KEYWORD_HINTS[categorySlug] || '';
  const extras = KEYWORD_EXTRAS[routePath] || '';

  const parts = [
    short,
    `${short} online`,
    `free ${short}`,
    ...meaningfulSlugPhrases(slug),
    ...categoryHint.split(',').map((s) => s.trim()),
    ...extras.split(',').map((s) => s.trim()),
    ...(enrichmentKeywords || '').split(',').map((s) => s.trim()),
    'free online tool',
    'no signup',
    'easytoolhub',
  ];

  return uniqueKeywords(parts).slice(0, 16).join(', ');
}

function getEnrichment(routePath) {
  return TOOL_ENRICHMENT[routePath] || null;
}

module.exports = {
  TOOL_ENRICHMENT,
  KEYWORD_EXTRAS,
  getEnrichment,
  buildEnhancedKeywords,
};
