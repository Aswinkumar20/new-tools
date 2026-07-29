import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  MARKDOWN_DOMPURIFY_CDN,
  MARKDOWN_DOMPURIFY_CONFIG,
  MARKDOWN_MARKED_CDN,
  MARKDOWN_MARKED_OPTIONS,
  MARKDOWN_MAX_FILE_SIZE_BYTES,
  MARKDOWN_MAX_ZOOM,
  MARKDOWN_MIN_ZOOM,
  MARKDOWN_SUPPORTED_EXTENSIONS,
  MARKDOWN_ZOOM_STEP
} from '../constants/markdown-previewer.constants';
import type {
  DomPurifyLibrary,
  MarkdownFile,
  MarkdownValidationResult,
  MarkedLibrary
} from '../types/markdown-previewer.types';

declare global {
  interface Window {
    marked?: MarkedLibrary;
    DOMPurify?: DomPurifyLibrary;
  }
}

export function getMarkdownFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return '';
  }
  return `.${parts.pop()?.toLowerCase() ?? ''}`;
}

export function isMarkdownFile(
  file: Pick<File, 'name' | 'type'>,
  extensions: ReadonlyArray<string> = MARKDOWN_SUPPORTED_EXTENSIONS
): boolean {
  const fileName = file.name.toLowerCase();
  return (
    extensions.some((ext) => fileName.endsWith(ext)) ||
    file.type === 'text/markdown' ||
    file.type === 'text/x-markdown'
  );
}

export function formatMarkdownFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function clampMarkdownZoom(level: number): number {
  return Math.max(MARKDOWN_MIN_ZOOM, Math.min(MARKDOWN_MAX_ZOOM, level));
}

export function stepMarkdownZoom(current: number, direction: 1 | -1): number {
  return clampMarkdownZoom(current + direction * MARKDOWN_ZOOM_STEP);
}

export function escapeMarkdownHtml(text: string): string {
  if (typeof document === 'undefined') {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function validateMarkdownFiles(
  files: ReadonlyArray<File>,
  options: {
    maxFileSize?: number;
    formatFileSize?: (bytes: number) => string;
  } = {}
): MarkdownValidationResult {
  const maxFileSize = options.maxFileSize ?? MARKDOWN_MAX_FILE_SIZE_BYTES;
  const formatSize = options.formatFileSize ?? formatMarkdownFileSize;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!isMarkdownFile(file)) {
      errors.push(
        `${file.name}: Unsupported file format. Only Markdown files (.md, .markdown) are supported.`
      );
      continue;
    }

    if (file.size > maxFileSize) {
      errors.push(`${file.name}: File too large (max ${formatSize(maxFileSize)})`);
      continue;
    }

    if (file.size === 0) {
      errors.push(`${file.name}: File is empty`);
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
}

export function buildMarkdownParseErrorHtml(content: string, parseError: unknown): string {
  const message =
    parseError instanceof Error ? parseError.message : 'Unknown parsing error';
  return `<div class="markdown-error">
            <p><strong>Error parsing Markdown:</strong></p>
            <p>${escapeMarkdownHtml(message)}</p>
            <p>The file may contain invalid Markdown syntax. Showing raw content below:</p>
            <pre>${escapeMarkdownHtml(content)}</pre>
          </div>`;
}

export function parseAndSanitizeMarkdown(
  content: string,
  markedLib: MarkedLibrary,
  purify: DomPurifyLibrary
): string {
  try {
    const rawHtml = markedLib.parse(content);
    return purify.sanitize(rawHtml, MARKDOWN_DOMPURIFY_CONFIG as unknown as Record<string, unknown>);
  } catch (parseError) {
    return buildMarkdownParseErrorHtml(content, parseError);
  }
}

export function createMarkdownFileRecord(
  file: File,
  url: string,
  content: string,
  htmlContent: string
): MarkdownFile {
  return {
    name: file.name,
    file,
    url,
    size: file.size,
    content,
    htmlContent,
    lines: content.split('\n').length,
    lastModified: new Date(file.lastModified)
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

export async function loadMarkedLibrary(
  cdnUrl: string = MARKDOWN_MARKED_CDN
): Promise<MarkedLibrary> {
  if (globalThis.window === undefined) {
    throw new TypeError('Marked can only be loaded in browser environment');
  }

  if (globalThis.window.marked) {
    return globalThis.window.marked;
  }

  const script = document.createElement('script');
  script.src = cdnUrl;
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const markedLib = globalThis.window.marked;
      if (!markedLib) {
        reject(new Error('Failed to load marked library'));
        return;
      }
      markedLib.setOptions(MARKDOWN_MARKED_OPTIONS);
      resolve(markedLib);
    };
    script.onerror = () => reject(new Error('Failed to load marked library'));
  });
}

export async function loadDomPurifyLibrary(
  cdnUrl: string = MARKDOWN_DOMPURIFY_CDN
): Promise<DomPurifyLibrary> {
  if (globalThis.window === undefined) {
    throw new TypeError('DOMPurify can only be loaded in browser environment');
  }

  if (globalThis.window.DOMPurify) {
    return globalThis.window.DOMPurify;
  }

  const script = document.createElement('script');
  script.src = cdnUrl;
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const purify = globalThis.window.DOMPurify;
      if (!purify) {
        reject(new Error('Failed to load DOMPurify library'));
        return;
      }
      resolve(purify);
    };
    script.onerror = () => reject(new Error('Failed to load DOMPurify library'));
  });
}

export function resolveMarkdownSuggestion(options: {
  hasFiles: boolean;
  hasError: boolean;
  currentFileName: string;
  lineCount: number;
}): FvToolSuggestion | null {
  const { hasFiles, hasError, currentFileName, lineCount } = options;
  const ext = getMarkdownFileExtension(currentFileName);

  if (hasError) {
    return {
      id: 'mp-meta',
      title: 'Check the file type?',
      reason:
        'Upload failed or the format was rejected. Confirm MIME type and extension before retrying.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasFiles) {
    return {
      id: 'mp-html',
      title: 'Need HTML output instead of a preview?',
      reason:
        'When you are ready to publish, convert Markdown to HTML for CMS paste or static sites.',
      actionLabel: 'Open Markdown to HTML',
      path: '/data-converters/markdown-to-html'
    };
  }

  if (lineCount > 200) {
    return {
      id: 'mp-pdf',
      title: 'Share this as a PDF?',
      reason:
        'Longer docs often need a printable export. Convert to PDF after you finish editing here.',
      actionLabel: 'Open Markdown to PDF',
      path: '/code-file-tools/markdown-to-pdf'
    };
  }

  if (ext && !MARKDOWN_SUPPORTED_EXTENSIONS.includes(ext as typeof MARKDOWN_SUPPORTED_EXTENSIONS[number])) {
    return {
      id: 'mp-text',
      title: 'Open as plain text?',
      reason: 'Unusual extensions may still be readable in Text File Viewer.',
      actionLabel: 'Open Text File Viewer',
      path: '/file-viewers/text-file-viewer'
    };
  }

  return {
    id: 'mp-html-loaded',
    title: 'Export this preview as HTML?',
    reason: 'Copy production-ready HTML from Markdown to HTML without re-uploading.',
    actionLabel: 'Open Markdown to HTML',
    path: '/data-converters/markdown-to-html'
  };
}
