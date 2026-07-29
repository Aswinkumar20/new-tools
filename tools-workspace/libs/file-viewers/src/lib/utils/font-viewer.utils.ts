import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  FONT_DEFAULT_FAMILY,
  FONT_PREVIEW_DEFAULTS,
  FONT_SUPPORTED_EXTENSIONS
} from '../constants/font-viewer.constants';
import type {
  FontMetadata,
  FontPreviewDefaults,
  FontPreviewStyleOptions
} from '../types/font-viewer.types';

export function isFontApiSupported(
  globalObj: typeof globalThis = globalThis
): boolean {
  return (
    'FontFace' in (globalObj as typeof globalThis & { FontFace?: unknown }) &&
    getDocument(globalObj) !== undefined
  );
}

export function getDocument(
  globalObj: typeof globalThis = globalThis
): Document | undefined {
  return (globalObj as typeof globalThis & { document?: Document }).document;
}

export function getFontFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return '';
  }
  return parts.pop()?.toLowerCase() ?? '';
}

export function isAllowedFontFormat(
  fileName: string,
  extensions: ReadonlyArray<string> = FONT_SUPPORTED_EXTENSIONS
): boolean {
  const ext = getFontFileExtension(fileName);
  return extensions.includes(ext);
}

export function createFontFamilyName(fileName: string): string {
  const name =
    fileName.lastIndexOf('.') > 0 ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
  let sanitized = '';
  let previousIsHyphen = false;

  for (const char of name) {
    if (/^[a-zA-Z0-9-]$/.test(char)) {
      sanitized += char;
      previousIsHyphen = char === '-';
    } else if (!previousIsHyphen) {
      sanitized += '-';
      previousIsHyphen = true;
    }
  }

  while (sanitized.startsWith('-')) {
    sanitized = sanitized.slice(1);
  }

  while (sanitized.endsWith('-')) {
    sanitized = sanitized.slice(0, -1);
  }

  const result = sanitized.slice(0, 40);
  return result || 'Uploaded-Font';
}

export function formatFontFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}

export function detectFontFormatLabel(fileName: string): string {
  switch (getFontFileExtension(fileName)) {
    case 'ttf':
      return 'TrueType Font (.ttf)';
    case 'otf':
      return 'OpenType Font (.otf)';
    case 'woff':
      return 'Web Open Font Format (.woff)';
    case 'woff2':
      return 'Web Open Font Format 2 (.woff2)';
    default:
      return 'Unknown format';
  }
}

export function normalizeFontFaceValue(value: string, fallback: string): string {
  if (!value || value === 'normal') {
    return fallback;
  }
  return value;
}

export function buildFontMetadata(
  file: File,
  fontFace: Pick<FontFace, 'family' | 'style' | 'weight' | 'stretch' | 'featureSettings'>
): FontMetadata {
  const lastModified = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(file.lastModified));

  return {
    fileName: file.name,
    formattedSize: formatFontFileSize(file.size),
    rawSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    formatLabel: detectFontFormatLabel(file.name),
    lastModified,
    family: fontFace.family,
    style: normalizeFontFaceValue(fontFace.style, 'normal'),
    weight: normalizeFontFaceValue(fontFace.weight, '400'),
    stretch: normalizeFontFaceValue(fontFace.stretch, 'normal'),
    variationSettings: fontFace.featureSettings
  };
}

export function buildFontPreviewHostStyles(
  options: FontPreviewStyleOptions
): Record<string, string | number> {
  return {
    'font-family': options.uploadedFontFamily,
    'font-size': `${options.fontSize}px`,
    'line-height': options.lineHeight.toString(),
    'letter-spacing': `${options.letterSpacing}px`,
    'word-spacing': `${options.wordSpacing}px`,
    color: options.textColor,
    'background-color': options.backgroundColor,
    'text-transform': options.uppercase ? 'uppercase' : 'none',
    'font-weight': options.selectedWeight,
    'font-style': options.selectedStyle,
    'font-smooth': options.enableSmoothPreview ? 'always' : 'auto'
  };
}

export function getFontPreviewDefaults(): FontPreviewDefaults {
  return { ...FONT_PREVIEW_DEFAULTS };
}

export function getDefaultUploadedFontFamily(): string {
  return FONT_DEFAULT_FAMILY;
}

export function resolveFontSuggestion(options: {
  fontApiSupported: boolean;
  hasFont: boolean;
  hasError: boolean;
  formatExtension: string;
}): FvToolSuggestion | null {
  const { fontApiSupported, hasFont, hasError, formatExtension } = options;

  if (!fontApiSupported) {
    return {
      id: 'fn-meta-unsupported',
      title: 'Inspect the font file anyway?',
      reason:
        'This browser cannot preview FontFace. You can still check MIME type and size in File Metadata Viewer.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (hasError) {
    return {
      id: 'fn-meta-error',
      title: 'Verify the font package?',
      reason:
        'Preview failed. Confirm the extension and MIME type before retrying with another encode.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasFont) {
    return {
      id: 'fn-color',
      title: 'Planning text and background colors?',
      reason:
        'After you load a typeface, pair it with accessible colors. Start exploring swatches in Color Picker.',
      actionLabel: 'Open Color Picker',
      path: '/image-color-tools/color-picker'
    };
  }

  if (formatExtension === 'woff' || formatExtension === 'woff2') {
    return {
      id: 'fn-rem',
      title: 'Ready for production CSS sizes?',
      reason:
        'Web fonts often ship with px mockups. Convert your preview size to rem for responsive stylesheets.',
      actionLabel: 'Open Pixel to Rem',
      path: '/dev-design-tools/pixel-to-rem'
    };
  }

  return {
    id: 'fn-gradient',
    title: 'Design a hero behind this type?',
    reason:
      'Display fonts shine on gradient backdrops. Generate a CSS gradient to mock marketing layouts.',
    actionLabel: 'Open CSS Gradient Generator',
    path: '/dev-design-tools/css-gradient-generator'
  };
}
