import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  TEXT_JS_KEYWORDS,
  TEXT_LONG_FILE_LINE_THRESHOLD,
  TEXT_MAX_FILE_SIZE_BYTES,
  TEXT_MAX_FILE_SIZE_LABEL,
  TEXT_MAX_ZOOM,
  TEXT_MIN_ZOOM,
  TEXT_ZOOM_STEP
} from '../constants/text-file-viewer.constants';
import { TextFileType } from '../types/text-file-viewer.types';
import type { TextFile, TextFileValidationResult } from '../types/text-file-viewer.types';

export function detectTextFileType(file: File): TextFileType {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (fileName.endsWith('.txt') || mimeType === 'text/plain') {
    return TextFileType.TXT;
  }
  if (fileName.endsWith('.log')) {
    return TextFileType.LOG;
  }
  if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
    return TextFileType.MD;
  }
  if (fileName.endsWith('.json') || mimeType === 'application/json') {
    return TextFileType.JSON;
  }
  if (fileName.endsWith('.xml') || mimeType === 'application/xml' || mimeType === 'text/xml') {
    return TextFileType.XML;
  }
  if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
    return TextFileType.YAML;
  }
  if (fileName.endsWith('.ini') || fileName.endsWith('.cfg') || fileName.endsWith('.config')) {
    return TextFileType.INI;
  }
  if (fileName.endsWith('.csv') || mimeType === 'text/csv') {
    return TextFileType.CSV;
  }
  if (fileName.endsWith('.rtf') || mimeType === 'application/rtf' || mimeType === 'text/rtf') {
    return TextFileType.RTF;
  }
  if (fileName.endsWith('.html') || fileName.endsWith('.htm') || mimeType === 'text/html') {
    return TextFileType.HTML;
  }
  if (fileName.endsWith('.css') || mimeType === 'text/css') {
    return TextFileType.CSS;
  }
  if (
    fileName.endsWith('.js') ||
    mimeType === 'application/javascript' ||
    mimeType === 'text/javascript'
  ) {
    return TextFileType.JS;
  }
  if (fileName.endsWith('.ts') || mimeType === 'application/typescript') {
    return TextFileType.TS;
  }
  if (fileName.endsWith('.py') || mimeType === 'text/x-python') {
    return TextFileType.PY;
  }
  if (fileName.endsWith('.sh') || mimeType === 'application/x-sh') {
    return TextFileType.SH;
  }
  if (fileName.endsWith('.bat') || fileName.endsWith('.cmd')) {
    return TextFileType.BAT;
  }
  if (fileName.endsWith('.ps1')) {
    return TextFileType.PS1;
  }

  if (mimeType.startsWith('text/')) {
    return TextFileType.TXT;
  }

  return TextFileType.UNSUPPORTED;
}

export function formatTextFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function clampTextZoom(level: number): number {
  return Math.max(TEXT_MIN_ZOOM, Math.min(TEXT_MAX_ZOOM, level));
}

export function stepTextZoom(current: number, direction: 1 | -1): number {
  return clampTextZoom(current + direction * TEXT_ZOOM_STEP);
}

/**
 * Preserves legacy behavior: only size is validated.
 * Unsupported extensions are still accepted and read as text.
 */
export function validateTextFiles(
  files: ReadonlyArray<File>,
  options: {
    maxFileSize?: number;
    maxFileSizeLabel?: string;
  } = {}
): TextFileValidationResult {
  const maxFileSize = options.maxFileSize ?? TEXT_MAX_FILE_SIZE_BYTES;
  const maxLabel = options.maxFileSizeLabel ?? TEXT_MAX_FILE_SIZE_LABEL;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (file.size > maxFileSize) {
      errors.push(`${file.name}: File too large (max ${maxLabel})`);
      continue;
    }
    validFiles.push(file);
  }

  return { validFiles, errors };
}

export async function readTextFileContent(file: File): Promise<{ content: string; encoding: string }> {
  try {
    const content = await file.text();
    return { content, encoding: 'UTF-8' };
  } catch {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return { content: decoder.decode(arrayBuffer), encoding: 'UTF-8' };
  }
}

export function createTextFileRecord(
  file: File,
  url: string,
  content: string,
  encoding: string
): TextFile {
  return {
    name: file.name,
    file,
    url,
    size: file.size,
    content,
    lines: content.split('\n').length,
    fileType: detectTextFileType(file),
    encoding
  };
}

export function escapeTextHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function escapeTextRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findTextSearchMatchIndexes(
  text: string,
  searchText: string,
  caseSensitive: boolean
): number[] {
  if (!searchText) {
    return [];
  }
  const regex = new RegExp(escapeTextRegex(searchText), caseSensitive ? 'g' : 'gi');
  const indexes: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    indexes.push(match.index);
  }
  return indexes;
}

export function getTextFileTypeLabel(type: TextFileType): string {
  return type.toUpperCase();
}

export function highlightJSON(content: string): string {
  try {
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);
    let html = escapeTextHtml(formatted);

    html = html.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-value';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        } else if (/^\d/.test(match)) {
          cls = 'json-number';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );

    return html;
  } catch {
    return escapeTextHtml(content);
  }
}

export function highlightXML(content: string): string {
  let html = escapeTextHtml(content);

  html = html.replace(
    /&lt;(\/?)([\w\-\:]+)([^&]*?)(\/?)&gt;/g,
    (_match, closing, tagName, attrs, selfClosing) => {
      const attrsHighlighted = attrs.replace(
        /(\w+)=("([^"]*)")/g,
        '<span class="xml-attr-name">$1</span>=<span class="xml-attr-value">"$3"</span>'
      );
      const cls = closing
        ? 'xml-tag-closing'
        : selfClosing
          ? 'xml-tag-self-closing'
          : 'xml-tag-opening';
      return `&lt;${closing}<span class="${cls}">${tagName}</span>${attrsHighlighted}${selfClosing}&gt;`;
    }
  );

  return html;
}

export function highlightYAML(content: string): string {
  let html = escapeTextHtml(content);

  html = html.replace(/^(\s*)([^:]+):(\s*)(.*)$/gm, (_match, indent, key, space, value) => {
    const valueHighlighted = value
      .replace(/^(["'])(.*)\1$/, '<span class="yaml-string">$1$2$1</span>')
      .replace(/^\d+(\.\d+)?$/, '<span class="yaml-number">$&</span>')
      .replace(/^(true|false|null)$/i, '<span class="yaml-boolean">$&</span>');
    return `${indent}<span class="yaml-key">${key}</span>:${space}${valueHighlighted}`;
  });

  return html;
}

export function highlightHTML(content: string): string {
  return highlightXML(content);
}

export function highlightCSS(content: string): string {
  let html = escapeTextHtml(content);

  html = html
    .replace(/([.#][\w-]+)\s*\{/g, '<span class="css-selector">$1</span> {')
    .replace(/([\w-]+)\s*:/g, '<span class="css-property">$1</span>:')
    .replace(/:([^;]+);/g, ': <span class="css-value">$1</span>;');

  return html;
}

export function highlightJS(content: string): string {
  let html = escapeTextHtml(content);

  for (const keyword of TEXT_JS_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    html = html.replace(regex, `<span class="js-keyword">${keyword}</span>`);
  }

  html = html
    .replace(/("(\\"|[^"])*"|'(\\'|[^'])*')/g, '<span class="js-string">$&</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="js-number">$1</span>')
    .replace(/\/\/.*$/gm, '<span class="js-comment">$&</span>')
    .replace(/\/\*[\s\S]*?\*\//g, '<span class="js-comment">$&</span>');

  return html;
}

export function highlightSyntax(content: string, fileType: TextFileType): string {
  switch (fileType) {
    case TextFileType.JSON:
      return highlightJSON(content);
    case TextFileType.XML:
      return highlightXML(content);
    case TextFileType.YAML:
    case TextFileType.YML:
      return highlightYAML(content);
    case TextFileType.HTML:
      return highlightHTML(content);
    case TextFileType.CSS:
      return highlightCSS(content);
    case TextFileType.JS:
    case TextFileType.TS:
      return highlightJS(content);
    default:
      return escapeTextHtml(content);
  }
}

export function formatTextContent(
  content: string,
  fileType: TextFileType,
  showLineNumbers: boolean
): string {
  const highlightedContent = highlightSyntax(content, fileType);

  if (!showLineNumbers) {
    return highlightedContent;
  }

  const lines = highlightedContent.split('\n');
  const pad = lines.length.toString().length;
  const formattedLines = lines.map((line, index) => {
    const lineNumber = (index + 1).toString().padStart(pad, ' ');
    return `<span class="line-number">${lineNumber}</span><span class="line-content">${line}</span>`;
  });
  return formattedLines.join('\n');
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

export function resolveTextFileSuggestion(options: {
  hasFiles: boolean;
  hasError: boolean;
  fileType: TextFileType | null;
  lineCount: number;
}): FvToolSuggestion | null {
  const { hasFiles, hasError, fileType, lineCount } = options;

  if (hasError) {
    return {
      id: 'tf-meta',
      title: 'Check the file type?',
      reason:
        'Upload failed or the file could not be read. Confirm MIME type and encoding before retrying.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasFiles) {
    return {
      id: 'tf-markdown',
      title: 'Opening Markdown docs?',
      reason:
        'For README and notes, Markdown Previewer renders GFM instead of plain text.',
      actionLabel: 'Open Markdown Previewer',
      path: '/file-viewers/markdown-previewer'
    };
  }

  if (fileType === TextFileType.JSON) {
    return {
      id: 'tf-json',
      title: 'Format and validate this JSON?',
      reason: 'Beautify, validate, and fix JSON in the dedicated formatter.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (fileType === TextFileType.MD) {
    return {
      id: 'tf-md',
      title: 'Preview this as Markdown?',
      reason: 'Render headings, lists, and code blocks with Markdown Previewer.',
      actionLabel: 'Open Markdown Previewer',
      path: '/file-viewers/markdown-previewer'
    };
  }

  if (fileType === TextFileType.LOG) {
    return {
      id: 'tf-log',
      title: 'Browse this as a log file?',
      reason: 'Log Viewer adds filtering and severity cues for operational logs.',
      actionLabel: 'Open Log Viewer',
      path: '/file-viewers/log-viewer'
    };
  }

  if (fileType === TextFileType.CSV) {
    return {
      id: 'tf-csv',
      title: 'Convert this CSV to JSON?',
      reason: 'Turn tabular text into structured JSON for APIs and scripts.',
      actionLabel: 'Open CSV ↔ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (lineCount > TEXT_LONG_FILE_LINE_THRESHOLD) {
    return {
      id: 'tf-log-long',
      title: 'Large text file — try Log Viewer?',
      reason:
        'Long files are easier to scan with filters. Log Viewer helps when lines look like logs.',
      actionLabel: 'Open Log Viewer',
      path: '/file-viewers/log-viewer'
    };
  }

  return {
    id: 'tf-json-loaded',
    title: 'Working with structured data?',
    reason: 'If this is JSON or CSV, formatters and converters can save cleanup time.',
    actionLabel: 'Open JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator'
  };
}
