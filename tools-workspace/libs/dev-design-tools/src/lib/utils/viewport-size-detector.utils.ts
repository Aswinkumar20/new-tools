import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import {
  VIEWPORT_BREAKPOINT_COLORS,
  VIEWPORT_BREAKPOINTS,
  VIEWPORT_HISTORY_LIMIT,
  VIEWPORT_HISTORY_SIZE_TOLERANCE_PX
} from '../constants/viewport-size-detector.constants';
import type {
  ViewportBreakpoint,
  ViewportHistoryEntry,
  ViewportInfo,
  ViewportOrientation,
  ViewportWindowLike
} from '../types/viewport-size-detector.types';

export function resolveViewportOrientation(width: number, height: number): ViewportOrientation {
  if (width === height) {
    return 'square';
  }
  return width > height ? 'landscape' : 'portrait';
}

export function formatOrientationLabel(orientation: ViewportOrientation): string {
  if (orientation === 'portrait') {
    return 'Portrait';
  }
  if (orientation === 'landscape') {
    return 'Landscape';
  }
  return 'Square';
}

export function readViewportInfo(
  win: ViewportWindowLike,
  now = Date.now()
): ViewportInfo {
  const viewportWidth = win.innerWidth;
  const viewportHeight = win.innerHeight;
  const screenWidth = win.screen.width;
  const screenHeight = win.screen.height;
  const devicePixelRatio = win.devicePixelRatio || 1;
  const aspectRatio = viewportHeight === 0 ? 0 : viewportWidth / viewportHeight;

  return {
    viewportWidth,
    viewportHeight,
    screenWidth,
    screenHeight,
    devicePixelRatio,
    orientation: resolveViewportOrientation(viewportWidth, viewportHeight),
    aspectRatio,
    visualViewportWidth: win.visualViewport?.width,
    visualViewportHeight: win.visualViewport?.height,
    timestamp: now
  };
}

export function findActiveBreakpoint(
  width: number,
  breakpoints: ReadonlyArray<ViewportBreakpoint> = VIEWPORT_BREAKPOINTS
): ViewportBreakpoint {
  return breakpoints.find((bp) => width >= bp.min && width <= bp.max) ?? breakpoints[0];
}

export function isOpenEndedBreakpoint(bp: ViewportBreakpoint): boolean {
  return bp.max === Infinity;
}

export function formatBreakpointName(bp: ViewportBreakpoint | null | undefined): string {
  if (!bp) {
    return 'Unknown';
  }
  if (isOpenEndedBreakpoint(bp)) {
    return `${bp.name} (${bp.min}+px)`;
  }
  return `${bp.name} (${bp.min}-${bp.max}px)`;
}

export function getBreakpointColor(
  bp: ViewportBreakpoint | null | undefined,
  breakpoints: ReadonlyArray<ViewportBreakpoint> = VIEWPORT_BREAKPOINTS,
  colors: ReadonlyArray<string> = VIEWPORT_BREAKPOINT_COLORS
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

export function effectiveResolution(info: Pick<ViewportInfo, 'screenWidth' | 'screenHeight' | 'devicePixelRatio'>): {
  width: number;
  height: number;
} {
  return {
    width: Math.round(info.screenWidth * info.devicePixelRatio),
    height: Math.round(info.screenHeight * info.devicePixelRatio)
  };
}

export function formatViewportMetricsText(
  info: ViewportInfo,
  breakpoint: ViewportBreakpoint | null
): string {
  return [
    `Viewport: ${info.viewportWidth} × ${info.viewportHeight} px`,
    `Screen: ${info.screenWidth} × ${info.screenHeight} px`,
    `Aspect ratio: ${info.aspectRatio.toFixed(2)}:1`,
    `Device pixel ratio: ${info.devicePixelRatio}x`,
    `Orientation: ${info.orientation}`,
    `Breakpoint: ${formatBreakpointName(breakpoint)}`
  ].join('\n');
}

export function formatViewportMetricsJson(info: ViewportInfo): string {
  return JSON.stringify(info, null, 2);
}

export function formatRelativeTimestamp(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString();
}

export function prependViewportHistory(
  entries: ViewportHistoryEntry[],
  entry: ViewportHistoryEntry,
  limit = VIEWPORT_HISTORY_LIMIT,
  tolerancePx = VIEWPORT_HISTORY_SIZE_TOLERANCE_PX
): ViewportHistoryEntry[] {
  const exists = entries.some(
    (existing) =>
      Math.abs(existing.width - entry.width) < tolerancePx &&
      Math.abs(existing.height - entry.height) < tolerancePx
  );
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function hasVisualViewportShrink(info: ViewportInfo): boolean {
  if (info.visualViewportWidth == null || info.visualViewportHeight == null) {
    return false;
  }
  return (
    info.visualViewportWidth < info.viewportWidth - 1 ||
    info.visualViewportHeight < info.viewportHeight - 1
  );
}

export function resolveViewportSuggestion(options: {
  info: ViewportInfo | null;
  hasCopiedMetrics: boolean;
}): DdToolSuggestion | null {
  const { info, hasCopiedMetrics } = options;
  if (!info) {
    return null;
  }

  if (hasCopiedMetrics) {
    return {
      id: 'vsd-simulate',
      title: 'Simulate this size in an iframe?',
      reason: `You copied ${info.viewportWidth}×${info.viewportHeight}. Preview a URL at that exact viewport with the Responsive Breakpoint Tester.`,
      actionLabel: 'Open Breakpoint Tester',
      path: '/dev-design-tools/responsive-breakpoint-tester'
    };
  }

  if (hasVisualViewportShrink(info)) {
    return {
      id: 'vsd-visual-vv',
      title: 'Visual viewport is smaller than layout',
      reason:
        'Mobile keyboards or pinch-zoom often shrink visualViewport. Cross-check screen metrics if layouts look clipped.',
      actionLabel: 'Open Screen Resolution Info',
      path: '/browser-utils/screen-resolution-info'
    };
  }

  const active = findActiveBreakpoint(info.viewportWidth);

  if (active.name === 'Mobile') {
    return {
      id: 'vsd-mobile',
      title: 'Test mobile presets next?',
      reason: 'You’re under typical phone breakpoints. Load a URL at common phone sizes in the Breakpoint Tester.',
      actionLabel: 'Open Breakpoint Tester',
      path: '/dev-design-tools/responsive-breakpoint-tester'
    };
  }

  if (info.devicePixelRatio > 2) {
    return {
      id: 'vsd-dpr',
      title: 'High-DPI display detected',
      reason: 'Asset sharpness and rem scaling matter more above 2× DPR. Convert key widths to rem tokens next.',
      actionLabel: 'Open Pixel ↔ Rem',
      path: '/dev-design-tools/pixel-to-rem'
    };
  }

  if (info.orientation === 'portrait') {
    return {
      id: 'vsd-orientation',
      title: 'Log orientation changes?',
      reason: 'Portrait layouts often break when the device rotates. Capture alpha/beta/gamma alongside viewport size.',
      actionLabel: 'Open Device Orientation Logger',
      path: '/browser-utils/device-orientation-logger'
    };
  }

  return {
    id: 'vsd-screen',
    title: 'Compare with physical screen metrics?',
    reason: 'CSS viewport size can differ from screen resolution due to zoom or OS scaling.',
    actionLabel: 'Open Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info'
  };
}
