// AUTO-GENERATED — do not edit manually.
// Regenerate: node apps/tools-site/scripts/generate-tool-seo-catalog.js

export interface ToolCatalogEntry {
  name: string;
  description: string;
  path: string;
}

export interface ToolCategoryCatalog {
  name: string;
  description: string;
  path: string;
  faIcon: string;
  materialIcon: string;
  subCategories: ToolCatalogEntry[];
}

/** Routed tools only — synced with app.routes.ts */
export const TOOL_CATEGORIES: ToolCategoryCatalog[] = [
  {
    name: 'Text & Utilities',
    description: 'Tools for text manipulation and utilities',
    path: 'text-utilities',
    faIcon: 'fas fa-font',
    materialIcon: 'text_fields',
    subCategories: [
      {
        name: 'Word & Character Counter',
        description: 'Measure characters, words, reading time, and more in real time.',
        path: '/text-utilities/character-counter',
      },
      {
        name: 'Text Case Converter',
        description: 'Switch text between lowercase, uppercase, sentence case, or custom formats.',
        path: '/text-utilities/text-case-convertor',
      },
      {
        name: 'Text to ASCII Converter',
        description: 'Transform any text into ASCII codes for encoding or debugging.',
        path: '/text-utilities/text-to-ascii',
      },
      {
        name: 'Remove Duplicate Lines',
        description: 'Clean up repeated lines from pasted text while keeping order intact.',
        path: '/text-utilities/remove-duplicate-lines',
      },
      {
        name: 'Reverse Text & Palindrome Checker',
        description: 'Flip strings instantly and verify whether phrases read the same both ways.',
        path: '/text-utilities/text-reversal-and-palindrome-checker',
      },
      {
        name: 'Base64 Encode & Decode',
        description: 'Encode files or strings to Base64 and decode them back effortlessly.',
        path: '/text-utilities/base64-encode-and-decode',
      },
      {
        name: 'Slug Generator',
        description: 'Convert titles into clean, SEO-friendly URL slugs with smart formatting.',
        path: '/text-utilities/slug-generator',
      },
      {
        name: 'Text Difference Checker',
        description: 'Compare two blocks of text and highlight additions, removals, or edits.',
        path: '/text-utilities/text-difference',
      },
      {
        name: 'Code Merge',
        description: 'Merge and reconcile code snippets with a clear diff-aware editor.',
        path: '/text-utilities/code-merge',
      },
      {
        name: 'URL Encode & Decode',
        description: 'Percent-encode or decode URL strings, query values, and Unicode text.',
        path: '/text-utilities/url-encode-and-decode',
      },
      {
        name: 'Unicode Escape & Unescape',
        description: 'Convert text to \\\\uXXXX escape sequences and back for debugging.',
        path: '/text-utilities/unicode-escape-unescape',
      },
      {
        name: 'HTML Tag Stripper',
        description: 'Remove HTML markup and get clean plain text instantly.',
        path: '/text-utilities/html-tag-stripper',
      },
      {
        name: 'Sort Lines',
        description: 'Sort lines alphabetically, by length, or numerically.',
        path: '/text-utilities/sort-lines',
      },
      {
        name: 'Trim & Normalize Whitespace',
        description: 'Trim lines, collapse spaces, and remove empty lines.',
        path: '/text-utilities/trim-normalize-whitespace',
      },
      {
        name: 'Find & Replace',
        description: 'Search and replace text with plain or regex patterns.',
        path: '/text-utilities/find-and-replace',
      },
      {
        name: 'Line Number Tool',
        description: 'Add or remove line numbers from any text block.',
        path: '/text-utilities/line-number-tool',
      },
      {
        name: 'Split & Join Text',
        description: 'Split by delimiter or join lines with a custom separator.',
        path: '/text-utilities/split-join-text',
      },
      {
        name: 'Regex Tester',
        description: 'Test regular expressions and view matches in real time.',
        path: '/text-utilities/regex-tester',
      },
      {
        name: 'Text Similarity Checker',
        description: 'Compare two strings with Levenshtein distance and similarity score.',
        path: '/text-utilities/text-similarity',
      },
      {
        name: 'Invisible Character Detector',
        description: 'Find zero-width spaces and hidden Unicode characters.',
        path: '/text-utilities/invisible-character-detector',
      },
      {
        name: 'Word Wrap & Unwrap',
        description: 'Wrap text at a column width or unwrap hard line breaks.',
        path: '/text-utilities/word-wrap-unwrap',
      },
      {
        name: 'Extract Emails & URLs',
        description: 'Pull email addresses and links from any text blob.',
        path: '/text-utilities/extract-emails-urls',
      },
      {
        name: 'JSON String Escape & Unescape',
        description: 'Escape or unescape strings for safe JSON embedding.',
        path: '/text-utilities/json-string-escape-unescape',
      },
      {
        name: 'Hex Encode & Decode',
        description: 'Convert text to hexadecimal and decode hex to text.',
        path: '/text-utilities/hex-encode-decode',
      },
      {
        name: 'ROT13 & Caesar Cipher',
        description: 'Apply ROT13 or custom Caesar cipher shifts to text.',
        path: '/text-utilities/rot13-cipher',
      },
      {
        name: 'Binary Text Converter',
        description: 'Convert text to binary and decode binary back to text.',
        path: '/text-utilities/binary-text-converter',
      },
      {
        name: 'Morse Code Converter',
        description: 'Encode text to Morse code and decode it back.',
        path: '/text-utilities/morse-code-converter',
      },
      {
        name: 'Readability Analyzer',
        description: 'Get Flesch Reading Ease and grade-level scores for any text.',
        path: '/text-utilities/readability-analyzer',
      },
      {
        name: 'Keyword Density Checker',
        description: 'Analyze word frequency and keyword density for SEO.',
        path: '/text-utilities/keyword-density',
      },
      {
        name: 'Pako Compress & Decompress',
        description: 'Compress or decompress text with zlib deflate, raw deflate, or gzip.',
        path: '/text-utilities/pako-encode-and-decode',
      },
    ],
  },
  {
    name: 'File Viewers',
    description: 'Easily open, preview, and explore different file types directly in your browser.',
    path: 'file-viewers',
    faIcon: 'fas fa-file-alt',
    materialIcon: 'insert_drive_file',
    subCategories: [
      {
        name: 'Image Viewer',
        description: 'Preview formats from PNG to WebP without plugins.',
        path: '/file-viewers/image-viewer',
      },
      {
        name: 'PDF Viewer',
        description: 'Navigate documents with tabs, outlines, and zoom.',
        path: '/file-viewers/pdf-viewer',
      },
      {
        name: 'Word Viewer',
        description: 'Open and preview DOCX Word documents in your browser without installing Office.',
        path: '/file-viewers/word-viewer',
      },
      {
        name: 'PowerPoint Viewer',
        description: 'Preview PPTX presentations online with slides, notes, and zoom controls.',
        path: '/file-viewers/powerpoint-viewer',
      },
      {
        name: 'Text File Viewer',
        description: 'Open TXT, LOG, and plain-text files with search, wrap, and encoding support.',
        path: '/file-viewers/text-file-viewer',
      },
      {
        name: 'Markdown Previewer',
        description: 'Check headings, code blocks, and typography fast.',
        path: '/file-viewers/markdown-previewer',
      },
      {
        name: 'Excel Viewer',
        description: 'Inspect spreadsheet cells, formulas, and sheets.',
        path: '/file-viewers/excel-viewer',
      },
      {
        name: 'Log Viewer',
        description: 'Search and filter large logs in the browser.',
        path: '/file-viewers/log-viewer',
      },
      {
        name: 'Audio Player',
        description: 'Stream and scrub audio files instantly.',
        path: '/file-viewers/audio-player',
      },
      {
        name: 'Video Player',
        description: 'Review MP4, WEBM, and more with custom controls.',
        path: '/file-viewers/video-player',
      },
      {
        name: 'Font Viewer',
        description: 'Audit glyph sets before you embed fonts.',
        path: '/file-viewers/font-viewer',
      },
      {
        name: '3D Model Viewer',
        description: 'Inspect GLB, GLTF, and other 3D models with orbit, zoom, and lighting controls.',
        path: '/file-viewers/3d-model-viewer',
      },
      {
        name: 'Archive Viewer',
        description: 'Peek inside ZIP and TAR archives without extracting.',
        path: '/file-viewers/archive-viewer',
      },
    ],
  },
  {
    name: 'JSON / Data Converters',
    description: 'Tools to convert, format, and validate JSON and data formats',
    path: 'data-converters',
    faIcon: 'fas fa-database',
    materialIcon: 'data_object',
    subCategories: [
      {
        name: 'JSON Formatter & Validator',
        description: 'Beautify, validate, and explore structured payloads effortlessly.',
        path: '/data-converters/json-formatter-beautifier-validator',
      },
      {
        name: 'CSV ↔ JSON',
        description: 'Switch between spreadsheets and APIs instantly.',
        path: '/data-converters/csv-to-json-json-to-csv',
      },
      {
        name: 'YAML ↔ JSON',
        description: 'Keep configuration files in sync across systems.',
        path: '/data-converters/yaml-to-json-json-to-yaml',
      },
      {
        name: 'HTML Table → JSON',
        description: 'Turn tabular content into structured objects.',
        path: '/data-converters/html-table-to-json',
      },
      {
        name: 'Markdown → HTML',
        description: 'Publish-ready markup from clean Markdown.',
        path: '/data-converters/markdown-to-html',
      },
      {
        name: 'JSON Linter Viewer',
        description: 'Surface syntax errors with contextual guidance.',
        path: '/data-converters/json-linter-viewer',
      },
      {
        name: 'Excel → JSON',
        description: 'Upload spreadsheets and export structured data.',
        path: '/data-converters/excel-to-json',
      },
      {
        name: 'JSON Parser & Explorer',
        description: 'Navigate nested structures with a live tree view.',
        path: '/data-converters/json-parser',
      },
    ],
  },
  {
    name: 'Number & Date Tools',
    description: 'Calculators, converters, and date utilities',
    path: 'math-date-utils',
    faIcon: 'fas fa-calculator',
    materialIcon: 'calculate',
    subCategories: [
      {
        name: 'Unit Converter',
        description: 'Go between metric, imperial, and scientific units quickly.',
        path: '/math-date-utils/unit-converter',
      },
      {
        name: 'Number to Words Converter',
        description: 'Convert numbers into written words for checks, invoices, and documents.',
        path: '/math-date-utils/number-to-words',
      },
      {
        name: 'Percentage Calculator',
        description: 'Solve increase, decrease, and proportion questions.',
        path: '/math-date-utils/percentage-calculator',
      },
      {
        name: 'Age Calculator',
        description: 'Compute birthdays and anniversaries accurately.',
        path: '/math-date-utils/age-calculator',
      },
      {
        name: 'Date Difference',
        description: 'Count days, weeks, or months between key events.',
        path: '/math-date-utils/date-difference-calculator',
      },
      {
        name: 'Simple & Compound Interest',
        description: 'Model returns across time horizons.',
        path: '/math-date-utils/simple-compound-interest-calculator',
      },
      {
        name: 'BMI Calculator',
        description: 'Calculate body mass index from height and weight with clear category results.',
        path: '/math-date-utils/bmi-calculator',
      },
      {
        name: 'Loan EMI Calculator',
        description: 'Project repayments for mortgages and loans.',
        path: '/math-date-utils/loan-emi-calculator',
      },
      {
        name: 'Tip Calculator',
        description: 'Split bills fairly with friends or teams.',
        path: '/math-date-utils/tip-calculator',
      },
      {
        name: 'Currency Converter',
        description: 'Check live conversion rates for common currencies.',
        path: '/math-date-utils/currency-converter',
      },
      {
        name: 'Fraction Calculator',
        description: 'Add, subtract, multiply, and divide fractions with simplified results.',
        path: '/math-date-utils/fraction-calculator',
      },
      {
        name: 'Date to Day of Week',
        description: 'Find which weekday any date falls on — past, present, or future.',
        path: '/math-date-utils/date-to-day-of-week',
      },
      {
        name: 'Zodiac Finder',
        description: 'Discover astrological signs from any date.',
        path: '/math-date-utils/zodiac-finder',
      },
    ],
  },
  {
    name: 'PDF Tools',
    description: 'View, edit, generate, and secure PDFs',
    path: 'pdf-tools',
    faIcon: 'fas fa-file-pdf',
    materialIcon: 'picture_as_pdf',
    subCategories: [
      {
        name: 'PDF Studio',
        description: 'View, edit, and optimise PDF documents end-to-end.',
        path: '/pdf-tools/pdf-viewer',
      },
      {
        name: 'Merge PDFs',
        description: 'Combine files into a single deliverable.',
        path: '/pdf-tools/merge-pdfs',
      },
      {
        name: 'Split PDFs',
        description: 'Extract specific ranges into new documents.',
        path: '/pdf-tools/split-pdfs',
      },
      {
        name: 'Delete PDF Pages',
        description: 'Remove unwanted pages from a PDF instantly. Files stay private in your browser.',
        path: '/pdf-tools/delete-pages',
      },
      {
        name: 'Rotate PDF Pages',
        description: 'Rotate PDF pages 90°, 180°, or 270° and save a corrected document.',
        path: '/pdf-tools/rotate-pages',
      },
      {
        name: 'Reorder PDF Pages',
        description: 'Drag and rearrange PDF page order before downloading the new file.',
        path: '/pdf-tools/reorder-pages',
      },
      {
        name: 'Extract PDF Pages',
        description: 'Pull selected pages into a new PDF without uploading to a server.',
        path: '/pdf-tools/extract-pages',
      },
      {
        name: 'Compress PDF',
        description: 'Reduce file size for quicker sharing.',
        path: '/pdf-tools/compress-pdf',
      },
      {
        name: 'Create PDF from HTML',
        description: 'Export responsive pages into accessible PDFs.',
        path: '/pdf-tools/create-pdf-from-html',
      },
      {
        name: 'Tables & Charts to PDF',
        description: 'Turn tables and charts into clean, printable PDF documents.',
        path: '/pdf-tools/tables-charts-to-pdf',
      },
      {
        name: 'Resume & Invoice Generator',
        description: 'Build professional docs with guided templates.',
        path: '/pdf-tools/resume-invoice-generator',
      },
      {
        name: 'Text to PDF',
        description: 'Convert plain text into a formatted PDF document.',
        path: '/pdf-tools/text-to-pdf',
      },
      {
        name: 'Screenshot to PDF',
        description: 'Convert screenshots and images into a multi-page PDF in seconds.',
        path: '/pdf-tools/screenshot-to-pdf',
      },
      {
        name: 'Annotate PDF',
        description: 'Add notes, markup, and comments to PDF pages in your browser.',
        path: '/pdf-tools/annotate-pdf',
      },
      {
        name: 'Highlight PDF Text',
        description: 'Highlight important text in PDFs and export the marked-up file.',
        path: '/pdf-tools/highlight-text',
      },
      {
        name: 'Add Signature to PDF',
        description: 'Draw or upload a signature and place it on any PDF page.',
        path: '/pdf-tools/add-signature',
      },
      {
        name: 'Fill PDF Forms',
        description: 'Complete form fields and save persistently.',
        path: '/pdf-tools/fill-pdf-forms',
      },
      {
        name: 'PDF Metadata Editor',
        description: 'Edit PDF title, author, subject, and keywords without desktop software.',
        path: '/pdf-tools/pdf-metadata-editor',
      },
      {
        name: 'Add Watermark',
        description: 'Brand documents before distribution.',
        path: '/pdf-tools/add-watermark',
      },
      {
        name: 'PDF to Base64',
        description: 'Encode a PDF as Base64 for APIs, embeds, and data URLs — or decode back.',
        path: '/pdf-tools/pdf-to-base64',
      },
      {
        name: 'PDF Password Protect',
        description: 'Lock sensitive documents before you share them.',
        path: '/pdf-tools/password-protect-pdf',
      },
      {
        name: 'Flatten PDF Forms',
        description: 'Flatten fillable PDF form fields into a non-editable document.',
        path: '/pdf-tools/flatten-pdf-forms',
      },
      {
        name: 'HTML to PDF',
        description: 'Render HTML with styles and export a print-ready PDF.',
        path: '/pdf-tools/html-to-pdf',
      },
      {
        name: 'Tables to PDF',
        description: 'Export editable tables into formatted PDF documents.',
        path: '/pdf-tools/tables-to-pdf',
      },
      {
        name: 'Charts to PDF',
        description: 'Preview charts and export them to PDF.',
        path: '/pdf-tools/charts-to-pdf',
      },
      {
        name: 'Resume Generator',
        description: 'Build a professional resume PDF from structured fields.',
        path: '/pdf-tools/resume-generator',
      },
      {
        name: 'Invoice Generator',
        description: 'Create invoices with line items, tax, and totals.',
        path: '/pdf-tools/invoice-generator',
      },
      {
        name: 'Image to PDF',
        description: 'Combine multiple images into a single PDF.',
        path: '/pdf-tools/image-to-pdf',
      },
      {
        name: 'Add Page Numbers',
        description: 'Stamp page numbers with custom position and format.',
        path: '/pdf-tools/add-page-numbers',
      },
      {
        name: 'Barcode to PDF',
        description: 'Generate a barcode inside a PDF document.',
        path: '/pdf-tools/barcode-to-pdf',
      },
      {
        name: 'QR Code to PDF',
        description: 'Generate a QR code inside a PDF document.',
        path: '/pdf-tools/qr-code-to-pdf',
      },
    ],
  },
  {
    name: 'Image & Color Tools',
    description: 'Image manipulation and color utilities',
    path: 'image-color-tools',
    faIcon: 'fas fa-palette',
    materialIcon: 'palette',
    subCategories: [
      {
        name: 'Image to Base64',
        description: 'Convert images to embeddable Base64 strings.',
        path: '/image-color-tools/image-to-base64',
      },
      {
        name: 'Image Resizer',
        description: 'Crop and scale assets with pixel-perfect control.',
        path: '/image-color-tools/image-resizer',
      },
      {
        name: 'Image Compressor',
        description: 'Optimise supporting media before publishing.',
        path: '/image-color-tools/image-compressor',
      },
      {
        name: 'Color Picker',
        description: 'Sample, harmonise, and store brand colours.',
        path: '/image-color-tools/color-picker',
      },
      {
        name: 'HEX ↔ RGB',
        description: 'Translate colour models instantly.',
        path: '/image-color-tools/hex-to-rgb',
      },
      {
        name: 'Gradient Generator',
        description: 'Design smooth gradients with CSS output.',
        path: '/image-color-tools/gradient-generator',
      },
      {
        name: 'Palette Generator',
        description: 'Build colour systems from images and inspiration shots.',
        path: '/image-color-tools/palette-generator',
      },
      {
        name: 'Image to Text (OCR)',
        description: 'Extract text from images with OCR — paste or upload and copy results.',
        path: '/image-color-tools/image-to-text',
      },
      {
        name: 'Favicon Generator',
        description: 'Create multi-size favicons and manifest icons.',
        path: '/image-color-tools/favicon-generator',
      },
      {
        name: 'Drawing Pad',
        description: 'Sketch UI ideas or annotate screenshots.',
        path: '/image-color-tools/drawing-pad',
      },
    ],
  },
  {
    name: 'File & Code Tools',
    description: 'Code formatting and file utilities',
    path: 'code-file-tools',
    faIcon: 'fas fa-code',
    materialIcon: 'code',
    subCategories: [
      {
        name: 'HTML Minifier',
        description: 'Reduce file size with whitespace-aware minification.',
        path: '/code-file-tools/html-minifier',
      },
      {
        name: 'CSS Minifier',
        description: 'Optimise stylesheets for production deployments.',
        path: '/code-file-tools/css-minifier',
      },
      {
        name: 'JavaScript Minifier',
        description: 'Compress scripts without breaking behaviour.',
        path: '/code-file-tools/javascript-minifier',
      },
      {
        name: 'HTML Entity Encoder',
        description: 'Escape HTML entities for safer rendering.',
        path: '/code-file-tools/html-entity-encoder',
      },
      {
        name: 'Clipboard Viewer',
        description: 'Inspect text, HTML, and images stored in your clipboard.',
        path: '/code-file-tools/clipboard-viewer',
      },
      {
        name: 'Clipboard History',
        description: 'Keep multiple snippets ready for reuse.',
        path: '/code-file-tools/clipboard-history',
      },
      {
        name: 'File Metadata Viewer',
        description: 'Understand file fingerprints right inside the browser.',
        path: '/code-file-tools/file-metadata-viewer',
      },
      {
        name: 'Markdown to PDF',
        description: 'Turn technical documentation into polished PDFs.',
        path: '/code-file-tools/markdown-to-pdf',
      },
      {
        name: 'HTML Table Exporter',
        description: 'Export tables to CSV, JSON, or Markdown.',
        path: '/code-file-tools/html-table-exporter',
      },
    ],
  },
  {
    name: 'Design & Web Dev Tools',
    description: 'CSS tools, responsive design helpers, and web dev utilities',
    path: 'dev-design-tools',
    faIcon: 'fas fa-laptop-code',
    materialIcon: 'developer_mode',
    subCategories: [
      {
        name: 'CSS Gradient Generator',
        description: 'Craft brand-ready gradients with instant CSS output.',
        path: '/dev-design-tools/css-gradient-generator',
      },
      {
        name: 'Box Shadow Generator',
        description: 'Preview elevation tokens with live CSS.',
        path: '/dev-design-tools/box-shadow-generator',
      },
      {
        name: 'Border Radius Preview',
        description: 'Test corner radii across card layouts.',
        path: '/dev-design-tools/border-radius-preview',
      },
      {
        name: 'Pixel to REM',
        description: 'Translate measurements into scalable typography.',
        path: '/dev-design-tools/pixel-to-rem',
      },
      {
        name: 'Responsive Breakpoint Tester',
        description: 'Validate breakpoints alongside device data.',
        path: '/dev-design-tools/responsive-breakpoint-tester',
      },
      {
        name: 'Viewport Size Detector',
        description: 'Inspect live viewport dimensions and media queries.',
        path: '/dev-design-tools/viewport-size-detector',
      },
      {
        name: 'Postman Lite',
        description: 'Send HTTP requests without leaving the browser.',
        path: '/dev-design-tools/postman-lite',
      },
      {
        name: 'CORS Test Tool',
        description: 'Test cross-origin request headers and CORS responses from any URL.',
        path: '/dev-design-tools/cors-test-tool',
      },
      {
        name: 'HTTP Header Decoder',
        description: 'Inspect and validate request headers instantly.',
        path: '/dev-design-tools/http-header-decoder',
      },
      {
        name: 'WebSocket Client',
        description: 'Connect to WebSocket endpoints, send messages, and inspect responses live.',
        path: '/dev-design-tools/websocket-client',
      },
      {
        name: 'HTTP Request Generator',
        description: 'Test endpoints with configurable payloads.',
        path: '/dev-design-tools/http-request-generator',
      },
      {
        name: 'Mock JSON Generator',
        description: 'Seed prototypes with realistic dataset templates.',
        path: '/dev-design-tools/mock-json-generator',
      },
    ],
  },
  {
    name: 'Validation & Testing Tools',
    description: 'Validators and testing utilities',
    path: 'testing-tools',
    faIcon: 'fas fa-check-circle',
    materialIcon: 'rule',
    subCategories: [
      {
        name: 'JSON Schema Validator',
        description: 'Check payloads against schema definitions.',
        path: '/testing-tools/json-schema-validator',
      },
      {
        name: 'Password Rule Validator',
        description: 'Test policies against live credentials.',
        path: '/testing-tools/password-rule-validator',
      },
      {
        name: 'Email, URL & IP Checker',
        description: 'Verify addresses before persisting them.',
        path: '/testing-tools/email-url-ip-checker',
      },
      {
        name: 'User Agent Parser',
        description: 'Parse headers into readable device profiles.',
        path: '/testing-tools/user-agent-parser',
      },
      {
        name: 'Credit Card Validator',
        description: 'Confirm card numbers with Luhn and brand rules.',
        path: '/testing-tools/credit-card-validator',
      },
      {
        name: 'JWT Decoder',
        description: 'Inspect JSON Web Tokens without sending them to a server.',
        path: '/testing-tools/jwt-decoder',
      },
    ],
  },
  {
    name: 'Security & Crypto Tools',
    description: 'Hashing, encryption, and secure utilities',
    path: 'security-tools',
    faIcon: 'fas fa-lock',
    materialIcon: 'lock',
    subCategories: [
      {
        name: 'Hash Generator',
        description: 'Compute hashes across SHA, MD5, and more.',
        path: '/security-tools/hash-generator',
      },
      {
        name: 'UUID Generator',
        description: 'Create unique identifiers for anything you ship.',
        path: '/security-tools/uuid-generator',
      },
      {
        name: 'Password Strength Checker',
        description: 'Audit passwords against best practices.',
        path: '/security-tools/password-strength-checker',
      },
      {
        name: 'Random Password Generator',
        description: 'Generate strong credentials with policy-ready presets.',
        path: '/security-tools/random-password-generator',
      },
      {
        name: 'Text Encrypt & Decrypt',
        description: 'Symmetric encryption for quick message sharing.',
        path: '/security-tools/text-encrypt-decrypt',
      },
      {
        name: 'Secure Clipboard',
        description: 'Keep snippets encrypted until you need them.',
        path: '/security-tools/secure-clipboard',
      },
      {
        name: 'Private Notes',
        description: 'Draft notes that never leave your browser.',
        path: '/security-tools/private-notes',
      },
    ],
  },
  {
    name: 'Media & Audio Tools',
    description: 'Audio, video, and media utilities',
    path: 'media-tools',
    faIcon: 'fas fa-music',
    materialIcon: 'music_note',
    subCategories: [
      {
        name: 'Voice Recorder',
        description: 'Capture voice notes with local storage.',
        path: '/media-tools/voice-recorder',
      },
      {
        name: 'Audio Player',
        description: 'Preview tracks with waveform and timeline controls.',
        path: '/media-tools/audio-player',
      },
      {
        name: 'Audio Trimmer',
        description: 'Clip and export audio snippets right in your browser.',
        path: '/media-tools/audio-trimmer',
      },
      {
        name: 'Video to GIF',
        description: 'Create shareable loops without desktop software.',
        path: '/media-tools/video-to-gif',
      },
      {
        name: 'Webcam Snapshot',
        description: 'Take photos from your webcam in a click.',
        path: '/media-tools/webcam-snapshot',
      },
    ],
  },
  {
    name: 'System / Browser Utilities',
    description: 'System information and browser tools',
    path: 'browser-utils',
    faIcon: 'fas fa-desktop',
    materialIcon: 'computer',
    subCategories: [
      {
        name: 'Screen Resolution Info',
        description: 'Surface dimensions, DPR, and orientation details.',
        path: '/browser-utils/screen-resolution-info',
      },
      {
        name: 'Battery Status Viewer',
        description: 'Monitor charging state and capacity in real time.',
        path: '/browser-utils/battery-status-viewer',
      },
      {
        name: 'Device Orientation Logger',
        description: 'Track motion data for hardware testing.',
        path: '/browser-utils/device-orientation-logger',
      },
      {
        name: 'Storage Viewer',
        description: 'Explore localStorage and sessionStorage contents.',
        path: '/browser-utils/storage-viewer',
      },
      {
        name: 'Cookie Editor',
        description: 'Edit, delete, and clone cookies securely.',
        path: '/browser-utils/cookie-editor',
      },
      {
        name: 'Network Speed Test',
        description: 'Measure download, upload, and latency benchmarks.',
        path: '/browser-utils/network-speed-test',
      },
    ],
  },
  {
    name: 'Fun & Productivity Tools',
    description: 'Entertainment and productivity helpers',
    path: 'fun-tools',
    faIcon: 'fas fa-gamepad',
    materialIcon: 'sports_esports',
    subCategories: [
      {
        name: 'QR Code Generator',
        description: 'Create scannable QR codes with custom content in seconds.',
        path: '/fun-tools/qr-code-generator',
      },
      {
        name: 'Barcode Generator',
        description: 'Produce retail-ready barcodes on demand.',
        path: '/fun-tools/barcode-generator',
      },
      {
        name: 'Stopwatch & Timer',
        description: 'Track precise durations and countdowns.',
        path: '/fun-tools/stopwatch-timer',
      },
      {
        name: 'Random Number Generator',
        description: 'Draw fair numbers for raffles and tests.',
        path: '/fun-tools/random-number-generator',
      },
      {
        name: 'Coin Toss & Dice Roller',
        description: 'Flip a coin or roll dice for quick random decisions and games.',
        path: '/fun-tools/coin-toss-dice-roller',
      },
      {
        name: 'Lorem Ipsum Generator',
        description: 'Generate placeholder Lorem Ipsum paragraphs for mockups and wireframes.',
        path: '/fun-tools/lorem-ipsum-generator',
      },
      {
        name: 'Timezone Converter',
        description: 'Plan meetings globally without confusion.',
        path: '/fun-tools/timezone-converter',
      },
      {
        name: 'Typing Speed Test',
        description: 'Benchmark typing speed with live analytics.',
        path: '/fun-tools/typing-speed-test',
      },
      {
        name: 'Pomodoro Timer',
        description: 'Stay on task with rhythm-based sprints.',
        path: '/fun-tools/pomodoro-timer',
      },
      {
        name: 'Flashcard Quiz Generator',
        description: 'Create study decks for any subject.',
        path: '/fun-tools/flashcard-quiz-generator',
      },
      {
        name: 'Motivational Quote Generator',
        description: 'Get inspired with curated daily quotes.',
        path: '/fun-tools/motivational-quote-generator',
      },
    ],
  },
];
