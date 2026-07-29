import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import type { DomPurifyConfig, MarkedOptions } from '../types/markdown-previewer.types';

export const MARKDOWN_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.md',
  '.markdown',
  '.mdown',
  '.mkdn',
  '.mkd'
];

export const MARKDOWN_ACCEPT_ATTR =
  '.md,.markdown,.mdown,.mkdn,.mkd,text/markdown,text/x-markdown';

export const MARKDOWN_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const MARKDOWN_DEFAULT_ZOOM = 100;
export const MARKDOWN_MIN_ZOOM = 50;
export const MARKDOWN_MAX_ZOOM = 200;
export const MARKDOWN_ZOOM_STEP = 25;

export const MARKDOWN_MARKED_CDN =
  'https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js';
export const MARKDOWN_DOMPURIFY_CDN =
  'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js';

export const MARKDOWN_MARKED_OPTIONS: MarkedOptions = {
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false
};

export const MARKDOWN_DOMPURIFY_CONFIG: DomPurifyConfig = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'a',
    'img',
    'hr',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'del',
    'ins',
    'sub',
    'sup'
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id']
};

export const MARKDOWN_FULLSCREEN_EVENTS: ReadonlyArray<string> = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange'
];

export const MARKDOWN_RENDER_DELAY_MS = 100;
export const MARKDOWN_RENDER_RETRY_MS = 50;
export const MARKDOWN_RENDER_MAX_ATTEMPTS = 30;
export const MARKDOWN_FULLSCREEN_FIT_MS = 150;
export const MARKDOWN_FULLSCREEN_ENTER_DELAY_MS = 50;

export const MARKDOWN_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Markdown to HTML',
    path: '/data-converters/markdown-to-html',
    description: 'Export sanitized HTML for blogs, docs, and CMS paste'
  },
  {
    label: 'Markdown to PDF',
    path: '/code-file-tools/markdown-to-pdf',
    description: 'Turn README drafts into printable PDF handouts'
  },
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Inspect raw text files that are not Markdown'
  },
  {
    label: 'Word Viewer',
    path: '/file-viewers/word-viewer',
    description: 'Preview companion DOCX docs alongside Markdown notes'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm MIME type for unusual Markdown packages'
  }
];
