import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const TEXT_ACCEPT_ATTR =
  '.txt,.log,.md,.json,.xml,.yaml,.yml,.ini,.cfg,.config,.csv,.rtf,.html,.htm,.css,.js,.ts,.py,.sh,.bat,.ps1,text/*';

export const TEXT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const TEXT_MAX_FILE_SIZE_LABEL = '10MB';

export const TEXT_DEFAULT_ZOOM = 100;
export const TEXT_MIN_ZOOM = 50;
export const TEXT_MAX_ZOOM = 200;
export const TEXT_ZOOM_STEP = 25;

export const TEXT_RENDER_DELAY_MS = 100;
export const TEXT_RENDER_RETRY_MS = 50;
export const TEXT_RENDER_MAX_ATTEMPTS = 30;
export const TEXT_LOAD_FALLBACK_MS = 500;
export const TEXT_SELECT_DELAY_MS = 50;
export const TEXT_FULLSCREEN_ENTER_DELAY_MS = 50;
export const TEXT_FULLSCREEN_FIT_MS = 150;

export const TEXT_LONG_FILE_LINE_THRESHOLD = 500;

export const TEXT_FULLSCREEN_EVENTS: ReadonlyArray<string> = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange'
];

export const TEXT_JS_KEYWORDS: ReadonlyArray<string> = [
  'function',
  'var',
  'let',
  'const',
  'if',
  'else',
  'for',
  'while',
  'return',
  'class',
  'import',
  'export',
  'async',
  'await',
  'try',
  'catch',
  'finally'
];

export const TEXT_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Markdown Previewer',
    path: '/file-viewers/markdown-previewer',
    description: 'Render Markdown with GFM instead of raw text'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Beautify and validate JSON documents'
  },
  {
    label: 'Log Viewer',
    path: '/file-viewers/log-viewer',
    description: 'Browse large logs with filtering and severity cues'
  },
  {
    label: 'CSV ↔ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Convert tabular text between CSV and JSON'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm MIME type when a file fails to open'
  }
];
