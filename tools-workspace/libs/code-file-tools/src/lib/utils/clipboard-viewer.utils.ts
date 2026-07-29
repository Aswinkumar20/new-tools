import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import { CLIPBOARD_VIEWER_PREVIEW_MAX_LENGTH } from '../constants/clipboard-viewer.constants';
import type {
  ClipboardContent,
  ClipboardContentType
} from '../types/clipboard-viewer.types';

export function isClipboardViewerSupported(isBrowser: boolean): boolean {
  return isBrowser && typeof navigator !== 'undefined' && !!navigator.clipboard;
}

export function createEmptyClipboardContent(timestamp = Date.now()): ClipboardContent {
  return {
    text: '',
    timestamp,
    length: 0,
    type: 'empty',
    preview: '',
    metadata: {
      lines: 0,
      words: 0,
      characters: 0,
      isUrl: false,
      isCode: false,
      isHtml: false
    }
  };
}

export function processClipboardContent(
  text: string,
  timestamp = Date.now(),
  previewMaxLength = CLIPBOARD_VIEWER_PREVIEW_MAX_LENGTH
): ClipboardContent {
  const trimmed = text.trim();
  const lines = text.split('\n');
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = text.length;

  let type: ClipboardContentType = 'text';
  let preview = text.substring(0, previewMaxLength);

  if (trimmed.length === 0) {
    type = 'empty';
    preview = '';
  } else if (/^https?:\/\/.+/.test(trimmed)) {
    type = 'url';
    preview = trimmed;
  } else if (/<[^>]+>/.test(text) || text.includes('<!DOCTYPE') || text.includes('<html')) {
    type = 'html';
    preview = text.substring(0, previewMaxLength);
  } else if (
    /[{}();=]/.test(text) ||
    text.includes('function') ||
    text.includes('const ') ||
    text.includes('var ') ||
    text.includes('import ')
  ) {
    type = 'code';
    preview = text.substring(0, previewMaxLength);
  }

  return {
    text,
    timestamp,
    length: characters,
    type,
    preview,
    metadata: {
      lines: lines.length,
      words,
      characters,
      isUrl: type === 'url',
      isCode: type === 'code',
      isHtml: type === 'html'
    }
  };
}

export function getClipboardFileExtension(type: ClipboardContentType): string {
  switch (type) {
    case 'html':
      return '.html';
    case 'code':
    case 'url':
    default:
      return '.txt';
  }
}

export function getClipboardMimeType(type: ClipboardContentType): string {
  switch (type) {
    case 'html':
      return 'text/html';
    default:
      return 'text/plain';
  }
}

export function formatClipboardViewerTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function looksLikeJsonClipboard(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return false;
  }
  const isObject = trimmed.startsWith('{') && trimmed.endsWith('}');
  const isArray = trimmed.startsWith('[') && trimmed.endsWith(']');
  if (!isObject && !isArray) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function mapClipboardPermissionErrors(errorMessage: string): string[] {
  if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
    return [
      'Clipboard access denied.',
      'Please grant clipboard permissions or click "Read Clipboard" to manually read.'
    ];
  }
  return [`Failed to read clipboard: ${errorMessage}`];
}

export function shouldTreatClipboardErrorAsEmpty(errorMessage: string): boolean {
  return errorMessage.includes('empty');
}

export function resolveClipboardViewerSuggestion(
  isSupported: boolean,
  content: ClipboardContent | null
): CftToolSuggestion | null {
  if (!isSupported) {
    return {
      id: 'unsupported-clipboard',
      title: 'Clipboard API not available here',
      reason:
        'This browser blocked clipboard access. Retry on HTTPS with permission granted, or capture clips in Clipboard History instead.',
      actionLabel: 'Open Clipboard History',
      path: '/code-file-tools/clipboard-history'
    };
  }

  if (!content || content.type === 'empty') {
    return {
      id: 'empty-clipboard',
      title: 'Clipboard is empty or unread',
      reason:
        'Copy something and click Read, or open Clipboard History to browse previously saved clips.',
      actionLabel: 'Open Clipboard History',
      path: '/code-file-tools/clipboard-history'
    };
  }

  if (content.type === 'url') {
    return {
      id: 'url-clipboard',
      title: 'Clipboard looks like a URL',
      reason:
        'Encode or decode query strings and path segments before pasting this link elsewhere.',
      actionLabel: 'Open URL Encode / Decode',
      path: '/text-utilities/url-encode-and-decode'
    };
  }

  if (content.type === 'html') {
    return {
      id: 'html-clipboard',
      title: 'Clipboard looks like HTML',
      reason:
        'Escape entities safely before embedding this markup, or minify it for production payloads.',
      actionLabel: 'Open HTML Entity Encoder',
      path: '/code-file-tools/html-entity-encoder'
    };
  }

  if (looksLikeJsonClipboard(content.text)) {
    return {
      id: 'json-clipboard',
      title: 'Clipboard looks like JSON',
      reason:
        'Pretty-print and validate this payload in JSON Formatter before editing or shipping it.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (content.type === 'code') {
    return {
      id: 'code-clipboard',
      title: 'Clipboard looks like code',
      reason:
        'Minify JavaScript snippets for smaller payloads, or save the clip into Clipboard History for later.',
      actionLabel: 'Open JavaScript Minifier',
      path: '/code-file-tools/javascript-minifier'
    };
  }

  return {
    id: 'pair-history',
    title: 'Save this clip for later',
    reason:
      'Viewer shows the live clipboard. Clipboard History can keep a searchable local archive of past clips.',
    actionLabel: 'Open Clipboard History',
    path: '/code-file-tools/clipboard-history'
  };
}
