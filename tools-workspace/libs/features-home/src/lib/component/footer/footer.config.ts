export interface FooterLink {
  label: string;
  path: string;
  description?: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export type FooterConfig = Record<string, FooterSection[]>;

export const DEFAULT_FOOTER_SECTIONS: FooterSection[] = [
  {
    title: 'Popular suites',
    links: [
      {
        label: 'JSON Formatter & Validator',
        path: '/data-converters/json-formatter-beautifier-validator',
        description: 'Beautify, validate, and explore structured payloads effortlessly.',
      },
      {
        label: 'Unit Converter',
        path: '/math-date-utils/unit-converter',
        description: 'Go between metric, imperial, and scientific units quickly.',
      },
      {
        label: 'QR Code Generator',
        path: '/fun-tools/qr-code-generator',
        description: 'Create scannable QR codes with custom content in seconds.',
      },
    ],
  },
  {
    title: 'Work smarter',
    links: [
      {
        label: 'CSS Gradient Generator',
        path: '/dev-design-tools/css-gradient-generator',
        description: 'Craft brand-ready gradients with instant CSS output.',
      },
      {
        label: 'Markdown to PDF',
        path: '/code-file-tools/markdown-to-pdf',
        description: 'Turn technical documentation into polished PDFs.',
      },
      {
        label: 'Audio Trimmer',
        path: '/media-tools/audio-trimmer',
        description: 'Clip and export audio snippets right in your browser.',
      },
    ],
  },
  {
    title: 'Stay secure',
    links: [
      {
        label: 'Random Password Generator',
        path: '/security-tools/random-password-generator',
        description: 'Generate strong credentials with policy-ready presets.',
      },
      {
        label: 'JWT Decoder',
        path: '/testing-tools/jwt-decoder',
        description: 'Inspect JSON Web Tokens without sending them to a server.',
      },
      {
        label: 'PDF Password Protect',
        path: '/pdf-tools/password-protect-pdf',
        description: 'Lock sensitive documents before you share them.',
      },
    ],
  },
];

export const FOOTER_CONFIG: FooterConfig = {
  tools: [
    {
      title: 'Launch a tool suite',
      links: [
        {
          label: 'Text Utilities',
          path: '/text-utilities/character-counter',
          description: 'Transform and analyse copy with smart editors.',
        },
        {
          label: 'Data Converters',
          path: '/data-converters/json-formatter-beautifier-validator',
          description: 'Move between JSON, CSV, YAML, Markdown, and more.',
        },
        {
          label: 'PDF Studio',
          path: '/pdf-tools/pdf-viewer',
          description: 'View, edit, and optimise PDF documents end-to-end.',
        },
      ],
    },
    {
      title: 'Get inspired',
      links: [
        {
          label: 'Mock JSON Generator',
          path: '/dev-design-tools/mock-json-generator',
          description: 'Prototype APIs with seeded datasets in minutes.',
        },
        {
          label: 'Palette Generator',
          path: '/image-color-tools/palette-generator',
          description: 'Build colour systems from images and inspiration shots.',
        },
        {
          label: 'File Metadata Viewer',
          path: '/code-file-tools/file-metadata-viewer',
          description: 'Understand file fingerprints right inside the browser.',
        },
      ],
    },
    {
      title: 'Keep discovering',
      links: [
        {
          label: 'Responsive Breakpoint Tester',
          path: '/dev-design-tools/responsive-breakpoint-tester',
          description: 'Preview layouts across devices instantly.',
        },
        {
          label: 'Video to GIF',
          path: '/media-tools/video-to-gif',
          description: 'Create shareable loops without desktop software.',
        },
        {
          label: 'UUID Generator',
          path: '/security-tools/uuid-generator',
          description: 'Create unique identifiers for anything you ship.',
        },
      ],
    },
  ],

  'text-utilities': [
    {
      title: 'Edit smarter',
      links: [
        {
          label: 'Character Counter',
          path: '/text-utilities/character-counter',
          description: 'Live metrics for characters, words, and sentences.',
        },
        {
          label: 'Text Case Changer',
          path: '/text-utilities/text-case-convertor',
          description: 'Swap between upper, lower, title, and sentence cases.',
        },
        {
          label: 'Find & Replace',
          path: '/text-utilities/find-and-replace',
          description: 'Search and replace with plain text or regex.',
        },
        {
          label: 'Sort Lines',
          path: '/text-utilities/sort-lines',
          description: 'Sort lines A–Z, by length, or numerically.',
        },
        {
          label: 'Trim Whitespace',
          path: '/text-utilities/trim-normalize-whitespace',
          description: 'Trim, collapse spaces, and remove empty lines.',
        },
      ],
    },
    {
      title: 'Encode & convert',
      links: [
        {
          label: 'URL Encode & Decode',
          path: '/text-utilities/url-encode-and-decode',
          description: 'Percent-encode or decode URL strings and query values.',
        },
        {
          label: 'Base64 Encode & Decode',
          path: '/text-utilities/base64-encode-and-decode',
          description: 'Convert between plain text and Base64 safely.',
        },
        {
          label: 'Unicode Escape',
          path: '/text-utilities/unicode-escape-unescape',
          description: 'Convert text to \\uXXXX escape sequences.',
        },
        {
          label: 'JSON String Escape',
          path: '/text-utilities/json-string-escape-unescape',
          description: 'Escape strings for safe JSON embedding.',
        },
        {
          label: 'Hex Encode & Decode',
          path: '/text-utilities/hex-encode-decode',
          description: 'Convert text to hexadecimal and back.',
        },
        {
          label: 'Pako Compress & Decompress',
          path: '/text-utilities/pako-encode-and-decode',
          description: 'zlib/gzip compress and decompress with Pako.',
        },
      ],
    },
    {
      title: 'Compare & analyze',
      links: [
        {
          label: 'Text Difference Viewer',
          path: '/text-utilities/text-difference',
          description: 'Highlight changes between versions of any content.',
        },
        {
          label: 'Text Similarity',
          path: '/text-utilities/text-similarity',
          description: 'Levenshtein distance and similarity percentage.',
        },
        {
          label: 'Readability Analyzer',
          path: '/text-utilities/readability-analyzer',
          description: 'Flesch Reading Ease and grade-level scores.',
        },
        {
          label: 'Keyword Density',
          path: '/text-utilities/keyword-density',
          description: 'Word frequency and SEO keyword analysis.',
        },
        {
          label: 'Regex Tester',
          path: '/text-utilities/regex-tester',
          description: 'Test patterns and view matches live.',
        },
        {
          label: 'Invisible Character Detector',
          path: '/text-utilities/invisible-character-detector',
          description: 'Find zero-width and hidden Unicode characters.',
        },
      ],
    },
  ],

  'data-converters': [
    {
      title: 'JSON essentials',
      links: [
        {
          label: 'Formatter & Validator',
          path: '/data-converters/json-formatter-beautifier-validator',
          description: 'Beautify, minify, and validate JSON payloads.',
        },
        {
          label: 'JSON Parser & Explorer',
          path: '/data-converters/json-parser',
          description: 'Navigate nested structures with a live tree view.',
        },
        {
          label: 'JSON Linter Viewer',
          path: '/data-converters/json-linter-viewer',
          description: 'Surface syntax errors with contextual guidance.',
        },
      ],
    },
    {
      title: 'Translate formats',
      links: [
        {
          label: 'CSV ↔ JSON',
          path: '/data-converters/csv-to-json-json-to-csv',
          description: 'Switch between spreadsheets and APIs instantly.',
        },
        {
          label: 'YAML ↔ JSON',
          path: '/data-converters/yaml-to-json-json-to-yaml',
          description: 'Keep configuration files in sync across systems.',
        },
        {
          label: 'HTML Table → JSON',
          path: '/data-converters/html-table-to-json',
          description: 'Turn tabular content into structured objects.',
        },
      ],
    },
    {
      title: 'More to explore',
      links: [
        {
          label: 'Markdown → HTML',
          path: '/data-converters/markdown-to-html',
          description: 'Publish-ready markup from clean Markdown.',
        },
        {
          label: 'Excel → JSON',
          path: '/data-converters/excel-to-json',
          description: 'Upload spreadsheets and export structured data.',
        },
        {
          label: 'Text Utilities Suite',
          path: '/text-utilities/character-counter',
          description: 'Speed up editing with our text optimisation tools.',
        },
      ],
    },
  ],

  'file-viewers': [
    {
      title: 'Inspect any file',
      links: [
        {
          label: 'Image Viewer',
          path: '/file-viewers/image-viewer',
          description: 'Preview formats from PNG to WebP without plugins.',
        },
        {
          label: 'PDF Viewer',
          path: '/file-viewers/pdf-viewer',
          description: 'Navigate documents with tabs, outlines, and zoom.',
        },
        {
          label: 'Log Viewer',
          path: '/file-viewers/log-viewer',
          description: 'Search and filter large logs in the browser.',
        },
      ],
    },
    {
      title: 'Format specific tools',
      links: [
        {
          label: 'XES Viewer',
          path: '/file-viewers/xes-viewer',
          description: 'Explore process-mining event logs with cases and variants.',
        },
        {
          label: 'Excel Viewer',
          path: '/file-viewers/excel-viewer',
          description: 'Inspect spreadsheet cells, formulas, and sheets.',
        },
        {
          label: 'Markdown Previewer',
          path: '/file-viewers/markdown-previewer',
          description: 'Check headings, code blocks, and typography fast.',
        },
        {
          label: 'Font Viewer',
          path: '/file-viewers/font-viewer',
          description: 'Audit glyph sets before you embed fonts.',
        },
      ],
    },
    {
      title: 'Audio & video',
      links: [
        {
          label: 'Audio Player',
          path: '/file-viewers/audio-player',
          description: 'Stream and scrub audio files instantly.',
        },
        {
          label: 'Video Player',
          path: '/file-viewers/video-player',
          description: 'Review MP4, WEBM, and more with custom controls.',
        },
        {
          label: 'Archive Viewer',
          path: '/file-viewers/archive-viewer',
          description: 'Peek inside ZIP and TAR archives without extracting.',
        },
      ],
    },
  ],

  'math-date-utils': [
    {
      title: 'Daily calculations',
      links: [
        {
          label: 'Unit Converter',
          path: '/math-date-utils/unit-converter',
          description: 'Switch between metric, imperial, and scientific units.',
        },
        {
          label: 'Currency Converter',
          path: '/math-date-utils/currency-converter',
          description: 'Check live conversion rates for common currencies.',
        },
        {
          label: 'Percentage Calculator',
          path: '/math-date-utils/percentage-calculator',
          description: 'Solve increase, decrease, and proportion questions.',
        },
      ],
    },
    {
      title: 'Plan timelines',
      links: [
        {
          label: 'Date Difference',
          path: '/math-date-utils/date-difference-calculator',
          description: 'Count days, weeks, or months between key events.',
        },
        {
          label: 'Age Calculator',
          path: '/math-date-utils/age-calculator',
          description: 'Compute birthdays and anniversaries accurately.',
        },
        {
          label: 'Zodiac Finder',
          path: '/math-date-utils/zodiac-finder',
          description: 'Discover astrological signs from any date.',
        },
      ],
    },
    {
      title: 'Finance helpers',
      links: [
        {
          label: 'Loan EMI Calculator',
          path: '/math-date-utils/loan-emi-calculator',
          description: 'Project repayments for mortgages and loans.',
        },
        {
          label: 'Simple & Compound Interest',
          path: '/math-date-utils/simple-compound-interest-calculator',
          description: 'Model returns across time horizons.',
        },
        {
          label: 'Tip Calculator',
          path: '/math-date-utils/tip-calculator',
          description: 'Split bills fairly with friends or teams.',
        },
      ],
    },
  ],

  'image-color-tools': [
    {
      title: 'Prepare assets',
      links: [
        {
          label: 'Image to Base64',
          path: '/image-color-tools/image-to-base64',
          description: 'Convert images to embeddable Base64 strings.',
        },
        {
          label: 'Image Resizer',
          path: '/image-color-tools/image-resizer',
          description: 'Crop and scale assets with pixel-perfect control.',
        },
        {
          label: 'Image Compressor',
          path: '/image-color-tools/image-compressor',
          description: 'Optimise imagery without losing clarity.',
        },
      ],
    },
    {
      title: 'Colour systems',
      links: [
        {
          label: 'Color Picker',
          path: '/image-color-tools/color-picker',
          description: 'Sample, harmonise, and store brand colours.',
        },
        {
          label: 'HEX ↔ RGB',
          path: '/image-color-tools/hex-to-rgb',
          description: 'Translate colour models instantly.',
        },
        {
          label: 'Palette Generator',
          path: '/image-color-tools/palette-generator',
          description: 'Build cohesive palettes from inspiration images.',
        },
      ],
    },
    {
      title: 'Creative extras',
      links: [
        {
          label: 'Gradient Generator',
          path: '/image-color-tools/gradient-generator',
          description: 'Design smooth gradients with CSS output.',
        },
        {
          label: 'Favicon Generator',
          path: '/image-color-tools/favicon-generator',
          description: 'Create multi-size favicons and manifest icons.',
        },
        {
          label: 'Drawing Pad',
          path: '/image-color-tools/drawing-pad',
          description: 'Sketch UI ideas or annotate screenshots.',
        },
      ],
    },
  ],

  'code-file-tools': [
    {
      title: 'Optimise assets',
      links: [
        {
          label: 'HTML Minifier',
          path: '/code-file-tools/html-minifier',
          description: 'Reduce file size with whitespace-aware minification.',
        },
        {
          label: 'CSS Minifier',
          path: '/code-file-tools/css-minifier',
          description: 'Optimise stylesheets for production deployments.',
        },
        {
          label: 'JavaScript Minifier',
          path: '/code-file-tools/javascript-minifier',
          description: 'Compress scripts without breaking behaviour.',
        },
      ],
    },
    {
      title: 'Clipboard & metadata',
      links: [
        {
          label: 'Clipboard Viewer',
          path: '/code-file-tools/clipboard-viewer',
          description: 'Inspect text, HTML, and images stored in your clipboard.',
        },
        {
          label: 'Clipboard History',
          path: '/code-file-tools/clipboard-history',
          description: 'Keep multiple snippets ready for reuse.',
        },
        {
          label: 'File Metadata Viewer',
          path: '/code-file-tools/file-metadata-viewer',
          description: 'Compare timestamps, hashes, and file attributes.',
        },
      ],
    },
    {
      title: 'Publishing helpers',
      links: [
        {
          label: 'HTML Table Exporter',
          path: '/code-file-tools/html-table-exporter',
          description: 'Export tables to CSV, JSON, or Markdown.',
        },
        {
          label: 'Markdown to PDF',
          path: '/code-file-tools/markdown-to-pdf',
          description: 'Deliver documentation to stakeholders as PDFs.',
        },
        {
          label: 'HTML Entity Encoder',
          path: '/code-file-tools/html-entity-encoder',
          description: 'Escape HTML entities for safer rendering.',
        },
      ],
    },
  ],

  'dev-design-tools': [
    {
      title: 'Design systems',
      links: [
        {
          label: 'CSS Gradient Generator',
          path: '/dev-design-tools/css-gradient-generator',
          description: 'Craft gradients with on-brand colour ramps.',
        },
        {
          label: 'Box Shadow Generator',
          path: '/dev-design-tools/box-shadow-generator',
          description: 'Preview elevation tokens with live CSS.',
        },
        {
          label: 'Border Radius Preview',
          path: '/dev-design-tools/border-radius-preview',
          description: 'Test corner radii across card layouts.',
        },
      ],
    },
    {
      title: 'Responsive prototyping',
      links: [
        {
          label: 'Responsive Breakpoint Tester',
          path: '/dev-design-tools/responsive-breakpoint-tester',
          description: 'Simulate devices from phones to desktops.',
        },
        {
          label: 'Viewport Size Detector',
          path: '/dev-design-tools/viewport-size-detector',
          description: 'Inspect live viewport dimensions and media queries.',
        },
        {
          label: 'Pixel to REM',
          path: '/dev-design-tools/pixel-to-rem',
          description: 'Translate measurements into scalable typography.',
        },
      ],
    },
    {
      title: 'Developer accelerators',
      links: [
        {
          label: 'Postman Lite',
          path: '/dev-design-tools/postman-lite',
          description: 'Send HTTP requests without leaving the browser.',
        },
        {
          label: 'HTTP Header Decoder',
          path: '/dev-design-tools/http-header-decoder',
          description: 'Inspect and validate request headers instantly.',
        },
        {
          label: 'Mock JSON Generator',
          path: '/dev-design-tools/mock-json-generator',
          description: 'Seed prototypes with realistic dataset templates.',
        },
      ],
    },
  ],

  'media-tools': [
    {
      title: 'Create & edit',
      links: [
        {
          label: 'Video to GIF',
          path: '/media-tools/video-to-gif',
          description: 'Convert clips into looping GIFs quickly.',
        },
        {
          label: 'Audio Trimmer',
          path: '/media-tools/audio-trimmer',
          description: 'Cut and export the exact segment you need.',
        },
        {
          label: 'Audio Player',
          path: '/media-tools/audio-player',
          description: 'Preview tracks with waveform and timeline controls.',
        },
      ],
    },
    {
      title: 'Capture in-browser',
      links: [
        {
          label: 'Voice Recorder',
          path: '/media-tools/voice-recorder',
          description: 'Capture voice notes with local storage.',
        },
        {
          label: 'Webcam Snapshot',
          path: '/media-tools/webcam-snapshot',
          description: 'Take photos from your webcam in a click.',
        },
        {
          label: 'Responsive Breakpoint Tester',
          path: '/dev-design-tools/responsive-breakpoint-tester',
          description: 'Validate layouts alongside recorded media.',
        },
      ],
    },
    {
      title: 'Discover more',
      links: [
        {
          label: 'Image Compressor',
          path: '/image-color-tools/image-compressor',
          description: 'Optimise supporting media before publishing.',
        },
        {
          label: 'Screen Resolution Info',
          path: '/browser-utils/screen-resolution-info',
          description: 'Check display specs before recording demos.',
        },
        {
          label: 'Mock JSON Generator',
          path: '/dev-design-tools/mock-json-generator',
          description: 'Pair media guides with sample API payloads.',
        },
      ],
    },
  ],

  'pdf-tools': [
    {
      title: 'Document workflow',
      links: [
        {
          label: 'PDF Viewer',
          path: '/pdf-tools/pdf-viewer',
          description: 'Open and review PDFs with annotation-friendly UI.',
        },
        {
          label: 'Merge PDFs',
          path: '/pdf-tools/merge-pdfs',
          description: 'Combine files into a single deliverable.',
        },
        {
          label: 'Split PDFs',
          path: '/pdf-tools/split-pdfs',
          description: 'Extract specific ranges into new documents.',
        },
      ],
    },
    {
      title: 'Enhance & secure',
      links: [
        {
          label: 'Compress PDF',
          path: '/pdf-tools/compress-pdf',
          description: 'Reduce file size for quicker sharing.',
        },
        {
          label: 'Password Protect',
          path: '/pdf-tools/password-protect-pdf',
          description: 'Encrypt PDFs with secure passphrases.',
        },
        {
          label: 'Add Watermark',
          path: '/pdf-tools/add-watermark',
          description: 'Brand documents before distribution.',
        },
      ],
    },
    {
      title: 'Create & customise',
      links: [
        {
          label: 'HTML to PDF',
          path: '/pdf-tools/html-to-pdf',
          description: 'Render HTML with styles and export a print-ready PDF.',
        },
        {
          label: 'Tables to PDF',
          path: '/pdf-tools/tables-to-pdf',
          description: 'Export editable tables into formatted PDF documents.',
        },
        {
          label: 'Charts to PDF',
          path: '/pdf-tools/charts-to-pdf',
          description: 'Preview charts and export them to PDF.',
        },
        {
          label: 'Resume Generator',
          path: '/pdf-tools/resume-generator',
          description: 'Build a professional resume PDF from structured fields.',
        },
        {
          label: 'Invoice Generator',
          path: '/pdf-tools/invoice-generator',
          description: 'Create invoices with line items, tax, and totals.',
        },
        {
          label: 'Text to PDF',
          path: '/pdf-tools/text-to-pdf',
          description: 'Convert plain text into a formatted PDF document.',
        },
        {
          label: 'Image to PDF',
          path: '/pdf-tools/image-to-pdf',
          description: 'Combine multiple images into a single PDF.',
        },
        {
          label: 'Create PDF from HTML',
          path: '/pdf-tools/create-pdf-from-html',
          description: 'Export responsive pages into accessible PDFs.',
        },
        {
          label: 'Resume & Invoice Generator',
          path: '/pdf-tools/resume-invoice-generator',
          description: 'Build professional docs with guided templates.',
        },
        {
          label: 'Fill PDF Forms',
          path: '/pdf-tools/fill-pdf-forms',
          description: 'Complete form fields and save persistently.',
        },
        {
          label: 'Add Page Numbers',
          path: '/pdf-tools/add-page-numbers',
          description: 'Stamp page numbers with custom position and format.',
        },
        {
          label: 'Barcode to PDF',
          path: '/pdf-tools/barcode-to-pdf',
          description: 'Generate a barcode inside a PDF document.',
        },
        {
          label: 'QR Code to PDF',
          path: '/pdf-tools/qr-code-to-pdf',
          description: 'Generate a QR code inside a PDF document.',
        },
      ],
    },
  ],

  'security-tools': [
    {
      title: 'Protect credentials',
      links: [
        {
          label: 'Random Password Generator',
          path: '/security-tools/random-password-generator',
          description: 'Create strong passwords with entropy controls.',
        },
        {
          label: 'Password Strength Checker',
          path: '/security-tools/password-strength-checker',
          description: 'Audit passwords against best practices.',
        },
        {
          label: 'Secure Clipboard',
          path: '/security-tools/secure-clipboard',
          description: 'Store secrets locally with timed clearing.',
        },
      ],
    },
    {
      title: 'Encrypt & hash',
      links: [
        {
          label: 'Text Encrypt & Decrypt',
          path: '/security-tools/text-encrypt-decrypt',
          description: 'Symmetric encryption for quick message sharing.',
        },
        {
          label: 'Hash Generator',
          path: '/security-tools/hash-generator',
          description: 'Compute hashes across SHA, MD5, and more.',
        },
        {
          label: 'UUID Generator',
          path: '/security-tools/uuid-generator',
          description: 'Generate RFC-compliant identifiers instantly.',
        },
      ],
    },
    {
      title: 'Confidential notes',
      links: [
        {
          label: 'Private Notes',
          path: '/security-tools/private-notes',
          description: 'Draft notes that never leave your browser.',
        },
        {
          label: 'Secure Clipboard',
          path: '/security-tools/secure-clipboard',
          description: 'Keep snippets encrypted until you need them.',
        },
        {
          label: 'Password Protect PDF',
          path: '/pdf-tools/password-protect-pdf',
          description: 'Extend security to exported documents.',
        },
      ],
    },
  ],

  'testing-tools': [
    {
      title: 'Validate data',
      links: [
        {
          label: 'JWT Decoder',
          path: '/testing-tools/jwt-decoder',
          description: 'Decode tokens and inspect payload claims.',
        },
        {
          label: 'JSON Schema Validator',
          path: '/testing-tools/json-schema-validator',
          description: 'Check payloads against schema definitions.',
        },
        {
          label: 'Credit Card Validator',
          path: '/testing-tools/credit-card-validator',
          description: 'Confirm card numbers with Luhn and brand rules.',
        },
      ],
    },
    {
      title: 'Network helpers',
      links: [
        {
          label: 'Email, URL & IP Checker',
          path: '/testing-tools/email-url-ip-checker',
          description: 'Verify addresses before persisting them.',
        },
        {
          label: 'Password Rule Validator',
          path: '/testing-tools/password-rule-validator',
          description: 'Test policies against live credentials.',
        },
        {
          label: 'User Agent Parser',
          path: '/testing-tools/user-agent-parser',
          description: 'Understand client contexts instantly.',
        },
      ],
    },
    {
      title: 'Cross-suite recommendations',
      links: [
        {
          label: 'Network Speed Test',
          path: '/browser-utils/network-speed-test',
          description: 'Benchmark latency and throughput by location.',
        },
        {
          label: 'HTTP Request Generator',
          path: '/dev-design-tools/http-request-generator',
          description: 'Test endpoints with configurable payloads.',
        },
        {
          label: 'Postman Lite',
          path: '/dev-design-tools/postman-lite',
          description: 'Keep API investigations in one tab.',
        },
      ],
    },
  ],

  'browser-utils': [
    {
      title: 'Inspect browsers',
      links: [
        {
          label: 'Screen Resolution Info',
          path: '/browser-utils/screen-resolution-info',
          description: 'Surface dimensions, DPR, and orientation details.',
        },
        {
          label: 'Device Orientation Logger',
          path: '/browser-utils/device-orientation-logger',
          description: 'Track motion data for hardware testing.',
        },
        {
          label: 'Storage Viewer',
          path: '/browser-utils/storage-viewer',
          description: 'Explore localStorage and sessionStorage contents.',
        },
      ],
    },
    {
      title: 'Performance checks',
      links: [
        {
          label: 'Network Speed Test',
          path: '/browser-utils/network-speed-test',
          description: 'Measure download, upload, and latency benchmarks.',
        },
        {
          label: 'Battery Status Viewer',
          path: '/browser-utils/battery-status-viewer',
          description: 'Monitor charging state and capacity in real time.',
        },
        {
          label: 'Cookie Editor',
          path: '/browser-utils/cookie-editor',
          description: 'Edit, delete, and clone cookies securely.',
        },
      ],
    },
    {
      title: 'Related suites',
      links: [
        {
          label: 'Responsive Breakpoint Tester',
          path: '/dev-design-tools/responsive-breakpoint-tester',
          description: 'Validate breakpoints alongside device data.',
        },
        {
          label: 'User Agent Parser',
          path: '/testing-tools/user-agent-parser',
          description: 'Parse headers into readable device profiles.',
        },
        {
          label: 'Viewport Size Detector',
          path: '/dev-design-tools/viewport-size-detector',
          description: 'Check live viewport sizing for responsive QA.',
        },
      ],
    },
  ],

  'fun-tools': [
    {
      title: 'Generate & play',
      links: [
        {
          label: 'QR Code Generator',
          path: '/fun-tools/qr-code-generator',
          description: 'Create codes for URLs, Wi-Fi, and contact cards.',
        },
        {
          label: 'Barcode Generator',
          path: '/fun-tools/barcode-generator',
          description: 'Produce retail-ready barcodes on demand.',
        },
        {
          label: 'Random Number Generator',
          path: '/fun-tools/random-number-generator',
          description: 'Draw fair numbers for raffles and tests.',
        },
      ],
    },
    {
      title: 'Focus & productivity',
      links: [
        {
          label: 'Pomodoro Timer',
          path: '/fun-tools/pomodoro-timer',
          description: 'Stay on task with rhythm-based sprints.',
        },
        {
          label: 'Stopwatch & Timer',
          path: '/fun-tools/stopwatch-timer',
          description: 'Track precise durations and countdowns.',
        },
        {
          label: 'Timezone Converter',
          path: '/fun-tools/timezone-converter',
          description: 'Plan meetings globally without confusion.',
        },
      ],
    },
    {
      title: 'Sharpen skills',
      links: [
        {
          label: 'Typing Speed Test',
          path: '/fun-tools/typing-speed-test',
          description: 'Benchmark typing speed with live analytics.',
        },
        {
          label: 'Flashcard Quiz Generator',
          path: '/fun-tools/flashcard-quiz-generator',
          description: 'Create study decks for any subject.',
        },
        {
          label: 'Motivational Quote Generator',
          path: '/fun-tools/motivational-quote-generator',
          description: 'Get inspired with curated daily quotes.',
        },
      ],
    },
  ],
};

