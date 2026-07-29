import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import type {
  FontCharacterShowcase,
  FontComparisonOption,
  FontPreviewDefaults,
  FontPreviewTemplate
} from '../types/font-viewer.types';

export const FONT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  'ttf',
  'otf',
  'woff',
  'woff2'
];

export const FONT_FORMAT_HINTS: ReadonlyArray<string> = ['TTF', 'OTF', 'WOFF', 'WOFF2'];

export const FONT_ACCEPT_ATTR = '.ttf,.otf,.woff,.woff2';

export const FONT_DEFAULT_FAMILY =
  "'Inter', 'Helvetica Neue', Arial, sans-serif";

export const FONT_DEFAULT_SAMPLE_TEXT =
  'The quick brown fox jumps over the lazy dog \u00B7 1234567890 \u00B7 !?';

export const FONT_WEIGHT_OPTIONS: ReadonlyArray<number> = [
  100, 200, 300, 400, 500, 600, 700, 800, 900
];

export const FONT_PREVIEW_DEFAULTS: FontPreviewDefaults = {
  fontSize: 48,
  lineHeight: 1.3,
  letterSpacing: 0,
  wordSpacing: 0,
  textColor: '#1d1d1f',
  backgroundColor: '#f9fafc',
  uppercase: false,
  enableSmoothPreview: true,
  selectedWeight: '400',
  selectedStyle: 'normal'
};

export const FONT_PREVIEW_TEMPLATES: ReadonlyArray<FontPreviewTemplate> = [
  {
    id: 'headline',
    label: 'Hero Headline',
    description: 'Large display text for landing pages and marketing banners.',
    content: 'Elevate your story with beautifully rendered typography.'
  },
  {
    id: 'paragraph',
    label: 'Body Copy',
    description: 'A longer passage to review readability in paragraphs.',
    content:
      'Great typography balances personality with legibility. Preview multiple font sizes, colors, and weights to ensure your project feels cohesive and accessible across every device.'
  },
  {
    id: 'ui',
    label: 'Interface Labels',
    description: 'Short snippets that mimic buttons, badges, and navigation.',
    content: 'Primary Action \u00B7 Secondary \u00B7 Tab Label \u00B7 Badge 42'
  },
  {
    id: 'numbers',
    label: 'Numeric Data',
    description: 'Ideal for dashboards, pricing tables, and data-heavy layouts.',
    content: '123 456 789 \u00B7 01 / 23 / 45 \u00B7 $1,299.00 \u00B7 98.76%'
  }
];

export const FONT_COMPARISON_OPTIONS: ReadonlyArray<FontComparisonOption> = [
  {
    label: 'System default (Inter)',
    value: "'Inter', 'Helvetica Neue', Arial, sans-serif"
  },
  {
    label: 'Serif (Georgia)',
    value: "Georgia, 'Times New Roman', serif"
  },
  {
    label: 'Mono (SFMono)',
    value: "'SFMono-Regular', 'Courier New', monospace"
  },
  {
    label: 'Display (Baskerville)',
    value: "'Libre Baskerville', 'Baskerville', serif"
  }
];

export const FONT_CHARACTER_SHOWCASES: ReadonlyArray<FontCharacterShowcase> = [
  {
    title: 'Alphabet',
    description: 'Uppercase, lowercase, and digits for quick visual checks.',
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789'
  },
  {
    title: 'Punctuation',
    description: 'Articles, quotes, and interface copy rely heavily on these.',
    characters: '! ? . , ; : \' " \u2013 \u2014 ( ) [ ] { } / \\ @ # $ % & *'
  },
  {
    title: 'Symbols',
    description: 'Currency, math, and UI symbols for financial or analytic UI.',
    characters:
      '\u20AC \u00A3 \u00A5 \u20A9 \u20BF \u00B1 \u00D7 \u00F7 \u2248 \u2260 \u2265 \u2264 \u221E \u2211 \u221A \u2206 \u00B5 \u00B0 \u2030 \u00A7 \u2020 \u2021 \u00B6'
  }
];

export const FONT_USAGE_STEPS: ReadonlyArray<string> = [
  'Drop a font file (TTF, OTF, WOFF, or WOFF2) or pick one from your device.',
  'Adjust size, color, and spacing to recreate real-world scenarios.',
  'Browse glyph groups and compare alongside familiar system fonts.',
  'Download metadata and share preview controls with teammates.'
];

export const FONT_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Color Picker',
    path: '/image-color-tools/color-picker',
    description: 'Pair type with accessible text and background colors'
  },
  {
    label: 'Pixel to Rem',
    path: '/dev-design-tools/pixel-to-rem',
    description: 'Convert preview sizes into CSS rem units for production'
  },
  {
    label: 'CSS Gradient Generator',
    path: '/dev-design-tools/css-gradient-generator',
    description: 'Build hero backgrounds that sit behind display type'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Inspect MIME type and size for unusual font packages'
  }
];
