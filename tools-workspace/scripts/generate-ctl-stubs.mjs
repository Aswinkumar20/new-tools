import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

const CTL_SCSS = `@use '../../../../../../apps/tools-site/src/app/compact-tool-layout.scss';
@use '../ctl-planned.scss';
`;

const PDF_BASE = path.join(ROOT, 'libs/pdf-tools/src/lib/component');

const pdfStubs = [
  {
    folder: 'text-to-pdf',
    selector: 'lib-text-to-pdf',
    className: 'TextToPdfComponent',
    title: 'Text to PDF',
    description: 'Convert plain text or Markdown into a formatted PDF with page size, margins, and font controls.',
    uploadLabel: 'Text or document upload',
    uploadHint: 'Paste text or upload .txt / .md files — up to 10 MB per file.',
    acceptHint: 'TXT, MD',
    features: [
      'Live preview with page breaks and headers/footers',
      'A4, Letter, and Legal page sizes with custom margins',
      'Monospace or serif font selection with adjustable size',
      'Optional title page and automatic page numbering',
    ],
    help: [
      'Paste or type content in the editor — PDF generates as you adjust options.',
      'Choose page size and orientation before export.',
      'Download runs entirely in your browser; nothing is uploaded.',
    ],
    info: [
      { accent: true, text: 'Processing will run <strong>locally</strong> in your browser.' },
      { text: 'Supports UTF-8 text and basic Markdown headings.' },
    ],
  },
  {
    folder: 'tables-charts-to-pdf',
    selector: 'lib-tables-charts-to-pdf',
    className: 'TablesChartsToPdfComponent',
    title: 'Tables & Charts to PDF',
    description: 'Turn spreadsheet data, HTML tables, or chart images into print-ready PDF documents.',
    uploadLabel: 'Data or image upload',
    uploadHint: 'Drop CSV, Excel, HTML table exports, or chart PNG/SVG files.',
    acceptHint: 'CSV, XLSX, HTML, PNG, SVG',
    features: [
      'Import CSV/Excel and render styled tables with pagination',
      'Paste HTML tables or embed chart screenshots',
      'Column width, header repeat, and landscape layout options',
      'Export single or multi-page PDF with optional cover sheet',
    ],
    help: [
      'Upload a data file or paste a table to preview the layout.',
      'Adjust column sizing and page breaks before export.',
      'Chart images are scaled to fit the selected page size.',
    ],
    info: [
      { accent: true, text: 'No server upload — tables are rendered client-side.' },
      { text: 'Large datasets may be split across multiple PDF pages.' },
    ],
  },
  {
    folder: 'screenshot-to-pdf',
    selector: 'lib-screenshot-to-pdf',
    className: 'ScreenshotToPdfComponent',
    title: 'Screenshot to PDF',
    description: 'Combine screenshots or images into a single PDF — ideal for documentation and bug reports.',
    uploadLabel: 'Image upload',
    uploadHint: 'Drag PNG, JPG, or WebP screenshots — multiple files supported.',
    acceptHint: 'PNG, JPG, WebP',
    features: [
      'Batch import with drag-and-drop reordering',
      'One image per page or tiled grid layouts',
      'Optional captions and margin padding',
      'Fit-to-page or original resolution export',
    ],
    help: [
      'Upload one or more screenshots and arrange their order.',
      'Choose one-image-per-page or a contact-sheet grid.',
      'Download a merged PDF when the preview looks correct.',
    ],
    info: [
      { accent: true, text: 'Images never leave your device during conversion.' },
      { text: 'Recommended max 50 MB total upload size.' },
    ],
  },
  {
    folder: 'resume-invoice-generator',
    selector: 'lib-resume-invoice-generator',
    className: 'ResumeInvoiceGeneratorComponent',
    title: 'Resume & Invoice Generator',
    description: 'Fill structured templates to generate professional resume or invoice PDFs in minutes.',
    uploadLabel: 'Template & logo upload',
    uploadHint: 'Optional logo/photo upload will be enabled — PDF output from form fields.',
    acceptHint: 'PNG, JPG (logo)',
    features: [
      'Resume templates with sections for experience, skills, and education',
      'Invoice layouts with line items, tax, and payment terms',
      'Custom accent color and font pairing',
      'Instant PDF preview and download',
    ],
    help: [
      'Pick a template type (resume or invoice) and fill the form fields.',
      'Upload an optional logo or profile photo.',
      'Export a polished PDF ready to share or print.',
    ],
    info: [
      { text: 'Templates stay editable until you export the final PDF.' },
      { accent: true, text: 'All generation happens <strong>offline</strong> in the browser.' },
    ],
  },
  {
    folder: 'rotate-pages',
    selector: 'lib-rotate-pages',
    className: 'RotatePagesComponent',
    title: 'Rotate PDF Pages',
    description: 'Rotate individual pages or entire documents by 90°, 180°, or 270° — non-destructive preview first.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF file (max 100 MB) to rotate pages.',
    acceptHint: 'PDF',
    features: [
      'Rotate all pages or a selected page range',
      '90° clockwise/counter-clockwise and 180° flip',
      'Thumbnail preview before applying changes',
      'Download rotated PDF without quality loss',
    ],
    help: [
      'Upload a PDF and select pages to rotate.',
      'Preview thumbnails update before you apply.',
      'Download the modified PDF when satisfied.',
    ],
    info: [
      { accent: true, text: 'Rotation uses pdf-lib — files stay on your device.' },
      { text: 'Password-protected PDFs will require unlock first.' },
    ],
  },
  {
    folder: 'reorder-pages',
    selector: 'lib-reorder-pages',
    className: 'ReorderPagesComponent',
    title: 'Reorder PDF Pages',
    description: 'Drag and drop page thumbnails to rearrange, duplicate, or delete pages in a PDF.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF to open the page thumbnail grid.',
    acceptHint: 'PDF',
    features: [
      'Drag-and-drop page thumbnail reordering',
      'Multi-select to move or delete page groups',
      'Duplicate pages for repeated content',
      'Export reordered PDF with one click',
    ],
    help: [
      'Upload a PDF to load page thumbnails.',
      'Drag pages into the desired order.',
      'Export when the sequence is correct.',
    ],
    info: [
      { accent: true, text: 'Page manipulation runs entirely <strong>client-side</strong>.' },
      { text: 'Large documents may take a moment to render thumbnails.' },
    ],
  },
  {
    folder: 'pdf-to-base64',
    selector: 'lib-pdf-to-base64',
    className: 'PdfToBase64Component',
    title: 'PDF to Base64',
    description: 'Encode PDF files to Base64 strings for APIs, data URIs, or embedding in JSON payloads.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF to encode — output copies to clipboard.',
    acceptHint: 'PDF',
    features: [
      'One-click Base64 encoding with data-URI prefix option',
      'Copy to clipboard or download as .txt',
      'File size and character count stats',
      'Chunked output for large files',
    ],
    help: [
      'Upload a PDF to generate its Base64 representation.',
      'Toggle data-URI prefix for use in HTML or CSS.',
      'Copy the encoded string to your clipboard.',
    ],
    info: [
      { accent: true, text: 'Encoding happens locally — the PDF is not sent anywhere.' },
      { text: 'Very large PDFs may produce long strings; use download instead of inline display.' },
    ],
  },
  {
    folder: 'pdf-metadata-editor',
    selector: 'lib-pdf-metadata-editor',
    className: 'PdfMetadataEditorComponent',
    title: 'PDF Metadata Editor',
    description: 'View and edit document properties — title, author, subject, keywords, and creation date.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF to inspect and edit its metadata fields.',
    acceptHint: 'PDF',
    features: [
      'Read existing title, author, subject, and keywords',
      'Edit and write updated metadata back to the PDF',
      'View creation and modification timestamps',
      'Batch-apply defaults across multiple files',
    ],
    help: [
      'Upload a PDF to load its current metadata.',
      'Edit fields in the sidebar form.',
      'Download the PDF with updated properties.',
    ],
    info: [
      { accent: true, text: 'Metadata is rewritten locally with pdf-lib.' },
      { text: 'Some viewers cache old metadata until the file is reopened.' },
    ],
  },
  {
    folder: 'password-protect-pdf',
    selector: 'lib-password-protect-pdf',
    className: 'PasswordProtectPdfComponent',
    title: 'Password Protect PDF',
    description: 'Add open and permissions passwords to PDF files to restrict viewing, printing, or copying.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop an unencrypted PDF to apply password protection.',
    acceptHint: 'PDF',
    features: [
      'User password (required to open) and owner password (permissions)',
      'Restrict printing, copying, and editing',
      'AES-128 encryption for broad compatibility',
      'Verify protection with built-in unlock test',
    ],
    help: [
      'Upload a PDF and set open/owner passwords.',
      'Choose permission restrictions as needed.',
      'Download the encrypted PDF and test with the password.',
    ],
    info: [
      { accent: true, text: 'Encryption runs in-browser; passwords are not stored.' },
      { text: 'Keep your password safe — it cannot be recovered if lost.' },
    ],
  },
  {
    folder: 'highlight-text',
    selector: 'lib-highlight-text',
    className: 'HighlightTextComponent',
    title: 'Highlight PDF Text',
    description: 'Search and highlight text passages in PDF documents with customizable highlight colors.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a searchable PDF to highlight text passages.',
    acceptHint: 'PDF',
    features: [
      'Search keywords and apply yellow/green/custom highlights',
      'Multi-highlight support across pages',
      'Export highlighted PDF with annotations embedded',
      'Clear individual or all highlights',
    ],
    help: [
      'Upload a text-based PDF (not scanned images).',
      'Search for terms and click to highlight matches.',
      'Download the annotated PDF when done.',
    ],
    info: [
      { text: 'Scanned image-only PDFs require OCR first.' },
      { accent: true, text: 'Highlights are saved as standard PDF annotations.' },
    ],
  },
  {
    folder: 'flatten-pdf-forms',
    selector: 'lib-flatten-pdf-forms',
    className: 'FlattenPdfFormsComponent',
    title: 'Flatten PDF Forms',
    description: 'Convert interactive form fields into static content so values cannot be changed after submission.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a filled PDF form to flatten field values.',
    acceptHint: 'PDF',
    features: [
      'Flatten all fields or selected pages only',
      'Preserve field appearance and values',
      'Remove interactivity while keeping visual layout',
      'Batch flatten multiple forms',
    ],
    help: [
      'Upload a PDF with filled form fields.',
      'Preview which fields will be flattened.',
      'Download the static PDF for archival or sharing.',
    ],
    info: [
      { accent: true, text: 'Flattening is irreversible — keep a copy of the original.' },
      { text: 'Useful before emailing completed forms.' },
    ],
  },
  {
    folder: 'fill-pdf-forms',
    selector: 'lib-fill-pdf-forms',
    className: 'FillPdfFormsComponent',
    title: 'Fill PDF Forms',
    description: 'Detect AcroForm fields in PDFs and fill text boxes, checkboxes, and dropdowns in the browser.',
    uploadLabel: 'PDF form upload',
    uploadHint: 'Drop an interactive PDF form to detect and fill fields.',
    acceptHint: 'PDF',
    features: [
      'Auto-detect text, checkbox, radio, and dropdown fields',
      'Tab through fields with keyboard navigation',
      'Save progress and export filled PDF',
      'Import/export field values as JSON',
    ],
    help: [
      'Upload a PDF with AcroForm fields.',
      'Fill each field in the sidebar or overlay.',
      'Download the completed form as a new PDF.',
    ],
    info: [
      { accent: true, text: 'Form data stays in your browser until you export.' },
      { text: 'XFA-only forms may have limited support.' },
    ],
  },
  {
    folder: 'extract-pages',
    selector: 'lib-extract-pages',
    className: 'ExtractPagesComponent',
    title: 'Extract PDF Pages',
    description: 'Pull specific pages or ranges from a PDF into a new document without re-scanning.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF and specify pages to extract (e.g. 1-3, 7, 10-12).',
    acceptHint: 'PDF',
    features: [
      'Extract by page number, range, or comma-separated list',
      'Preview selected pages before export',
      'Output single PDF or separate files per range',
      'Optional ZIP download for multiple extracts',
    ],
    help: [
      'Upload a PDF and enter page numbers or ranges.',
      'Preview the selection in the canvas area.',
      'Download the extracted pages as a new PDF.',
    ],
    info: [
      { accent: true, text: 'Extraction uses pdf-lib — no server round-trip.' },
      { text: 'Page numbers are 1-based and inclusive.' },
    ],
  },
  {
    folder: 'delete-pages',
    selector: 'lib-delete-pages',
    className: 'DeletePagesComponent',
    title: 'Delete PDF Pages',
    description: 'Remove unwanted pages from a PDF — select individually, by range, or via thumbnail multi-select.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF to pick pages for removal.',
    acceptHint: 'PDF',
    features: [
      'Delete by page number, range, or thumbnail selection',
      'Preview remaining document before export',
      'Undo last deletion in session',
      'Download trimmed PDF instantly',
    ],
    help: [
      'Upload a PDF and select pages to remove.',
      'Review the remaining page count.',
      'Download the trimmed PDF.',
    ],
    info: [
      { accent: true, text: 'Original file is unchanged until you download the result.' },
      { text: 'Always verify page numbers against the thumbnail preview.' },
    ],
  },
  {
    folder: 'create-pdf-from-html',
    selector: 'lib-create-pdf-from-html',
    className: 'CreatePdfFromHtmlComponent',
    title: 'HTML to PDF',
    description: 'Render HTML and CSS into a PDF — paste markup or upload an .html file with print styles.',
    uploadLabel: 'HTML upload',
    uploadHint: 'Paste HTML or drop an .html file — CSS print rules supported.',
    acceptHint: 'HTML, HTM',
    features: [
      'Live HTML/CSS preview before export',
      'Page size, margins, and header/footer templates',
      'Support for web fonts and background colors',
      'Multi-page automatic pagination',
    ],
    help: [
      'Paste HTML or upload a file to preview rendering.',
      'Adjust page settings in the sidebar.',
      'Generate and download the PDF output.',
    ],
    info: [
      { accent: true, text: 'Rendering uses browser print engine — stays local.' },
      { text: 'Complex JavaScript-driven layouts may differ from browser view.' },
    ],
  },
  {
    folder: 'compress-pdf',
    selector: 'lib-compress-pdf',
    className: 'CompressPdfComponent',
    title: 'Compress PDF',
    description: 'Reduce PDF file size by optimizing images, removing unused objects, and choosing quality presets.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF to analyze size and apply compression.',
    acceptHint: 'PDF',
    features: [
      'Quality presets: high, balanced, and maximum compression',
      'Image downsampling and JPEG re-encoding',
      'Before/after size comparison with percent saved',
      'Batch compress multiple PDFs',
    ],
    help: [
      'Upload a PDF to see current file size breakdown.',
      'Pick a compression preset and preview estimated savings.',
      'Download the optimized PDF.',
    ],
    info: [
      { accent: true, text: 'Compression runs locally — quality vs. size is your choice.' },
      { text: 'Text-only PDFs may see minimal size reduction.' },
    ],
  },
  {
    folder: 'annotate-pdf',
    selector: 'lib-annotate-pdf',
    className: 'AnnotatePdfComponent',
    title: 'Annotate PDF',
    description: 'Add notes, shapes, arrows, and freehand drawings on top of PDF pages for review and feedback.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF to open the annotation canvas.',
    acceptHint: 'PDF',
    features: [
      'Sticky notes, highlights, arrows, rectangles, and freehand pen',
      'Color and stroke width controls per tool',
      'Page-by-page annotation with undo/redo',
      'Export PDF with embedded annotations',
    ],
    help: [
      'Upload a PDF and select an annotation tool.',
      'Draw or place markers on the current page.',
      'Download the annotated PDF for sharing.',
    ],
    info: [
      { accent: true, text: 'Annotations export as standard PDF markup.' },
      { text: 'Use zoom controls for precise placement on dense pages.' },
    ],
  },
  {
    folder: 'add-watermark',
    selector: 'lib-add-watermark',
    className: 'AddWatermarkComponent',
    title: 'Add Watermark to PDF',
    description: 'Stamp text or image watermarks across all pages — adjust opacity, rotation, and position.',
    uploadLabel: 'PDF upload',
    uploadHint: 'Drop a PDF plus optional logo/image for watermark overlay.',
    acceptHint: 'PDF, PNG, JPG',
    features: [
      'Text watermarks with custom font, size, and color',
      'Image/logo watermarks with opacity control',
      'Tile, center, or diagonal placement options',
      'Apply to all pages or a selected range',
    ],
    help: [
      'Upload a PDF and configure text or image watermark.',
      'Preview opacity and placement on sample pages.',
      'Download the watermarked PDF.',
    ],
    info: [
      { accent: true, text: 'Watermarking is applied client-side with pdf-lib.' },
      { text: 'Semi-transparent watermarks work best for readability.' },
    ],
  },
];

const mediaStubs = [
  {
    folder: 'audio-player',
    selector: 'lib-audio-player',
    className: 'AudioPlayerComponent',
    title: 'Audio Player',
    description: 'Play MP3, WAV, OGG, and other audio formats with waveform visualization and playlist support.',
    uploadLabel: 'Audio upload',
    uploadHint: 'Drop audio files to build a playlist — playback controls coming soon.',
    acceptHint: 'MP3, WAV, OGG, M4A',
    features: [
      'Waveform scrubber with seek and volume controls',
      'Playlist queue with shuffle and repeat modes',
      'Playback speed adjustment (0.5×–2×)',
      'Keyboard shortcuts for play/pause and skip',
    ],
    help: [
      'Upload one or more audio files to the playlist.',
      'Use the waveform to scrub to any position.',
      'Adjust speed and volume from the sidebar.',
    ],
    info: [
      { accent: true, text: 'Audio is decoded locally — nothing is streamed to a server.' },
      { text: 'Large files may take a moment to generate the waveform.' },
    ],
  },
  {
    folder: 'audio-trimmer',
    selector: 'lib-audio-trimmer',
    className: 'AudioTrimmerComponent',
    title: 'Audio Trimmer',
    description: 'Select start and end points on a waveform to trim audio clips and export in common formats.',
    uploadLabel: 'Audio upload',
    uploadHint: 'Drop an audio file to open the trim editor.',
    acceptHint: 'MP3, WAV, OGG',
    features: [
      'Visual waveform with draggable start/end handles',
      'Precise time input in ms or hh:mm:ss',
      'Fade-in and fade-out options',
      'Export trimmed clip as MP3 or WAV',
    ],
    help: [
      'Upload an audio file to load the waveform.',
      'Drag handles or enter times to set the trim region.',
      'Preview and download the trimmed segment.',
    ],
    info: [
      { accent: true, text: 'Trimming uses the Web Audio API in your browser.' },
      { text: 'Lossy re-encoding may slightly reduce quality on MP3 export.' },
    ],
  },
  {
    folder: 'video-to-gif',
    selector: 'lib-video-to-gif',
    className: 'VideoToGifComponent',
    title: 'Video to GIF',
    description: 'Convert video clips to animated GIFs with frame rate, size, and quality controls.',
    uploadLabel: 'Video upload',
    uploadHint: 'Drop MP4, WebM, or MOV files to convert to GIF.',
    acceptHint: 'MP4, WebM, MOV',
    features: [
      'Trim start/end frames before conversion',
      'Adjust output width, FPS, and color palette',
      'Loop count and reverse playback options',
      'Preview GIF before download',
    ],
    help: [
      'Upload a short video clip (recommended under 30 s).',
      'Set trim range and GIF quality settings.',
      'Generate and download the animated GIF.',
    ],
    info: [
      { accent: true, text: 'Conversion runs locally — longer clips take more time.' },
      { text: 'Reduce FPS and width to keep GIF file size manageable.' },
    ],
  },
  {
    folder: 'webcam-snapshot',
    selector: 'lib-webcam-snapshot',
    className: 'WebcamSnapshotComponent',
    title: 'Webcam Snapshot',
    description: 'Capture photos from your webcam with countdown timer, mirror flip, and instant download.',
    uploadLabel: 'Camera access',
    uploadHint: 'Camera preview will appear here — permission required when available.',
    acceptHint: 'Webcam',
    features: [
      'Live camera preview with device selector',
      'Countdown timer and mirror/flip option',
      'Capture stills as PNG or JPG',
      'Burst mode for multiple frames',
    ],
    help: [
      'Allow camera access when prompted.',
      'Choose resolution and flip options.',
      'Click capture to save a snapshot.',
    ],
    info: [
      { accent: true, text: 'Video stays on your device — no cloud upload.' },
      { text: 'HTTPS is required for getUserMedia in most browsers.' },
    ],
    noUpload: true,
  },
];

function htmlFor(stub, lib) {
  const uploadSection = stub.noUpload
    ? `<div class="ctl__empty ctl-planned__upload" aria-disabled="true">
              <img [src]="assetService.getAssetPath('icons/stats.svg')" alt="" width="40" height="40" />
              <p><strong>Camera preview</strong> — grant permission when this tool launches.</p>
              <span class="ctl-planned__badge">In development</span>
            </div>`
    : `<div class="ctl__empty ctl-planned__upload" aria-disabled="true">
              <img [src]="assetService.getAssetPath('icons/pdf.svg')" alt="" width="40" height="40" />
              <p><strong>{{ uploadHint }}</strong></p>
              <p>Accepted: {{ acceptHint }}</p>
              <span class="ctl-planned__badge">In development</span>
            </div>`;

  const icon = lib === 'media' ? 'icons/stats.svg' : 'icons/pdf.svg';

  return `<div class="ctl">
  <lib-navigation></lib-navigation>

  <main class="ctl__main">
    <div class="ctl__top">
      <header class="ctl__header">
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </header>

      <div class="ctl__stats" aria-label="Tool status">
        <div class="ctl__stat">
          <span class="ctl__stat-value">0</span>
          <span class="ctl__stat-label">Files</span>
        </div>
        <div class="ctl__stat">
          <span class="ctl__stat-value">—</span>
          <span class="ctl__stat-label">Output</span>
        </div>
        <div class="ctl__stat ctl__stat--mode">
          <span class="ctl__stat-value">Planned</span>
          <span class="ctl__stat-label">Status</span>
        </div>
        <div class="ctl__stat ctl__stat--mode">
          <span class="ctl__stat-value">{{ acceptHint }}</span>
          <span class="ctl__stat-label">Formats</span>
        </div>
      </div>
    </div>

    <div class="ctl__workspace">
      <section class="ctl__editor">
        <header class="ctl__editor-head">
          <span>{{ uploadLabel }}</span>
        </header>
        ${uploadSection.replace('icons/pdf.svg', icon)}
      </section>

      <aside class="ctl__sidebar" aria-label="Planned functionality">
        <div class="ctl__panel">
          <header class="ctl__panel-head">
            Planned features
            <span class="ctl__panel-badge">Preview</span>
          </header>
          <ul class="ctl-planned__features">
            @for (feature of features; track feature) {
              <li>{{ feature }}</li>
            }
          </ul>
        </div>
        <div class="ctl__info">
          @for (item of infoItems; track item.text) {
            <div class="ctl__info-item">
              <span class="ctl__info-dot" [class.ctl__info-dot--accent]="item.accent"></span>
              <p [innerHTML]="item.text"></p>
            </div>
          }
        </div>
      </aside>
    </div>

    <details class="ctl__help">
      <summary>How to use</summary>
      <ul>
        @for (item of helpItems; track item) {
          <li>{{ item }}</li>
        }
      </ul>
    </details>
  </main>
</div>
`;
}

function tsFor(stub) {
  const features = stub.features.map((f) => `    '${f.replace(/'/g, "\\'")}',`).join('\n');
  const help = stub.help.map((h) => `    '${h.replace(/'/g, "\\'")}',`).join('\n');
  const info = stub.info
    .map((i) => `    { accent: ${!!i.accent}, text: '${i.text.replace(/'/g, "\\'")}' },`)
    .join('\n');

  return `import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, AssetService } from '@tools-workspace/features-home';

@Component({
  selector: '${stub.selector}',
  standalone: true,
  templateUrl: './${stub.folder}.html',
  styleUrls: ['./${stub.folder}.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ${stub.className} {
  readonly assetService = inject(AssetService);

  readonly title = '${stub.title.replace(/'/g, "\\'")}';
  readonly description = '${stub.description.replace(/'/g, "\\'")}';
  readonly uploadLabel = '${stub.uploadLabel.replace(/'/g, "\\'")}';
  readonly uploadHint = '${stub.uploadHint.replace(/'/g, "\\'")}';
  readonly acceptHint = '${stub.acceptHint.replace(/'/g, "\\'")}';

  readonly features: readonly string[] = [
${features}
  ];

  readonly helpItems: readonly string[] = [
${help}
  ];

  readonly infoItems: readonly { accent?: boolean; text: string }[] = [
${info}
  ];
}
`;
}

function writeStub(baseDir, stub, lib) {
  const dir = path.join(baseDir, stub.folder);
  fs.writeFileSync(path.join(dir, `${stub.folder}.html`), htmlFor(stub, lib));
  fs.writeFileSync(path.join(dir, `${stub.folder}.ts`), tsFor(stub));
  fs.writeFileSync(path.join(dir, `${stub.folder}.scss`), CTL_SCSS);
}

for (const stub of pdfStubs) {
  writeStub(PDF_BASE, stub, 'pdf');
  console.log('pdf stub:', stub.folder);
}

const MEDIA_BASE = path.join(ROOT, 'libs/media-tools/src/lib/component');
for (const stub of mediaStubs) {
  writeStub(MEDIA_BASE, stub, 'media');
  console.log('media stub:', stub.folder);
}

console.log('Done:', pdfStubs.length + mediaStubs.length, 'stubs');
