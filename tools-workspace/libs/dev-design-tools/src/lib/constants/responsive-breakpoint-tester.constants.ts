import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type {
  ResponsiveActiveBreakpoint,
  ResponsiveBreakpointPreset
} from '../types/responsive-breakpoint-tester.types';

export const RESPONSIVE_DEFAULT_URL = 'https://example.com';
export const RESPONSIVE_DEFAULT_WIDTH = 1280;
export const RESPONSIVE_DEFAULT_HEIGHT = 720;
export const RESPONSIVE_WIDTH_MIN = 320;
export const RESPONSIVE_WIDTH_MAX = 5000;
export const RESPONSIVE_HEIGHT_MIN = 240;
export const RESPONSIVE_HEIGHT_MAX = 5000;
export const RESPONSIVE_GRID_STEP = 50;
export const RESPONSIVE_URL_PATTERN = /^https?:\/\/.+/;
export const RESPONSIVE_URL_PATTERN_LOOSE = /^https?:\/\/.+/i;

export const RESPONSIVE_IFRAME_WARNING =
  'Many sites block iframe embedding (X-Frame-Options / CSP). If the preview stays blank, try example.com or a same-origin page.';

export const RESPONSIVE_BREAKPOINT_COLORS: ReadonlyArray<string> = [
  '#007bff',
  '#28a745',
  '#ffc107',
  '#dc3545'
];

export const RESPONSIVE_PRESET_BREAKPOINTS: ReadonlyArray<ResponsiveBreakpointPreset> = [
  { name: 'iPhone SE', width: 375, height: 667, icon: '📱' },
  { name: 'iPhone 14', width: 414, height: 896, icon: '📱' },
  { name: 'iPad portrait', width: 768, height: 1024, icon: '📱' },
  { name: 'iPad landscape', width: 1024, height: 768, icon: '📱' },
  { name: 'Laptop HD', width: 1280, height: 720, icon: '💻' },
  { name: 'MacBook Pro', width: 1440, height: 900, icon: '💻' },
  { name: 'Full HD desktop', width: 1920, height: 1080, icon: '💻' },
  { name: '4K desktop', width: 3840, height: 2160, icon: '🖥️' }
];

export const RESPONSIVE_COMMON_BREAKPOINTS: ReadonlyArray<ResponsiveActiveBreakpoint> = [
  { name: 'Mobile', min: 0, max: 767 },
  { name: 'Tablet', min: 768, max: 1023 },
  { name: 'Desktop', min: 1024, max: 1439 },
  { name: 'Large Desktop', min: 1440, max: Infinity }
];

export const RESPONSIVE_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'Viewport Size Detector',
    path: '/dev-design-tools/viewport-size-detector',
    description: 'Watch live media queries against your real browser viewport'
  },
  {
    label: 'Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info',
    description: 'Compare device screen metrics with the sizes you are testing'
  },
  {
    label: 'Pixel ↔ Rem Converter',
    path: '/dev-design-tools/pixel-to-rem',
    description: 'Convert copied viewport widths into rem-based CSS tokens'
  }
];
