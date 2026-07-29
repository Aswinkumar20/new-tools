import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';
import type { ClipboardHistorySettings } from '../types/clipboard-history.types';

export const CLIPBOARD_HISTORY_STORAGE_KEY = 'clipboard_history';
export const CLIPBOARD_HISTORY_SETTINGS_KEY = 'clipboard_history_settings';
export const CLIPBOARD_HISTORY_DEFAULT_MAX_ENTRIES = 50;
export const CLIPBOARD_HISTORY_POLL_INTERVAL_MS = 1000;
export const CLIPBOARD_HISTORY_PREVIEW_MAX_LENGTH = 100;
export const CLIPBOARD_HISTORY_COPY_SUCCESS_MS = 2000;

export const CLIPBOARD_HISTORY_DEFAULT_SETTINGS: ClipboardHistorySettings = {
  autoMonitor: true,
  maxEntries: CLIPBOARD_HISTORY_DEFAULT_MAX_ENTRIES,
  excludeDuplicates: true,
  minLength: 1,
  maxLength: 100000
};

export const CLIPBOARD_HISTORY_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'Clipboard Viewer',
    path: '/code-file-tools/clipboard-viewer',
    description: 'Live clipboard content and metadata'
  },
  {
    label: 'URL Encode / Decode',
    path: '/text-utilities/url-encode-and-decode',
    description: 'Encode or decode copied URLs'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print JSON clips'
  },
  {
    label: 'Text Difference',
    path: '/text-utilities/text-difference',
    description: 'Compare two clipboard snippets'
  },
  {
    label: 'Storage Viewer',
    path: '/browser-utils/storage-viewer',
    description: 'Inspect persisted browser storage'
  }
];
