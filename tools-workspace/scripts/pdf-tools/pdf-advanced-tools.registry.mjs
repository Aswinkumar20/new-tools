/**
 * Registry of NEW PDF tools (existing live tools are intentionally omitted).
 * Used by the generator and PdfAdvancedWorkbenchComponent.
 * @typedef {'pdf' | 'office' | 'multi-pdf' | 'text' | 'url' | 'markdown' | 'images' | 'none'} InputKind
 * @typedef {'pdf' | 'text' | 'json' | 'zip' | 'epub' | 'csv' | 'html' | 'markdown' | 'docx' | 'xfdf'} OutputKind
 * @typedef {'solid' | 'heuristic' | 'requires-engine'} CapabilityKind
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   category: string,
 *   input: InputKind,
 *   output: OutputKind,
 *   endpoint: string,
 *   accept?: string,
 *   needsPassword?: boolean,
 *   needsCertificate?: boolean,
 *   configFields?: Array<{ key: string, label: string, type: 'text'|'number'|'textarea'|'select'|'checkbox'|'password', placeholder?: string, options?: string[], defaultValue?: string|number|boolean }>,
 *   clientOnly?: boolean,
 *   asyncJob?: boolean,
 *   capability?: CapabilityKind,
 *   honestyNote?: string,
 * }} PdfAdvancedToolDef
 */

/** @type {PdfAdvancedToolDef[]} */
export const PDF_ADVANCED_TOOLS = [
  // —— Export / convert ——
  { id: 'pdf-to-txt', title: 'PDF to TXT', description: 'Extract plain text from a PDF for editing or search.', category: 'export', input: 'pdf', output: 'text', endpoint: '/pdf-to-text' },
  { id: 'pdf-to-html', title: 'PDF to HTML', description: 'Convert PDF text content into a simple HTML document.', category: 'export', input: 'pdf', output: 'html', endpoint: '/to-html' },
  { id: 'pdf-to-markdown', title: 'PDF to Markdown', description: 'Convert PDF text into Markdown for docs and notes.', category: 'export', input: 'pdf', output: 'markdown', endpoint: '/to-markdown' },
  { id: 'pdf-to-csv', title: 'PDF to CSV', description: 'Extract tabular-looking lines from a PDF into CSV.', category: 'export', input: 'pdf', output: 'csv', endpoint: '/to-csv' },
  { id: 'pdf-to-json', title: 'PDF to JSON', description: 'Export PDF text and page structure as JSON.', category: 'export', input: 'pdf', output: 'json', endpoint: '/to-json' },
  { id: 'pdf-to-epub', title: 'PDF to EPUB', description: 'Build a basic EPUB ebook from PDF text content.', category: 'export', input: 'pdf', output: 'epub', endpoint: '/to-epub' },
  { id: 'pdf-to-pdfa', title: 'PDF to PDF/A', description: 'Convert a PDF to PDF/A-2 via Ghostscript (fails closed if Ghostscript is missing).', category: 'export', input: 'pdf', output: 'pdf', endpoint: '/to-pdfa', capability: 'requires-engine', honestyNote: 'Requires Ghostscript on the API host.' },
  { id: 'pdf-to-images', title: 'PDF to Images', description: 'Render every PDF page to PNG and download as a ZIP (choose DPI).', category: 'export', input: 'pdf', output: 'zip', endpoint: '/pdf-to-images', configFields: [
    { key: 'dpi', label: 'DPI', type: 'number', defaultValue: 150 },
  ]},
  { id: 'ocr-pdf', title: 'OCR PDF', description: 'Make a scanned PDF searchable with Tesseract OCR, or export OCR text/DOCX (async).', category: 'export', input: 'pdf', output: 'pdf', endpoint: '/ocr-async', asyncJob: true, capability: 'requires-engine', honestyNote: 'Requires Tesseract on the API host. Large scans run asynchronously.', configFields: [
    { key: 'mode', label: 'Output', type: 'select', options: ['searchable', 'text', 'docx'], defaultValue: 'searchable' },
    { key: 'language', label: 'Language', type: 'text', placeholder: 'eng', defaultValue: 'eng' },
    { key: 'dpi', label: 'DPI', type: 'number', defaultValue: 200 },
    { key: 'deskew', label: 'Deskew first', type: 'checkbox', defaultValue: false },
  ]},
  { id: 'pdf-deskew', title: 'PDF Deskew', description: 'Straighten skewed scanned pages using a projection-based rotation estimate (image rebuild).', category: 'cleanup', input: 'pdf', output: 'pdf', endpoint: '/deskew', capability: 'heuristic', honestyNote: 'Best-effort scan cleanup — rebuilds pages as images.', configFields: [
    { key: 'dpi', label: 'DPI', type: 'number', defaultValue: 150 },
    { key: 'maxDegrees', label: 'Max skew (±degrees)', type: 'number', defaultValue: 10 },
  ]},
  { id: 'images-to-searchable-pdf', title: 'Images to Searchable PDF', description: 'Combine images into a PDF, then run Tesseract OCR so the result is searchable.', category: 'export', input: 'images', output: 'pdf', endpoint: '/images-to-searchable-pdf', accept: 'image/*,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.bmp', capability: 'requires-engine', honestyNote: 'Requires Tesseract. Page count is limited by OCR max pages.', configFields: [
    { key: 'language', label: 'Language', type: 'text', placeholder: 'eng', defaultValue: 'eng' },
    { key: 'dpi', label: 'OCR DPI', type: 'number', defaultValue: 200 },
  ]},
  { id: 'pdf-to-docx', title: 'PDF to DOCX', description: 'Best-effort PDF → Word via LibreOffice when available, otherwise plain-text DOCX.', category: 'export', input: 'pdf', output: 'docx', endpoint: '/to-docx', capability: 'requires-engine', honestyNote: 'Layout is approximate; LibreOffice gives the best results.' },
  { id: 'url-to-pdf', title: 'URL to PDF', description: 'Render a public http(s) page to PDF with headless Chromium (async).', category: 'export', input: 'url', output: 'pdf', endpoint: '/url-to-pdf-async', asyncJob: true, capability: 'requires-engine', honestyNote: 'Requires Chromium. Private/local URLs are blocked.', configFields: [
    { key: 'url', label: 'Page URL', type: 'text', placeholder: 'https://example.com', defaultValue: 'https://example.com' },
  ]},
  { id: 'markdown-to-pdf', title: 'Markdown to PDF', description: 'Convert Markdown to a simple styled PDF (CommonMark → HTML → PDF).', category: 'export', input: 'markdown', output: 'pdf', endpoint: '/markdown-to-pdf', configFields: [
    { key: 'markdown', label: 'Markdown', type: 'textarea', defaultValue: '# Title\n\nHello from Markdown.' },
  ]},

  // —— Office → PDF ——
  { id: 'word-to-pdf', title: 'Word to PDF', description: 'Convert Word documents (.doc/.docx) to PDF via LibreOffice (async).', category: 'office', input: 'office', output: 'pdf', endpoint: '/office-to-pdf-async', asyncJob: true, capability: 'requires-engine', honestyNote: 'Requires LibreOffice on the API host (included in Docker image).', accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'excel-to-pdf', title: 'Excel to PDF', description: 'Convert Excel spreadsheets to PDF via LibreOffice (async).', category: 'office', input: 'office', output: 'pdf', endpoint: '/office-to-pdf-async', asyncJob: true, capability: 'requires-engine', honestyNote: 'Requires LibreOffice on the API host (included in Docker image).', accept: '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { id: 'powerpoint-to-pdf', title: 'PowerPoint to PDF', description: 'Convert PowerPoint decks to PDF via LibreOffice (async).', category: 'office', input: 'office', output: 'pdf', endpoint: '/office-to-pdf-async', asyncJob: true, capability: 'requires-engine', honestyNote: 'Requires LibreOffice on the API host (included in Docker image).', accept: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation' },

  // —— Page tools ——
  { id: 'pdf-page-duplicator', title: 'PDF Page Duplicator', description: 'Duplicate selected pages and insert copies into the PDF.', category: 'pages', input: 'pdf', output: 'pdf', endpoint: '/duplicate-pages', configFields: [{ key: 'pages', label: 'Pages to duplicate', type: 'text', placeholder: '1,3-4', defaultValue: '1' }] },
  { id: 'pdf-page-replacer', title: 'PDF Page Replacer', description: 'Replace a page range with pages from another PDF.', category: 'pages', input: 'pdf', output: 'pdf', endpoint: '/replace-pages', configFields: [{ key: 'pages', label: 'Pages to replace', type: 'text', placeholder: '2-3', defaultValue: '1' }] },
  { id: 'pdf-page-cropper', title: 'PDF Page Cropper', description: 'Crop all pages by margins (points).', category: 'pages', input: 'pdf', output: 'pdf', endpoint: '/crop-pages', configFields: [
    { key: 'left', label: 'Left (pt)', type: 'number', defaultValue: 36 },
    { key: 'right', label: 'Right (pt)', type: 'number', defaultValue: 36 },
    { key: 'top', label: 'Top (pt)', type: 'number', defaultValue: 36 },
    { key: 'bottom', label: 'Bottom (pt)', type: 'number', defaultValue: 36 },
  ]},
  { id: 'pdf-page-resizer', title: 'PDF Page Resizer', description: 'Normalize all pages to a target paper size.', category: 'pages', input: 'pdf', output: 'pdf', endpoint: '/resize-pages', configFields: [{ key: 'size', label: 'Target size', type: 'select', options: ['A4', 'Letter', 'Legal', 'A3'], defaultValue: 'A4' }] },
  { id: 'pdf-header-footer', title: 'PDF Header & Footer', description: 'Stamp a header and footer on every page.', category: 'pages', input: 'pdf', output: 'pdf', endpoint: '/header-footer', configFields: [
    { key: 'header', label: 'Header text', type: 'text', placeholder: 'Confidential', defaultValue: '' },
    { key: 'footer', label: 'Footer text', type: 'text', placeholder: 'Page footer', defaultValue: '' },
  ]},
  { id: 'pdf-bookmark-creator', title: 'PDF Bookmark Creator', description: 'Create bookmarks from a simple outline (title|page per line).', category: 'structure', input: 'pdf', output: 'pdf', endpoint: '/bookmarks', configFields: [{ key: 'outline', label: 'Outline (title|page)', type: 'textarea', placeholder: 'Intro|1\nChapter 1|2', defaultValue: 'Cover|1' }] },
  { id: 'pdf-table-of-contents', title: 'PDF Table of Contents', description: 'Insert a generated table-of-contents page from an outline.', category: 'structure', input: 'pdf', output: 'pdf', endpoint: '/table-of-contents', configFields: [{ key: 'outline', label: 'Outline (title|page)', type: 'textarea', placeholder: 'Intro|1\nChapter 1|2', defaultValue: 'Introduction|1' }] },
  { id: 'pdf-form-creator', title: 'PDF Form Creator', description: 'Add one or more AcroForm fields (JSON list of text/checkbox fields; optional required:true).', category: 'forms', input: 'pdf', output: 'pdf', endpoint: '/create-form-field', configFields: [
    { key: 'fieldsJson', label: 'Fields JSON', type: 'textarea', defaultValue: '[{"name":"full_name","label":"Full name","type":"text","required":true,"page":0,"x":50,"y":700,"width":220,"height":20},{"name":"agree","label":"I agree","type":"checkbox","page":0,"x":50,"y":660,"width":14,"height":14}]' },
    { key: 'fieldName', label: 'Single field name (fallback)', type: 'text', defaultValue: 'full_name' },
    { key: 'label', label: 'Single field label (fallback)', type: 'text', defaultValue: 'Full name' },
  ]},
  { id: 'pdf-form-export', title: 'PDF Form Export', description: 'Export AcroForm field names/values as JSON or XFDF.', category: 'forms', input: 'pdf', output: 'json', endpoint: '/export-form', configFields: [
    { key: 'format', label: 'Format', type: 'select', options: ['json', 'xfdf'], defaultValue: 'json' },
  ]},
  { id: 'pdf-form-import', title: 'PDF Form Import', description: 'Fill a PDF form from JSON map/array or XFDF values.', category: 'forms', input: 'pdf', output: 'pdf', endpoint: '/import-form', configFields: [
    { key: 'values', label: 'Values (JSON or XFDF)', type: 'textarea', defaultValue: '{"full_name":"Ada Lovelace"}' },
  ]},
  { id: 'pdf-form-validate', title: 'PDF Form Validate', description: 'Check required AcroForm fields and list any that are still empty.', category: 'forms', input: 'pdf', output: 'json', endpoint: '/validate-form' },

  // —— Security / cleanup ——
  { id: 'unlock-pdf', title: 'Unlock PDF', description: 'Remove password protection from a PDF you are authorized to open.', category: 'security', input: 'pdf', output: 'pdf', endpoint: '/decrypt', needsPassword: true },
  { id: 'pdf-password-generator', title: 'PDF Password Generator', description: 'Generate strong passwords suitable for PDF encryption.', category: 'security', input: 'none', output: 'text', endpoint: '', clientOnly: true, configFields: [
    { key: 'length', label: 'Length', type: 'number', defaultValue: 16 },
    { key: 'symbols', label: 'Include symbols', type: 'checkbox', defaultValue: true },
  ]},
  { id: 'pdf-permission-manager', title: 'PDF Permission Manager', description: 'Re-encrypt a PDF with print/edit permissions (requires passwords).', category: 'security', input: 'pdf', output: 'pdf', endpoint: '/encrypt', needsPassword: true, configFields: [
    { key: 'userPassword', label: 'User password', type: 'password', defaultValue: '' },
    { key: 'ownerPassword', label: 'Owner password', type: 'password', defaultValue: '' },
    { key: 'allowPrint', label: 'Allow printing', type: 'checkbox', defaultValue: true },
    { key: 'allowModify', label: 'Allow editing', type: 'checkbox', defaultValue: false },
  ]},
  { id: 'pdf-annotation-remover', title: 'PDF Annotation Remover', description: 'Strip annotations and comments from a PDF.', category: 'cleanup', input: 'pdf', output: 'pdf', endpoint: '/remove-annotations' },
  { id: 'pdf-metadata-remover', title: 'PDF Metadata Remover', description: 'Clear document metadata (title, author, keywords, etc.).', category: 'cleanup', input: 'pdf', output: 'pdf', endpoint: '/remove-metadata' },
  { id: 'pdf-hidden-data-remover', title: 'PDF Hidden Data Remover', description: 'Remove metadata, annotations, and JavaScript actions where possible.', category: 'cleanup', input: 'pdf', output: 'pdf', endpoint: '/remove-hidden-data' },
  { id: 'pdf-signature-verification', title: 'PDF Signature Verification', description: 'Validate CMS digital signatures embedded in a PDF (integrity check).', category: 'security', input: 'pdf', output: 'json', endpoint: '/verify-signatures' },
  { id: 'pdf-digital-signature', title: 'PDF Digital Signature', description: 'Cryptographically sign a PDF with your PKCS#12 certificate (.p12/.pfx).', category: 'security', input: 'pdf', output: 'pdf', endpoint: '/sign-pkcs12', needsCertificate: true, configFields: [
    { key: 'certificatePassword', label: 'Certificate password', type: 'password', defaultValue: '' },
    { key: 'reason', label: 'Reason', type: 'text', defaultValue: 'Document approval' },
    { key: 'location', label: 'Location', type: 'text', defaultValue: '' },
  ]},
  { id: 'pdf-signature-stamp', title: 'PDF Signature Stamp', description: 'Add a visible non-cryptographic “Signed by” mark (not a legal e-sign).', category: 'security', input: 'pdf', output: 'pdf', endpoint: '/stamp-signature', configFields: [{ key: 'signerName', label: 'Signer name', type: 'text', defaultValue: 'Signed' }] },

  // —— Inspect / extract ——
  { id: 'pdf-font-inspector', title: 'PDF Font Inspector', description: 'List fonts embedded or referenced in the PDF.', category: 'inspect', input: 'pdf', output: 'json', endpoint: '/inspect-fonts' },
  { id: 'pdf-image-extractor', title: 'PDF Image Extractor', description: 'Extract embedded images into a ZIP archive.', category: 'extract', input: 'pdf', output: 'zip', endpoint: '/extract-images' },
  { id: 'pdf-link-extractor', title: 'PDF Link Extractor', description: 'List URI links found in the PDF.', category: 'extract', input: 'pdf', output: 'json', endpoint: '/extract-links' },
  { id: 'pdf-attachment-extractor', title: 'PDF Attachment Extractor', description: 'Extract embedded file attachments into a ZIP.', category: 'extract', input: 'pdf', output: 'zip', endpoint: '/extract-attachments' },

  // —— Optimize / color ——
  { id: 'pdf-grayscale-converter', title: 'PDF Grayscale Converter', description: 'Render pages to grayscale and rebuild the PDF.', category: 'optimize', input: 'pdf', output: 'pdf', endpoint: '/grayscale' },
  { id: 'pdf-color-converter', title: 'PDF Color Converter', description: 'Convert page renders to RGB or grayscale.', category: 'optimize', input: 'pdf', output: 'pdf', endpoint: '/color-convert', configFields: [{ key: 'mode', label: 'Color mode', type: 'select', options: ['rgb', 'gray'], defaultValue: 'rgb' }] },
  { id: 'pdf-dpi-converter', title: 'PDF DPI Converter', description: 'Re-render pages at a target DPI (image-based PDF).', category: 'optimize', input: 'pdf', output: 'pdf', endpoint: '/dpi-convert', configFields: [{ key: 'dpi', label: 'DPI', type: 'number', defaultValue: 150 }] },
  { id: 'pdf-print-optimizer', title: 'PDF Print Optimizer', description: 'Compress for print-friendly output.', category: 'optimize', input: 'pdf', output: 'pdf', endpoint: '/compress', configFields: [{ key: 'quality', label: 'Quality', type: 'select', options: ['low', 'medium', 'high'], defaultValue: 'medium' }] },
  { id: 'pdf-web-optimizer', title: 'PDF Web Optimizer', description: 'Compress (Ghostscript) and/or linearize (qpdf) for faster web viewing. Fails closed if tools are missing.', category: 'optimize', input: 'pdf', output: 'pdf', endpoint: '/web-optimize', capability: 'requires-engine', honestyNote: 'Requires Ghostscript and/or qpdf on the API host.' },

  // —— Quality ——
  { id: 'pdf-accessibility-checker', title: 'PDF Accessibility Checker', description: 'Run basic accessibility heuristics (tags, language, title).', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'quality', input: 'pdf', output: 'json', endpoint: '/accessibility-check' },
  { id: 'pdf-validator', title: 'PDF Validator', description: 'Validate that the file opens as a PDF and report structure basics.', category: 'quality', input: 'pdf', output: 'json', endpoint: '/validate' },
  { id: 'pdf-repair', title: 'PDF Repair', description: 'Attempt to rewrite/repair a damaged PDF with PDFBox.', category: 'quality', input: 'pdf', output: 'pdf', endpoint: '/repair' },

  // —— Organize ——
  { id: 'pdf-duplicate-finder', title: 'PDF Duplicate Finder', description: 'Compare multiple PDFs by content hash to find duplicates.', category: 'organize', input: 'multi-pdf', output: 'json', endpoint: '/find-duplicates' },
  { id: 'pdf-search', title: 'PDF Search', description: 'Search for a keyword inside a PDF and return matching pages.', category: 'organize', input: 'pdf', output: 'json', endpoint: '/search', configFields: [{ key: 'query', label: 'Search query', type: 'text', defaultValue: '' }] },
  { id: 'pdf-batch-processing', title: 'PDF Batch Processing', description: 'Run an operation on many PDFs (or a ZIP) asynchronously and download the result ZIP.', category: 'organize', input: 'multi-pdf', accept: '.pdf,application/pdf,.zip,application/zip', output: 'zip', endpoint: '/batch', asyncJob: true, configFields: [
    { key: 'operation', label: 'Operation', type: 'select', options: ['remove-metadata', 'remove-annotations', 'remove-hidden', 'rotate', 'watermark', 'page-numbers', 'flatten-form', 'repair'], defaultValue: 'remove-metadata' },
    { key: 'degrees', label: 'Rotate degrees', type: 'number', defaultValue: 90 },
    { key: 'watermarkText', label: 'Watermark text', type: 'text', defaultValue: 'CONFIDENTIAL' },
    { key: 'opacity', label: 'Watermark opacity', type: 'number', defaultValue: 0.3 },
    { key: 'startAt', label: 'Page numbers start at', type: 'number', defaultValue: 1 },
  ] },
  { id: 'pdf-file-renamer', title: 'PDF File Renamer', description: 'Rename output using a pattern with {name}, {pages}, {date}.', category: 'organize', input: 'pdf', output: 'pdf', endpoint: '/rename-passthrough', configFields: [{ key: 'pattern', label: 'Filename pattern', type: 'text', defaultValue: '{name}-clean-{date}.pdf' }] },
  { id: 'pdf-organizer', title: 'PDF Organizer', description: 'Sort and merge multiple PDFs by filename into one document.', category: 'organize', input: 'multi-pdf', output: 'pdf', endpoint: '/organize-merge' },

  // —— Compare ——
  { id: 'pdf-version-comparison', title: 'PDF Version Comparison', description: 'Compare page counts and text hashes between two PDFs.', category: 'compare', input: 'multi-pdf', output: 'json', endpoint: '/compare-versions' },
  { id: 'pdf-visual-comparison', title: 'PDF Visual Comparison', description: 'Compare first-page renders and report similarity score.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'compare', input: 'multi-pdf', output: 'json', endpoint: '/compare-visual' },
  { id: 'pdf-diff', title: 'PDF Diff', description: 'Diff extracted text between two PDFs.', category: 'compare', input: 'multi-pdf', output: 'text', endpoint: '/diff-text' },

  // —— Analysis (heuristic / open-source, no paid LLM) ——
  { id: 'pdf-keyword-finder', title: 'PDF Keyword Finder', description: 'Find frequent keywords in the document (frequency-based).', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'json', endpoint: '/keywords' },
  { id: 'pdf-citation-generator', title: 'PDF Citation Generator', description: 'Generate a basic citation from PDF metadata and filename.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'text', endpoint: '/citation' },
  { id: 'pdf-reference-extractor', title: 'PDF Reference Extractor', description: 'Extract lines that look like bibliographic references.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'text', endpoint: '/references' },
  { id: 'pdf-invoice-extractor', title: 'PDF Invoice Extractor', description: 'Heuristically extract invoice-like fields (totals, dates, IDs).', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'json', endpoint: '/extract-invoice' },
  { id: 'pdf-receipt-extractor', title: 'PDF Receipt Extractor', description: 'Heuristically extract receipt-like totals and merchants.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'json', endpoint: '/extract-receipt' },
  { id: 'pdf-resume-parser', title: 'PDF Resume Parser', description: 'Parse common resume sections (experience, education, skills).', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'json', endpoint: '/parse-resume' },
  { id: 'pdf-contract-analyzer', title: 'PDF Contract Analyzer', description: 'Flag common contract clauses and risk keywords.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'json', endpoint: '/analyze-contract' },
  { id: 'pdf-document-classifier', title: 'PDF Document Classifier', description: 'Classify the document type using keyword heuristics.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'json', endpoint: '/classify' },
  { id: 'pdf-data-extractor', title: 'PDF Data Extractor', description: 'Extract emails, phones, URLs, and amounts from the PDF.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'json', endpoint: '/extract-data' },
  { id: 'pdf-entity-extractor', title: 'PDF Entity Extractor', description: 'Extract named-entity-like patterns (orgs, dates, money).', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'analysis', input: 'pdf', output: 'json', endpoint: '/extract-entities' },

  // —— Generate from PDF text ——
  { id: 'pdf-summarizer', title: 'PDF Summarizer', description: 'Create an extractive summary from the most important sentences.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'generate', input: 'pdf', output: 'text', endpoint: '/summarize', configFields: [{ key: 'sentences', label: 'Sentence count', type: 'number', defaultValue: 5 }] },
  { id: 'pdf-question-generator', title: 'PDF Question Generator', description: 'Generate study questions from document sentences.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'generate', input: 'pdf', output: 'text', endpoint: '/generate-questions' },
  { id: 'pdf-quiz-generator', title: 'PDF Quiz Generator', description: 'Generate a simple quiz from document content.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'generate', input: 'pdf', output: 'json', endpoint: '/generate-quiz' },
  { id: 'pdf-flashcard-generator', title: 'PDF Flashcard Generator', description: 'Generate Q/A flashcards from key sentences.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'generate', input: 'pdf', output: 'json', endpoint: '/generate-flashcards' },
  { id: 'pdf-notes-generator', title: 'PDF Notes Generator', description: 'Generate structured study notes from the PDF.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'generate', input: 'pdf', output: 'markdown', endpoint: '/generate-notes' },
  { id: 'pdf-mind-map-generator', title: 'PDF Mind Map Generator', description: 'Generate a text mind-map outline from headings and keywords.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'generate', input: 'pdf', output: 'text', endpoint: '/generate-mindmap' },
  { id: 'pdf-presentation-generator', title: 'PDF Presentation Generator', description: 'Generate slide-style outline text from the PDF.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'generate', input: 'pdf', output: 'markdown', endpoint: '/generate-presentation' },
  { id: 'pdf-report-generator', title: 'PDF Report Generator', description: 'Generate a short report PDF from extracted content.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'generate', input: 'pdf', output: 'pdf', endpoint: '/generate-report' },

  // —— Accessibility ——
  { id: 'pdf-accessibility-tagger', title: 'PDF Accessibility Tagger', description: 'Set document language and title metadata for accessibility.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'a11y', input: 'pdf', output: 'pdf', endpoint: '/accessibility-tag', configFields: [
    { key: 'title', label: 'Document title', type: 'text', defaultValue: '' },
    { key: 'language', label: 'Language code', type: 'text', defaultValue: 'en-US' },
  ]},
  { id: 'pdf-reading-order-fixer', title: 'PDF Reading Order Fixer', description: 'Rewrite pages in file order as a best-effort reading-order fix.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'a11y', input: 'pdf', output: 'pdf', endpoint: '/fix-reading-order' },
  { id: 'pdf-alt-text-generator', title: 'PDF Alt Text Generator', description: 'Generate placeholder alt-text suggestions for pages with images.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'a11y', input: 'pdf', output: 'json', endpoint: '/alt-text-suggestions' },

  // —— Privacy ——
  { id: 'pdf-redact', title: 'PDF Redact', description: 'Image redaction: draw regions on the preview and/or match text, then rebuild as image-only pages (underlying text is destroyed).', category: 'privacy', input: 'pdf', output: 'pdf', endpoint: '/redact', configFields: [
    { key: 'query', label: 'Text to redact', type: 'text', defaultValue: '', placeholder: 'e.g. SSN or name' },
    { key: 'regions', label: 'Regions JSON (optional)', type: 'textarea', defaultValue: '', placeholder: '[{"pageIndex":0,"x":72,"y":700,"width":200,"height":16}]' },
    { key: 'dpi', label: 'Render DPI', type: 'number', defaultValue: 150 },
  ]},
  { id: 'pdf-redaction-finder', title: 'PDF Redaction Finder', description: 'Find likely redacted or blacked-out regions heuristically.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'privacy', input: 'pdf', output: 'json', endpoint: '/find-redactions' },
  { id: 'pdf-sensitive-data-scanner', title: 'PDF Sensitive Data Scanner', description: 'Scan for secrets, keys, and confidential markers.', category: 'privacy', input: 'pdf', output: 'json', endpoint: '/scan-sensitive' },
  { id: 'pdf-pii-detector', title: 'PDF PII Detector', description: 'Detect emails, phones, SSNs, and card-like numbers.', category: 'privacy', input: 'pdf', output: 'json', endpoint: '/detect-pii' },

  // —— AI-ish local assistants (extractive, no external LLM) ——
  { id: 'pdf-ai-assistant', title: 'PDF AI Assistant', description: 'Ask a question; answers use extractive matching from the PDF text (local, no cloud LLM).', capability: 'heuristic', honestyNote: 'Local extractive matching only — not a cloud LLM.', category: 'ai', input: 'pdf', output: 'text', endpoint: '/ask', configFields: [{ key: 'question', label: 'Your question', type: 'textarea', defaultValue: 'What is this document about?' }] },
  { id: 'multi-pdf-search', title: 'Multi-PDF Search', description: 'Search a keyword across multiple PDFs.', category: 'ai', input: 'multi-pdf', output: 'json', endpoint: '/multi-search', configFields: [{ key: 'query', label: 'Search query', type: 'text', defaultValue: '' }] },
  { id: 'multi-pdf-chat', title: 'Multi-PDF Chat', description: 'Ask a question across multiple PDFs using extractive retrieval.', capability: 'heuristic', honestyNote: 'Local extractive matching only — not a cloud LLM.', category: 'ai', input: 'multi-pdf', output: 'text', endpoint: '/multi-ask', configFields: [{ key: 'question', label: 'Your question', type: 'textarea', defaultValue: 'Summarize the key points.' }] },
  { id: 'pdf-knowledge-base', title: 'PDF Knowledge Base', description: 'Build a searchable text knowledge index from multiple PDFs.', capability: 'heuristic', honestyNote: 'Local extractive matching only — not a cloud LLM.', category: 'ai', input: 'multi-pdf', output: 'json', endpoint: '/knowledge-base' },
  { id: 'pdf-rag', title: 'PDF RAG', description: 'Retrieve top matching passages for a query (local RAG without embeddings API).', capability: 'heuristic', honestyNote: 'Local extractive matching only — not a cloud LLM.', category: 'ai', input: 'pdf', output: 'json', endpoint: '/rag', configFields: [{ key: 'query', label: 'Query', type: 'text', defaultValue: '' }] },
  { id: 'pdf-workflow-automation', title: 'PDF Workflow Automation', description: 'Run a simple pipeline: unlock metadata wipe → compress → download.', category: 'ai', input: 'pdf', output: 'pdf', endpoint: '/workflow-clean', needsPassword: false },
  { id: 'pdf-translation-layout', title: 'PDF Translation with Layout Preservation', description: 'Produce a side-by-side text translation sheet (dictionary-light English gloss). Full MT requires an external model.', capability: 'heuristic', honestyNote: 'Heuristic / best-effort open-source analysis — not a trained ML model.', category: 'ai', input: 'pdf', output: 'pdf', endpoint: '/translation-sheet' },
];

export function getPdfAdvancedTool(id) {
  return PDF_ADVANCED_TOOLS.find((t) => t.id === id);
}
