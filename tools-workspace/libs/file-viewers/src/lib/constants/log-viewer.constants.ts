import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import { LogLevel, type LogLevelPattern } from '../types/log-viewer.types';

export const LOG_ACCEPT_ATTR = '.log,.txt,text/plain';

export const LOG_CHARTJS_CDN =
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';

export const LOG_LEVEL_PATTERNS: ReadonlyArray<LogLevelPattern> = [
  { level: LogLevel.FATAL, pattern: /\b(FATAL|FATALITY|CRITICAL)\b/i },
  { level: LogLevel.ERROR, pattern: /\b(ERROR|ERR|EXCEPTION|FAILED|FAILURE)\b/i },
  { level: LogLevel.WARN, pattern: /\b(WARN|WARNING|WRN)\b/i },
  { level: LogLevel.INFO, pattern: /\b(INFO|INFORMATION)\b/i },
  { level: LogLevel.DEBUG, pattern: /\b(DEBUG|DBG)\b/i },
  { level: LogLevel.TRACE, pattern: /\b(TRACE|TRC)\b/i }
];

export const LOG_TIMESTAMP_PATTERNS: ReadonlyArray<RegExp> = [
  /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/,
  /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,
  /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,
  /(\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\])/
];

export const LOG_LEVEL_COLORS: Readonly<Record<LogLevel, string>> = {
  [LogLevel.FATAL]: '#d32f2f',
  [LogLevel.ERROR]: '#f44336',
  [LogLevel.WARN]: '#ff9800',
  [LogLevel.INFO]: '#2196f3',
  [LogLevel.DEBUG]: '#4caf50',
  [LogLevel.TRACE]: '#9e9e9e',
  [LogLevel.UNKNOWN]: '#757575'
};

export const LOG_LEVEL_ICONS: Readonly<Record<LogLevel, string>> = {
  [LogLevel.FATAL]: '🔴',
  [LogLevel.ERROR]: '❌',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.DEBUG]: '🔍',
  [LogLevel.TRACE]: '📝',
  [LogLevel.UNKNOWN]: '❓'
};

export const LOG_SEARCH_DEBOUNCE_MS = 300;
export const LOG_SCROLL_BOTTOM_THRESHOLD_PX = 50;
export const LOG_SCROLL_TOP_BUTTON_THRESHOLD_PX = 500;
export const LOG_AUTO_SCROLL_DELAY_MS = 100;
export const LOG_CHART_RENDER_DELAY_MS = 100;
export const LOG_MESSAGE_PREVIEW_MAX_CHARS = 200;

export const LOG_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Open plain-text dumps with richer line tools'
  },
  {
    label: 'Regex Tester',
    path: '/text-utilities/regex-tester',
    description: 'Prototype search patterns before applying them to logs'
  },
  {
    label: 'Text Difference',
    path: '/text-utilities/text-difference',
    description: 'Compare two log exports side by side'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print structured JSON log lines'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Inspect MIME type and size for unusual log packages'
  }
];
