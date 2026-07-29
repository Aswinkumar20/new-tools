import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import {
  RESPONSIVE_BREAKPOINT_COLORS,
  RESPONSIVE_COMMON_BREAKPOINTS,
  RESPONSIVE_GRID_STEP,
  RESPONSIVE_URL_PATTERN_LOOSE
} from '../constants/responsive-breakpoint-tester.constants';
import type {
  ResponsiveActiveBreakpoint,
  ResponsiveViewportSize
} from '../types/responsive-breakpoint-tester.types';

export function isValidHttpUrl(url: string): boolean {
  return RESPONSIVE_URL_PATTERN_LOOSE.test(url.trim());
}

export function findActiveBreakpoint(
  width: number,
  breakpoints: ReadonlyArray<ResponsiveActiveBreakpoint> = RESPONSIVE_COMMON_BREAKPOINTS
): ResponsiveActiveBreakpoint {
  return breakpoints.find((bp) => width >= bp.min && width <= bp.max) ?? breakpoints[0];
}

export function isOpenEndedBreakpoint(bp: ResponsiveActiveBreakpoint): boolean {
  return bp.max === Infinity;
}

export function formatBreakpointName(bp: ResponsiveActiveBreakpoint | undefined): string {
  if (!bp) {
    return 'Unknown';
  }
  if (isOpenEndedBreakpoint(bp)) {
    return `${bp.name} (${bp.min}+px)`;
  }
  return `${bp.name} (${bp.min}-${bp.max}px)`;
}

export function getBreakpointColor(
  bp: ResponsiveActiveBreakpoint | undefined,
  breakpoints: ReadonlyArray<ResponsiveActiveBreakpoint> = RESPONSIVE_COMMON_BREAKPOINTS,
  colors: ReadonlyArray<string> = RESPONSIVE_BREAKPOINT_COLORS
): string {
  if (!bp) {
    return '#94a3b8';
  }
  const index = breakpoints.findIndex((item) => item.name === bp.name);
  if (index < 0) {
    return '#94a3b8';
  }
  return colors[index % colors.length];
}

export function buildGridMarks(size: number, step = RESPONSIVE_GRID_STEP): number[] {
  const marks: number[] = [];
  for (let i = step; i < size; i += step) {
    marks.push(i);
  }
  return marks;
}

export function formatAspectRatio(width: number, height: number): string {
  if (!height) {
    return '0.00';
  }
  return (width / height).toFixed(2);
}

export function formatDimensionsText(size: ResponsiveViewportSize): string {
  return `${size.width}x${size.height}`;
}

export function rotateViewport(size: ResponsiveViewportSize): ResponsiveViewportSize {
  return { width: size.height, height: size.width };
}

export function resolveResponsiveSuggestion(options: {
  width: number;
  height: number;
  hasLoadedPreview: boolean;
  hasCopiedDimensions: boolean;
  hasUrlError: boolean;
}): DdToolSuggestion | null {
  const { width, height, hasLoadedPreview, hasCopiedDimensions, hasUrlError } = options;

  if (hasUrlError) {
    return null;
  }

  if (hasCopiedDimensions) {
    return {
      id: 'rbt-pixel-rem',
      title: 'Convert this width to rem?',
      reason: `You copied ${width}×${height}. Turn viewport widths into rem tokens for fluid CSS.`,
      actionLabel: 'Open Pixel ↔ Rem',
      path: '/dev-design-tools/pixel-to-rem'
    };
  }

  const active = findActiveBreakpoint(width);

  if (active.name === 'Mobile') {
    return {
      id: 'rbt-viewport',
      title: 'Cross-check with live media queries?',
      reason: 'Mobile presets hide many responsive bugs. The Viewport Size Detector mirrors your real browser width.',
      actionLabel: 'Open Viewport Size Detector',
      path: '/dev-design-tools/viewport-size-detector'
    };
  }

  if (width >= 1920 || height >= 1920) {
    return {
      id: 'rbt-screen',
      title: 'Compare against device screen metrics?',
      reason: 'Large viewports may exceed many laptops. Screen Resolution Info shows your actual display size and DPR.',
      actionLabel: 'Open Screen Resolution Info',
      path: '/browser-utils/screen-resolution-info'
    };
  }

  if (hasLoadedPreview && active.name === 'Tablet') {
    return {
      id: 'rbt-orientation',
      title: 'Test portrait vs landscape next?',
      reason: 'Tablet layouts often break when orientation flips. Rotate here, then verify live orientation APIs.',
      actionLabel: 'Open Device Orientation Logger',
      path: '/browser-utils/device-orientation-logger'
    };
  }

  if (hasLoadedPreview) {
    return {
      id: 'rbt-live-viewport',
      title: 'Validate against your live viewport?',
      reason: 'Iframe preview sizes are simulated. Confirm which media queries match your actual browser window next.',
      actionLabel: 'Open Viewport Size Detector',
      path: '/dev-design-tools/viewport-size-detector'
    };
  }

  return null;
}
