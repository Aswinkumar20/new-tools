/**
 * Curated synonym groups for high-precision intent matching.
 * Keep this small — semantic token overlap covers long-tail paraphrases.
 */

export const ACTION_SYNONYMS: Record<string, string[]> = {
  compress: [
    'compress',
    'shrink',
    'reduce',
    'optimize',
    'optimise',
    'smaller',
    'minify',
    'decrease',
    'lower',
    'lighten',
    'compact',
  ],
  resize: ['resize', 'rescale', 'scale', 'dimensions', 'width', 'height', 'downsample'],
  convert: [
    'convert',
    'change',
    'transform',
    'turn',
    'translate',
    'reformat',
    'transcode',
  ],
  merge: ['merge', 'combine', 'join', 'concatenate', 'append', 'unite', 'together'],
  split: ['split', 'separate', 'divide', 'extract', 'break'],
  crop: ['crop', 'cut', 'trim', 'clip'],
  remove: ['remove', 'delete', 'erase', 'strip', 'clear', 'rid'],
  generate: ['generate', 'create', 'make', 'build', 'produce'],
  format: ['format', 'pretty', 'beautify', 'prettify', 'indent', 'readable'],
  count: ['count', 'tally', 'how many', 'number of'],
  edit: ['edit', 'modify', 'change', 'update', 'annotate'],
  protect: ['protect', 'password', 'encrypt', 'secure', 'lock'],
  view: ['view', 'open', 'preview', 'inspect', 'read'],
  encode: ['encode', 'decode', 'escape', 'unescape'],
  validate: ['validate', 'lint', 'check', 'verify'],
};

export const OBJECT_SYNONYMS: Record<string, string[]> = {
  image: [
    'image',
    'images',
    'photo',
    'photos',
    'picture',
    'pictures',
    'pic',
    'pics',
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'svg',
    'bitmap',
  ],
  pdf: ['pdf', 'pdfs', 'document', 'documents', 'ebook'],
  text: ['text', 'string', 'words', 'paragraph', 'content', 'copy'],
  json: ['json', 'object', 'payload'],
  csv: ['csv', 'spreadsheet', 'tabular'],
  yaml: ['yaml', 'yml'],
  video: ['video', 'videos', 'mp4', 'mov', 'webm', 'clip'],
  audio: ['audio', 'mp3', 'wav', 'sound'],
  qr: ['qr', 'qrcode', 'barcode'],
  color: ['color', 'colour', 'hex', 'rgb', 'palette', 'gradient'],
  url: ['url', 'uri', 'link'],
  password: ['password', 'passphrase', 'secret'],
  html: ['html', 'markup'],
  markdown: ['markdown', 'md'],
  base64: ['base64', 'b64'],
  regex: ['regex', 'regexp', 'regular expression'],
};

export const FORMAT_TOKENS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'svg',
  'pdf',
  'json',
  'csv',
  'yaml',
  'yml',
  'xml',
  'html',
  'md',
  'markdown',
  'mp4',
  'mp3',
  'wav',
  'txt',
  'docx',
  'xlsx',
]);

/** Expand a token to canonical action if it matches a synonym. */
export function resolveAction(token: string): string | null {
  const needle = token.toLowerCase().trim();
  for (const [action, synonyms] of Object.entries(ACTION_SYNONYMS)) {
    if (action === needle || synonyms.includes(needle)) {
      return action;
    }
  }
  return null;
}

export function resolveObject(token: string): string | null {
  const needle = token.toLowerCase().trim();
  for (const [object, synonyms] of Object.entries(OBJECT_SYNONYMS)) {
    if (object === needle || synonyms.includes(needle)) {
      return object;
    }
  }
  return null;
}

export function expandQueryTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const action = resolveAction(token);
    if (action) {
      expanded.add(action);
      for (const synonym of ACTION_SYNONYMS[action] ?? []) {
        if (!synonym.includes(' ')) {
          expanded.add(synonym);
        }
      }
    }
    const object = resolveObject(token);
    if (object) {
      expanded.add(object);
      for (const synonym of OBJECT_SYNONYMS[object] ?? []) {
        if (!synonym.includes(' ')) {
          expanded.add(synonym);
        }
      }
    }
  }
  return [...expanded];
}
