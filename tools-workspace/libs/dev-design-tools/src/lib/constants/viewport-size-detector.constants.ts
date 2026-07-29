import type { DdRelatedToolLink } from '../shared/dd-tool-suggestion.model';
import type { ViewportBreakpoint } from '../types/viewport-size-detector.types';

export const VIEWPORT_HISTORY_LIMIT = 20;
export const VIEWPORT_HISTORY_SIZE_TOLERANCE_PX = 1;

export const VIEWPORT_BREAKPOINT_COLORS: ReadonlyArray<string> = [
  '#007bff',
  '#28a745',
  '#ffc107',
  '#dc3545'
];

export const VIEWPORT_BREAKPOINTS: ReadonlyArray<ViewportBreakpoint> = [
  { name: 'Mobile', min: 0, max: 767 },
  { name: 'Tablet', min: 768, max: 1023 },
  { name: 'Desktop', min: 1024, max: 1439 },
  { name: 'Large Desktop', min: 1440, max: Infinity }
];

export const VIEWPORT_RELATED_TOOLS: ReadonlyArray<DdRelatedToolLink> = [
  {
    label: 'Responsive Breakpoint Tester',
    path: '/dev-design-tools/responsive-breakpoint-tester',
    description: 'Simulate device presets against a live URL in an iframe'
  },
  {
    label: 'Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info',
    description: 'Compare CSS viewport metrics with physical screen details'
  },
  {
    label: 'Device Orientation Logger',
    path: '/browser-utils/device-orientation-logger',
    description: 'Capture alpha/beta/gamma while rotating the device'
  },
  {
    label: 'Pixel ↔ Rem Converter',
    path: '/dev-design-tools/pixel-to-rem',
    description: 'Convert measured viewport widths into rem-based CSS tokens'
  }
];
