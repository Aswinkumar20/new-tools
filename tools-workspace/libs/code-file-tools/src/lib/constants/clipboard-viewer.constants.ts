import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';
import type { ClipboardViewerSettings } from '../types/clipboard-viewer.types';

export const CLIPBOARD_VIEWER_DEFAULT_REFRESH_INTERVAL_MS = 1000;
export const CLIPBOARD_VIEWER_MIN_REFRESH_INTERVAL_MS = 100;
export const CLIPBOARD_VIEWER_MAX_REFRESH_INTERVAL_MS = 10000;
export const CLIPBOARD_VIEWER_PREVIEW_MAX_LENGTH = 200;

export const CLIPBOARD_VIEWER_DEFAULT_SETTINGS: ClipboardViewerSettings = {
  autoRefresh: true,
  refreshInterval: CLIPBOARD_VIEWER_DEFAULT_REFRESH_INTERVAL_MS,
  showMetadata: true,
  wordWrap: true,
  fontSize: 14
};

export const CLIPBOARD_VIEWER_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'Clipboard History',
    path: '/code-file-tools/clipboard-history',
    description: 'Store and recall previous clipboard clips'
  },
  {
    label: 'URL Encode / Decode',
    path: '/text-utilities/url-encode-and-decode',
    description: 'Encode or decode URL clipboard content'
  },
  {
    label: 'HTML Entity Encoder',
    path: '/code-file-tools/html-entity-encoder',
    description: 'Escape HTML snippets from the clipboard'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print JSON clipboard payloads'
  },
  {
    label: 'JavaScript Minifier',
    path: '/code-file-tools/javascript-minifier',
    description: 'Minify code pasted from the clipboard'
  }
];
