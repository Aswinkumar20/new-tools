import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  WORD_DOC_PLACEHOLDER_HTML,
  WORD_DOC_PLACEHOLDER_TEXT,
  WORD_LONG_TEXT_CHAR_THRESHOLD,
  WORD_MAMMOTH_CDN,
  WORD_MAMMOTH_STYLE_MAP,
  WORD_MAX_FILE_SIZE_BYTES,
  WORD_MAX_FILE_SIZE_LABEL,
  WORD_MAX_ZOOM,
  WORD_MIN_ZOOM,
  WORD_ODT_PLACEHOLDER_HTML,
  WORD_ODT_PLACEHOLDER_TEXT,
  WORD_SUPPORTED_LABEL,
  WORD_ZOOM_STEP
} from '../constants/word-viewer.constants';
import { DocumentType } from '../types/word-viewer.types';
import type {
  MammothLibrary,
  WordFile,
  WordParseResult,
  WordValidationResult
} from '../types/word-viewer.types';

declare global {
  interface Window {
    mammoth?: MammothLibrary;
  }
}

export async function loadMammothLibrary(
  cdnUrl: string = WORD_MAMMOTH_CDN
): Promise<MammothLibrary> {
  if (globalThis.window === undefined) {
    throw new TypeError('Mammoth.js can only be loaded in browser environment');
  }

  if (globalThis.window.mammoth) {
    return globalThis.window.mammoth;
  }

  const script = document.createElement('script');
  script.src = cdnUrl;
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const mammothLib = globalThis.window.mammoth;
      if (!mammothLib) {
        reject(new Error('Failed to load Mammoth.js library'));
        return;
      }
      resolve(mammothLib);
    };
    script.onerror = () => reject(new Error('Failed to load Mammoth.js library'));
  });
}

export function detectDocumentType(file: File): DocumentType {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (
    fileName.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return DocumentType.DOCX;
  }
  if (fileName.endsWith('.doc') || mimeType === 'application/msword') {
    return DocumentType.DOC;
  }
  if (fileName.endsWith('.rtf') || mimeType === 'application/rtf' || mimeType === 'text/rtf') {
    return DocumentType.RTF;
  }
  if (fileName.endsWith('.odt') || mimeType === 'application/vnd.oasis.opendocument.text') {
    return DocumentType.ODT;
  }
  if (fileName.endsWith('.txt') || mimeType === 'text/plain') {
    return DocumentType.TXT;
  }
  if (fileName.endsWith('.html') || fileName.endsWith('.htm') || mimeType === 'text/html') {
    return DocumentType.HTML;
  }

  return DocumentType.UNSUPPORTED;
}

export function formatWordFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function clampWordZoom(level: number): number {
  return Math.max(WORD_MIN_ZOOM, Math.min(WORD_MAX_ZOOM, level));
}

export function stepWordZoom(current: number, direction: 1 | -1): number {
  return clampWordZoom(current + direction * WORD_ZOOM_STEP);
}

export function computeWordFitToWidthZoom(
  containerWidth: number,
  baseWidth: number
): number {
  if (containerWidth <= 0 || baseWidth <= 0) {
    return WORD_MIN_ZOOM;
  }
  const scale = containerWidth / baseWidth;
  return clampWordZoom(Math.round(scale * 100));
}

export function validateWordFiles(
  files: ReadonlyArray<File>,
  options: {
    maxFileSize?: number;
    maxFileSizeLabel?: string;
  } = {}
): WordValidationResult {
  const maxFileSize = options.maxFileSize ?? WORD_MAX_FILE_SIZE_BYTES;
  const maxLabel = options.maxFileSizeLabel ?? WORD_MAX_FILE_SIZE_LABEL;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const docType = detectDocumentType(file);

    if (docType === DocumentType.UNSUPPORTED) {
      errors.push(
        `${file.name}: Unsupported file format. Supported: ${WORD_SUPPORTED_LABEL}`
      );
      continue;
    }

    if (file.size > maxFileSize) {
      errors.push(`${file.name}: File too large (max ${maxLabel})`);
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
}

export function escapeWordHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function extractTextFromHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

export function convertRtfToHtml(rtfText: string): string {
  let html = rtfText;
  html = html.replace(/\{[^}]*\\rtf[^}]*\}/gi, '');
  html = html.replace(/\\par\s*/gi, '<br>');
  html = html.replace(/\\line\s*/gi, '<br>');
  html = html.replace(/\\[a-z]+\d*\s*/gi, '');
  html = html.replace(/\\[a-z]+\s*/gi, '');
  html = html.replace(/[{}]/g, '');
  html = html.replace(/\n\s*\n/g, '<p></p>');
  return `<div class="rtf-content">${escapeWordHtml(html)}</div>`;
}

export function extractRtfText(rtfText: string): string {
  let text = rtfText;
  text = text.replace(/\\[a-z]+\d*\s*/gi, ' ');
  text = text.replace(/\\[a-z]+\s*/gi, ' ');
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function getDocumentTypeLabel(type: DocumentType): string {
  switch (type) {
    case DocumentType.DOCX:
      return 'DOCX';
    case DocumentType.DOC:
      return 'DOC';
    case DocumentType.RTF:
      return 'RTF';
    case DocumentType.ODT:
      return 'ODT';
    case DocumentType.TXT:
      return 'TXT';
    case DocumentType.HTML:
      return 'HTML';
    default:
      return 'Unknown';
  }
}

export async function parseDocxWithMammoth(
  file: File,
  mammothLib: MammothLibrary
): Promise<WordParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const conversionOptions = { arrayBuffer };

  const result = await mammothLib.convertToHtml(conversionOptions, {
    styleMap: [...WORD_MAMMOTH_STYLE_MAP]
  });
  const textResult = await mammothLib.extractRawText(conversionOptions);

  const warnings = result.messages
    .filter((m) => m.type === 'warning')
    .map((m) => m.message);

  return {
    htmlContent: result.value,
    textContent: textResult.value,
    warnings
  };
}

export async function parseWordDocument(
  file: File,
  mammothLib: MammothLibrary
): Promise<WordParseResult> {
  const docType = detectDocumentType(file);

  switch (docType) {
    case DocumentType.DOCX:
      return parseDocxWithMammoth(file, mammothLib);

    case DocumentType.DOC:
      return {
        htmlContent: WORD_DOC_PLACEHOLDER_HTML,
        textContent: WORD_DOC_PLACEHOLDER_TEXT,
        warnings: []
      };

    case DocumentType.RTF: {
      const rtfText = await file.text();
      return {
        htmlContent: convertRtfToHtml(rtfText),
        textContent: extractRtfText(rtfText),
        warnings: []
      };
    }

    case DocumentType.ODT:
      return {
        htmlContent: WORD_ODT_PLACEHOLDER_HTML,
        textContent: WORD_ODT_PLACEHOLDER_TEXT,
        warnings: []
      };

    case DocumentType.TXT: {
      const txtContent = await file.text();
      return {
        htmlContent: `<div class="txt-content"><pre style="white-space: pre-wrap; font-family: inherit;">${escapeWordHtml(txtContent)}</pre></div>`,
        textContent: txtContent,
        warnings: []
      };
    }

    case DocumentType.HTML: {
      const htmlText = await file.text();
      return {
        htmlContent: htmlText,
        textContent: extractTextFromHtml(htmlText),
        warnings: []
      };
    }

    default:
      throw new Error(`Unsupported file format: ${file.name}`);
  }
}

export function createWordFileRecord(
  file: File,
  url: string,
  htmlContent: string,
  textContent: string
): WordFile {
  return {
    name: file.name,
    file,
    url,
    size: file.size,
    htmlContent,
    textContent,
    documentType: detectDocumentType(file),
    needsPassword: false,
    passwordError: false
  };
}

export function isFullscreenActive(doc: Document = document): boolean {
  const extended = doc as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return !!(
    doc.fullscreenElement ||
    extended.webkitFullscreenElement ||
    extended.mozFullScreenElement ||
    extended.msFullscreenElement
  );
}

export function safeRevokeObjectUrl(url: string | undefined): void {
  if (!url) {
    return;
  }
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore invalid object URLs during teardown
  }
}

export function resolveWordSuggestion(options: {
  hasFiles: boolean;
  hasError: boolean;
  documentType: DocumentType | null;
  textLength: number;
}): FvToolSuggestion | null {
  const { hasFiles, hasError, documentType, textLength } = options;

  if (hasError) {
    return {
      id: 'wv-meta',
      title: 'Check the file type?',
      reason:
        'Upload failed or the format was rejected. Confirm MIME type before retrying.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasFiles) {
    return {
      id: 'wv-pdf',
      title: 'Need a PDF of your document?',
      reason:
        'After drafting in Word, export to PDF and preview it with PDF Viewer for sharing.',
      actionLabel: 'Open PDF Viewer',
      path: '/file-viewers/pdf-viewer'
    };
  }

  if (documentType === DocumentType.DOC || documentType === DocumentType.ODT) {
    return {
      id: 'wv-convert',
      title: 'Convert to DOCX for full preview?',
      reason:
        'Legacy DOC and ODT files show limited previews here. Convert to DOCX for richer formatting.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (documentType === DocumentType.TXT || documentType === DocumentType.HTML) {
    return {
      id: 'wv-text',
      title: 'Prefer a plain-text workspace?',
      reason:
        'TXT and HTML also work in Text File Viewer with search and line numbers.',
      actionLabel: 'Open Text File Viewer',
      path: '/file-viewers/text-file-viewer'
    };
  }

  if (textLength > WORD_LONG_TEXT_CHAR_THRESHOLD) {
    return {
      id: 'wv-pdf-long',
      title: 'Share this as a PDF?',
      reason:
        'Long documents are easier to hand off as PDF. Preview the export in PDF Viewer.',
      actionLabel: 'Open PDF Viewer',
      path: '/file-viewers/pdf-viewer'
    };
  }

  return {
    id: 'wv-pptx',
    title: 'Have a matching slide deck?',
    reason:
      'Projects often pair Word notes with PowerPoint. Open PowerPoint Viewer for the companion deck.',
    actionLabel: 'Open PowerPoint Viewer',
    path: '/file-viewers/powerpoint-viewer'
  };
}
