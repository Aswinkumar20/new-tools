import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';
import type { HtmlEntityEncodingFormat } from '../types/html-entity-encoder.types';

export const HTML_ENTITY_HISTORY_LIMIT = 10;
export const HTML_ENTITY_HISTORY_PREVIEW_LENGTH = 40;
export const HTML_ENTITY_DEFAULT_ENCODING: HtmlEntityEncodingFormat = 'named';

export const HTML_ENTITY_SAMPLE = `Hello <world> & "friends"!
This is a sample text with special characters: ©, ®, ™, €, £, ¥`;

export const HTML_ENTITY_NAMED_ENCODE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '©': '&copy;',
  '®': '&reg;',
  '™': '&trade;',
  '€': '&euro;',
  '£': '&pound;',
  '¥': '&yen;',
  '¢': '&cent;',
  '§': '&sect;',
  '°': '&deg;',
  '±': '&plusmn;',
  '×': '&times;',
  '÷': '&divide;',
  '½': '&frac12;',
  '¼': '&frac14;',
  '¾': '&frac34;',
  á: '&aacute;',
  é: '&eacute;',
  í: '&iacute;',
  ó: '&oacute;',
  ú: '&uacute;',
  ñ: '&ntilde;',
  Á: '&Aacute;',
  É: '&Eacute;',
  Í: '&Iacute;',
  Ó: '&Oacute;',
  Ú: '&Uacute;',
  Ñ: '&Ntilde;'
};

export const HTML_ENTITY_NAMED_DECODE_MAP: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&euro;': '€',
  '&pound;': '£',
  '&yen;': '¥',
  '&cent;': '¢',
  '&sect;': '§',
  '&deg;': '°',
  '&plusmn;': '±',
  '&times;': '×',
  '&divide;': '÷',
  '&frac12;': '½',
  '&frac14;': '¼',
  '&frac34;': '¾'
};

export const HTML_ENTITY_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'HTML Minifier',
    path: '/code-file-tools/html-minifier',
    description: 'Minify HTML after encoding entities'
  },
  {
    label: 'CSS Minifier',
    path: '/code-file-tools/css-minifier',
    description: 'Compress stylesheets used in markup'
  },
  {
    label: 'JavaScript Minifier',
    path: '/code-file-tools/javascript-minifier',
    description: 'Minify scripts embedded in HTML'
  },
  {
    label: 'Clipboard Viewer',
    path: '/code-file-tools/clipboard-viewer',
    description: 'Inspect copied HTML snippets'
  }
];
