import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const PPT_ACCEPT_ATTR =
  '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const PPT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pptx'];

export const PPT_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const PPT_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const PPT_MAX_FILE_SIZE_LABEL = '100MB';

export const PPT_DEFAULT_ZOOM = 100;
export const PPT_MIN_ZOOM = 50;
export const PPT_MAX_ZOOM = 300;
export const PPT_ZOOM_STEP = 25;

export const PPT_DEFAULT_SLIDE_WIDTH_EMU = 12192000;
export const PPT_DEFAULT_SLIDE_HEIGHT_EMU = 6858000;
export const PPT_BASE_SLIDE_WIDTH_PX = 960;
export const PPT_FULLSCREEN_BASE_WIDTH_PX = 1100;

export const PPT_OOXML_RELATIONSHIPS_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const PPT_FULLSCREEN_EVENTS: ReadonlyArray<string> = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange'
];

export const PPT_TOAST_ERROR_MS = 6000;
export const PPT_TOAST_WARNING_MS = 5000;

export const PPT_MANY_SLIDES_SUGGEST_THRESHOLD = 20;
export const PPT_LARGE_FILE_SUGGEST_BYTES = 10 * 1024 * 1024;

export const PPT_SCHEME_COLOR_HEX: Readonly<Record<string, string>> = {
  dk1: '#000000',
  lt1: '#ffffff',
  dk2: '#1f4e79',
  lt2: '#e7e6e6',
  accent1: '#4472c4',
  accent2: '#ed7d31',
  accent3: '#a5a5a5',
  accent4: '#ffc000',
  accent5: '#5b9bd5',
  accent6: '#70ad47',
  hlink: '#0563c1',
  folHlink: '#954f72'
};

export const PPT_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'PDF Viewer',
    path: '/file-viewers/pdf-viewer',
    description: 'Preview exported PDF decks with page zoom and print'
  },
  {
    label: 'Word Viewer',
    path: '/file-viewers/word-viewer',
    description: 'Open companion DOCX notes alongside your slides'
  },
  {
    label: 'Image Viewer',
    path: '/file-viewers/image-viewer',
    description: 'Inspect slide screenshots and exported graphics'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm MIME type when a PPTX fails to open'
  },
  {
    label: 'Markdown Previewer',
    path: '/file-viewers/markdown-previewer',
    description: 'Draft talk tracks in Markdown before building slides'
  }
];
