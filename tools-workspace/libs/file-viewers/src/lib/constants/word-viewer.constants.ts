import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const WORD_ACCEPT_ATTR =
  '.doc,.docx,.rtf,.odt,.txt,.html,.htm,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,application/vnd.oasis.opendocument.text,text/plain,text/html';

export const WORD_SUPPORTED_LABEL =
  'DOCX, DOC, RTF, ODT, TXT, HTML';

export const WORD_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const WORD_MAX_FILE_SIZE_LABEL = '50MB';

export const WORD_DEFAULT_ZOOM = 100;
export const WORD_MIN_ZOOM = 50;
export const WORD_MAX_ZOOM = 200;
export const WORD_ZOOM_STEP = 25;
export const WORD_FIT_BASE_WIDTH_PX = 900;
export const WORD_NORMAL_FIT_PADDING_PX = 100;
export const WORD_FULLSCREEN_FIT_PADDING_PX = 80;

export const WORD_MAMMOTH_STYLE_MAP: ReadonlyArray<string> = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh"
];

export const WORD_FULLSCREEN_EVENTS: ReadonlyArray<string> = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange'
];

export const WORD_RENDER_DELAY_MS = 100;
export const WORD_RENDER_RETRY_MS = 50;
export const WORD_RENDER_MAX_ATTEMPTS = 20;
export const WORD_SELECT_DELAY_MS = 50;
export const WORD_FULLSCREEN_ENTER_DELAY_MS = 50;
export const WORD_FULLSCREEN_FIT_MS = 150;
export const WORD_EXIT_RERENDER_MS = 100;

export const WORD_LONG_TEXT_CHAR_THRESHOLD = 8000;

export const WORD_DOC_PLACEHOLDER_HTML = `<div class="doc-content">
              <div style="padding: 2rem; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 2rem 0;">
                <h3 style="color: #856404; margin-bottom: 1rem;">Legacy DOC Format</h3>
                <p style="color: #856404; margin-bottom: 1rem;">
                  This is a legacy .doc file format. For best viewing experience, please convert it to .docx format.
                </p>
                <p style="color: #856404; font-size: 0.9rem;">
                  The .doc format is a binary format that requires special libraries to parse. 
                  For full support, please convert your .doc file to .docx format using Microsoft Word or an online converter.
                </p>
              </div>
              <p style="color: #757575; font-style: italic; margin-top: 1rem;">
                Note: Full .doc file support requires conversion to .docx format. 
                You can use Microsoft Word or online converters to convert your .doc file to .docx.
              </p>
            </div>`;

export const WORD_DOC_PLACEHOLDER_TEXT =
  'Legacy DOC format - conversion to DOCX recommended for full support';

export const WORD_ODT_PLACEHOLDER_HTML = `<div class="odt-content">
              <div style="padding: 2rem; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 2rem 0;">
                <h3 style="color: #856404; margin-bottom: 1rem;">ODT Format</h3>
                <p style="color: #856404;">
                  ODT (OpenDocument Text) files require conversion. Please convert to DOCX format for better support.
                </p>
              </div>
            </div>`;

export const WORD_ODT_PLACEHOLDER_TEXT =
  'ODT file content extraction not fully supported. Please convert to DOCX.';

export const WORD_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'PDF Viewer',
    path: '/file-viewers/pdf-viewer',
    description: 'Preview PDF exports of the same document'
  },
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Open plain-text drafts and notes alongside Word files'
  },
  {
    label: 'Markdown Previewer',
    path: '/file-viewers/markdown-previewer',
    description: 'Preview Markdown drafts before converting to DOCX'
  },
  {
    label: 'PowerPoint Viewer',
    path: '/file-viewers/powerpoint-viewer',
    description: 'Open companion slide decks for the same project'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm MIME type when a document fails to open'
  }
];
